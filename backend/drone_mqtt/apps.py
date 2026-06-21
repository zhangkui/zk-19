from django.apps import AppConfig


class DroneMqttConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'drone_mqtt'
    verbose_name = '无人机MQTT通讯'
