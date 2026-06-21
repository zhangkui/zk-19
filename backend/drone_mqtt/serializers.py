from rest_framework import serializers
from inspection.models import Drone, DroneTelemetry, DroneEvent, DroneMediaReport, DroneTaskSummary


class MqttConfigSerializer(serializers.Serializer):
    broker_host = serializers.CharField(max_length=100)
    broker_port = serializers.IntegerField()
    use_tls = serializers.BooleanField(default=False)
    username = serializers.CharField(max_length=100, allow_blank=True, default='')
    keepalive = serializers.IntegerField(default=60)

    def to_representation(self, instance):
        from django.conf import settings
        return {
            'broker_host': getattr(settings, 'MQTT_BROKER_HOST', 'localhost'),
            'broker_port': getattr(settings, 'MQTT_BROKER_PORT', 1883),
            'use_tls': getattr(settings, 'MQTT_USE_TLS', False),
            'username': getattr(settings, 'MQTT_USERNAME', ''),
            'keepalive': getattr(settings, 'MQTT_KEEPALIVE', 60),
        }


class DroneMqttStatusSerializer(serializers.ModelSerializer):
    is_online = serializers.BooleanField(read_only=True)
    topics = serializers.SerializerMethodField()

    class Meta:
        model = Drone
        fields = [
            'id', 'name', 'serial_number', 'model', 'firmware_version',
            'status', 'is_online', 'battery', 'signal_strength',
            'latitude', 'longitude', 'altitude', 'speed', 'heading',
            'last_heartbeat', 'last_report_time', 'last_report_type',
            'current_task_id', 'current_route_id', 'current_line_id',
            'mqtt_token', 'topics',
        ]

    def get_topics(self, obj):
        device_id = obj.serial_number or str(obj.id)
        return {
            'heartbeat': f'drone/{device_id}/heartbeat',
            'telemetry': f'drone/{device_id}/telemetry',
            'event': f'drone/{device_id}/event',
            'media': f'drone/{device_id}/media',
            'task_summary': f'drone/{device_id}/task_summary',
            'response': f'drone/{device_id}/response',
            'cmd': f'drone/{device_id}/cmd',
            'task_bind': f'drone/{device_id}/task_bind',
            'task_control': f'drone/{device_id}/task_control',
        }


class DroneTelemetrySerializer(serializers.ModelSerializer):
    class Meta:
        model = DroneTelemetry
        fields = '__all__'


class DroneEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = DroneEvent
        fields = '__all__'


class DroneMediaReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = DroneMediaReport
        fields = '__all__'


class DroneTaskSummarySerializer(serializers.ModelSerializer):
    task_status_display = serializers.CharField(source='get_task_status_display', read_only=True)

    class Meta:
        model = DroneTaskSummary
        fields = '__all__'


class TaskPushSerializer(serializers.Serializer):
    task_id = serializers.IntegerField()


class TaskControlSerializer(serializers.Serializer):
    task_id = serializers.IntegerField()
    action = serializers.ChoiceField(choices=[
        ('start', '开始'),
        ('pause', '暂停'),
        ('resume', '恢复'),
        ('stop', '停止'),
        ('return_home', '返航'),
    ])
    params = serializers.DictField(required=False, default=dict)


class DroneCommandSerializer(serializers.Serializer):
    drone_id = serializers.IntegerField()
    command = serializers.CharField(max_length=100)
    params = serializers.DictField(required=False, default=dict)
