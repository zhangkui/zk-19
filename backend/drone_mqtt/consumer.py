import os
import sys
import django

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'zk19.settings')
django.setup()

import json
import logging
import time
import signal
from django.conf import settings
from .topics import subscribe_patterns, parse_topic
from .message_handler import handler

logger = logging.getLogger('drone_mqtt')
logging.basicConfig(
    level=getattr(logging, getattr(settings, 'MQTT_LOG_LEVEL', 'INFO')),
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)


class MqttConsumer:
    def __init__(self):
        self.client = None
        self.running = False
        import paho.mqtt.client as mqtt
        self.mqtt = mqtt

    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            logger.info('MQTT Consumer 已连接，开始订阅主题...')
            patterns = subscribe_patterns()
            for pattern in patterns:
                result, mid = client.subscribe(pattern, qos=1)
                if result == 0:
                    logger.info(f'订阅主题: {pattern}')
                else:
                    logger.error(f'订阅失败 {pattern} rc={result}')
        else:
            logger.error(f'MQTT Consumer 连接失败 code={rc}')

    def on_disconnect(self, client, userdata, rc):
        if rc != 0:
            logger.warning(f'MQTT Consumer 意外断开 code={rc}')
        if self.running:
            logger.info('尝试重新连接...')
            time.sleep(3)
            self._connect()

    def on_message(self, client, userdata, msg):
        try:
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
        broker = getattr(settings, 'MQTT_BROKER_HOST', 'localhost')
        port = getattr(settings, 'MQTT_BROKER_PORT', 1883)
        username = getattr(settings, 'MQTT_USERNAME', None)
        password = getattr(settings, 'MQTT_PASSWORD', None)
        keepalive = getattr(settings, 'MQTT_KEEPALIVE', 60)

        client_id = f'zk19-consumer-{int(time.time())}'
        self.client = self.mqtt.Client(client_id=client_id, clean_session=True)
        if username and password:
            self.client.username_pw_set(username, password)

        self.client.on_connect = self.on_connect
        self.client.on_disconnect = self.on_disconnect
        self.client.on_message = self.on_message

        self.client.will_set('drone/consumer/status', json.dumps({
            'status': 'offline',
            'timestamp': int(time.time())
        }), qos=1, retain=True)

        try:
            self.client.connect(broker, port, keepalive=keepalive)
            self.client.publish('drone/consumer/status', json.dumps({
                'status': 'online',
                'timestamp': int(time.time())
            }), qos=1, retain=True)
        except Exception as e:
            logger.error(f'MQTT Consumer 连接异常: {e}')
            raise

    def start(self):
        logger.info('启动 MQTT Consumer...')
        self.running = True
        self._connect()

        def _signal_handler(signum, frame):
            logger.info(f'收到信号 {signum}，正在停止 MQTT Consumer...')
            self.running = False
            if self.client:
                self.client.publish('drone/consumer/status', json.dumps({
                    'status': 'offline',
                    'timestamp': int(time.time())
                }), qos=1, retain=True)
                self.client.disconnect()
                self.client.loop_stop()
            sys.exit(0)

        signal.signal(signal.SIGINT, _signal_handler)
        signal.signal(signal.SIGTERM, _signal_handler)

        try:
            self.client.loop_forever(retry_first_connection=True)
        except KeyboardInterrupt:
            _signal_handler(signal.SIGINT, None)
        except Exception as e:
            logger.error(f'MQTT Consumer 运行异常: {e}', exc_info=True)


def main():
    consumer = MqttConsumer()
    consumer.start()


if __name__ == '__main__':
    main()
