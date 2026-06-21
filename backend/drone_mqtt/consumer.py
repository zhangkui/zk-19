import os
import sys
import json
import logging
import time
import signal

logger = logging.getLogger('drone_mqtt')


class MqttConsumer:
    def __init__(self):
        self.client = None
        self.running = False
        self._reconnect_attempts = 0
        self._max_reconnect_attempts = 30
        self._base_reconnect_delay = 2

    def _setup_logging(self):
        from django.conf import settings
        level_name = getattr(settings, 'MQTT_LOG_LEVEL', 'INFO')
        level = getattr(logging, level_name, logging.INFO)
        logging.basicConfig(
            level=level,
            format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
        )
        logger.setLevel(level)

    def _get_config(self):
        from django.conf import settings
        broker = getattr(settings, 'MQTT_BROKER_HOST', 'localhost')
        port = int(getattr(settings, 'MQTT_BROKER_PORT', 1883))
        username = getattr(settings, 'MQTT_USERNAME', '')
        password = getattr(settings, 'MQTT_PASSWORD', '')
        keepalive = int(getattr(settings, 'MQTT_KEEPALIVE', 60))
        if not username:
            username = None
            password = None
        return {
            'broker': broker,
            'port': port,
            'username': username,
            'password': password,
            'keepalive': keepalive,
        }

    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            self._reconnect_attempts = 0
            logger.info('MQTT Consumer 已连接，开始订阅主题...')
            from .topics import subscribe_patterns
            patterns = subscribe_patterns()
            for pattern in patterns:
                result, mid = client.subscribe(pattern, qos=1)
                if result == 0:
                    logger.info(f'  订阅成功: {pattern}')
                else:
                    logger.error(f'  订阅失败 {pattern} rc={result}')
            try:
                client.publish('drone/consumer/status', json.dumps({
                    'status': 'online',
                    'timestamp': int(time.time()),
                    'pid': os.getpid(),
                }), qos=1, retain=True)
            except Exception:
                pass
        else:
            rc_desc = {
                1: '协议版本错误',
                2: '客户端标识符无效',
                3: '服务器不可用',
                4: '用户名或密码错误',
                5: '未授权',
            }.get(rc, '未知错误')
            logger.error(f'MQTT Consumer 连接失败 code={rc}: {rc_desc}')

    def on_disconnect(self, client, userdata, rc):
        if rc == 0:
            logger.info('MQTT Consumer 正常断开连接')
            return
        logger.warning(f'MQTT Consumer 意外断开 code={rc}')
        if self.running:
            self._reconnect_attempts += 1
            if self._reconnect_attempts <= self._max_reconnect_attempts:
                delay = min(self._base_reconnect_delay * (2 ** (self._reconnect_attempts - 1)), 60)
                logger.info(f'  第 {self._reconnect_attempts} 次重连，等待 {delay:.1f}s...')
            else:
                logger.warning(f'  已达到最大重连次数 ({self._max_reconnect_attempts})，继续后台重连')

    def on_message(self, client, userdata, msg):
        try:
            from .topics import parse_topic
            from .message_handler import handler
            topic = msg.topic
            payload = msg.payload.decode('utf-8', errors='ignore')
            logger.debug(f'收到MQTT消息: {topic} {payload[:200]}')

            topic_info = parse_topic(topic)
            if not topic_info:
                logger.warning(f'无法解析主题: {topic}')
                return

            handler.dispatch(topic_info, payload)
        except Exception as e:
            logger.error(f'处理MQTT消息异常 topic={msg.topic}: {e}', exc_info=True)

    def _connect(self):
        import paho.mqtt.client as mqtt
        cfg = self._get_config()

        client_id = f'zk19-consumer-{os.getpid()}-{int(time.time())}'
        self.client = mqtt.Client(
            client_id=client_id,
            clean_session=True,
            protocol=mqtt.MQTTv311,
            transport='tcp',
        )

        if cfg['username']:
            self.client.username_pw_set(cfg['username'], cfg['password'])

        self.client.on_connect = self.on_connect
        self.client.on_disconnect = self.on_disconnect
        self.client.on_message = self.on_message

        try:
            self.client.will_set('drone/consumer/status', json.dumps({
                'status': 'offline',
                'timestamp': int(time.time()),
            }), qos=1, retain=True)
        except Exception:
            pass

        logger.info(f'正在连接 MQTT Broker {cfg["broker"]}:{cfg["port"]} ...')
        self.client.connect_async(
            cfg['broker'],
            cfg['port'],
            keepalive=cfg['keepalive'],
        )
        self.client.loop_start()

        timeout = 30
        start = time.time()
        while time.time() - start < timeout:
            if self.client.is_connected():
                return True
            time.sleep(0.5)

        raise ConnectionError(f'连接 MQTT Broker 超时 ({timeout}s): {cfg["broker"]}:{cfg["port"]}')

    def _shutdown(self):
        logger.info('正在关闭 MQTT Consumer...')
        self.running = False
        if self.client:
            try:
                self.client.publish('drone/consumer/status', json.dumps({
                    'status': 'offline',
                    'timestamp': int(time.time()),
                }), qos=1, retain=True)
                time.sleep(0.2)
                self.client.disconnect()
                self.client.loop_stop()
            except Exception as e:
                logger.error(f'关闭时异常: {e}')
            finally:
                self.client = None
        logger.info('MQTT Consumer 已关闭')

    def start(self):
        self._setup_logging()
        logger.info('=' * 60)
        logger.info('启动 MQTT Consumer...')
        logger.info('=' * 60)

        self.running = True

        def _signal_handler(signum, frame):
            sig_name = {2: 'SIGINT', 15: 'SIGTERM'}.get(signum, str(signum))
            logger.info(f'收到信号 {sig_name}，准备退出...')
            self._shutdown()
            sys.exit(0)

        try:
            signal.signal(signal.SIGINT, _signal_handler)
        except (ValueError, OSError):
            pass
        try:
            signal.signal(signal.SIGTERM, _signal_handler)
        except (ValueError, OSError):
            pass

        try:
            self._connect()
        except Exception as e:
            logger.error(f'初始连接失败: {e}')
            logger.info('将使用 paho 自带的重连机制继续尝试...')
            if not self.client:
                import paho.mqtt.client as mqtt
                cfg = self._get_config()
                client_id = f'zk19-consumer-{os.getpid()}-{int(time.time())}'
                self.client = mqtt.Client(client_id=client_id, clean_session=True)
                if cfg['username']:
                    self.client.username_pw_set(cfg['username'], cfg['password'])
                self.client.on_connect = self.on_connect
                self.client.on_disconnect = self.on_disconnect
                self.client.on_message = self.on_message
                self.client.connect_async(cfg['broker'], cfg['port'], keepalive=cfg['keepalive'])

        logger.info('MQTT Consumer 运行中，等待消息...')
        try:
            while self.running:
                time.sleep(1)
        except KeyboardInterrupt:
            pass
        finally:
            self._shutdown()


def main():
    consumer = MqttConsumer()
    consumer.start()


if __name__ == '__main__':
    import django
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'zk19.settings')
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
    django.setup()
    main()
