import json
import logging
import time
import threading
from django.conf import settings

logger = logging.getLogger('drone_mqtt')


class MqttPublisher:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self.client = None
        self._connect()

    def _connect(self):
        try:
            import paho.mqtt.client as mqtt
            broker = getattr(settings, 'MQTT_BROKER_HOST', 'localhost')
            port = getattr(settings, 'MQTT_BROKER_PORT', 1883)
            username = getattr(settings, 'MQTT_USERNAME', None)
            password = getattr(settings, 'MQTT_PASSWORD', None)

            client_id = f'zk19-publisher-{int(time.time())}'
            self.client = mqtt.Client(client_id=client_id, clean_session=True)
            if username and password:
                self.client.username_pw_set(username, password)
            self.client.on_connect = self._on_connect
            self.client.on_disconnect = self._on_disconnect

            self.client.connect_async(broker, port, keepalive=60)
            self.client.loop_start()
            logger.info(f'MQTT Publisher 正在连接 {broker}:{port}')
        except ImportError:
            logger.error('paho-mqtt 未安装，请先安装: pip install paho-mqtt')
        except Exception as e:
            logger.error(f'MQTT Publisher 连接失败: {e}')

    def _on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            logger.info('MQTT Publisher 已连接')
        else:
            logger.error(f'MQTT Publisher 连接失败 code={rc}')

    def _on_disconnect(self, client, userdata, rc):
        if rc != 0:
            logger.warning(f'MQTT Publisher 意外断开 code={rc}，尝试重连...')
            self._reconnect()

    def _reconnect(self):
        try:
            self.client.reconnect()
        except Exception as e:
            logger.error(f'MQTT Publisher 重连失败: {e}')

    def publish(self, topic: str, payload: dict, qos: int = 1, retain: bool = False) -> bool:
        if not self.client:
            logger.error('MQTT Publisher 未初始化')
            return False
        try:
            msg = json.dumps(payload, ensure_ascii=False, default=str)
            result = self.client.publish(topic, msg, qos=qos, retain=retain)
            if result.rc == 0:
                logger.info(f'发布MQTT消息 topic={topic} msg_id={result.mid}')
                return True
            else:
                logger.error(f'MQTT发布失败 topic={topic} rc={result.rc}')
                return False
        except Exception as e:
            logger.error(f'MQTT发布异常 topic={topic}: {e}')
            return False

    def publish_task_bind(self, device_id: str, task_data: dict) -> bool:
        from .topics import get_topic, TOPIC_TASK_BIND
        topic = get_topic(TOPIC_TASK_BIND, device_id)
        payload = {
            'command': 'task_bind',
            'timestamp': int(time.time() * 1000),
            'data': task_data,
        }
        return self.publish(topic, payload)

    def publish_task_control(self, device_id: str, action: str, params: dict = None) -> bool:
        from .topics import get_topic, TOPIC_TASK_CONTROL
        topic = get_topic(TOPIC_TASK_CONTROL, device_id)
        payload = {
            'command': action,
            'timestamp': int(time.time() * 1000),
            'data': params or {},
        }
        return self.publish(topic, payload)

    def publish_command(self, device_id: str, command: str, params: dict = None) -> bool:
        from .topics import get_topic, TOPIC_CMD
        topic = get_topic(TOPIC_CMD, device_id)
        payload = {
            'command': command,
            'timestamp': int(time.time() * 1000),
            'data': params or {},
        }
        return self.publish(topic, payload)

    def publish_broadcast(self, command: str, params: dict = None) -> bool:
        from .topics import TOPIC_BROADCAST_CMD
        payload = {
            'command': command,
            'timestamp': int(time.time() * 1000),
            'data': params or {},
        }
        return self.publish(TOPIC_BROADCAST_CMD, payload, qos=2)


publisher = MqttPublisher()
