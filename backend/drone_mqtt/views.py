from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.utils import timezone
from datetime import timedelta

from inspection.models import Drone, DroneTelemetry, DroneEvent, DroneMediaReport, DroneTaskSummary
from .serializers import (
    MqttConfigSerializer, DroneMqttStatusSerializer,
    DroneTelemetrySerializer, DroneEventSerializer,
    DroneMediaReportSerializer, DroneTaskSummarySerializer,
    TaskPushSerializer, TaskControlSerializer, DroneCommandSerializer,
)
from .task_push import TaskPushService


class MqttConfigViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def config(self, request):
        serializer = MqttConfigSerializer({})
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def topics(self, request):
        from .topics import subscribe_patterns
        return Response({
            'subscribe_patterns': subscribe_patterns(),
            'topic_templates': {
                'heartbeat': 'drone/{device_id}/heartbeat',
                'telemetry': 'drone/{device_id}/telemetry',
                'event': 'drone/{device_id}/event',
                'media': 'drone/{device_id}/media',
                'task_summary': 'drone/{device_id}/task_summary',
                'response': 'drone/{device_id}/response',
                'cmd': 'drone/{device_id}/cmd',
                'task_bind': 'drone/{device_id}/task_bind',
                'task_control': 'drone/{device_id}/task_control',
                'broadcast_cmd': 'drone/broadcast/cmd',
            }
        })


class DroneMqttViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Drone.objects.all()
    permission_classes = [IsAuthenticated]
    serializer_class = DroneMqttStatusSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['status']
    search_fields = ['name', 'serial_number', 'model']

    @action(detail=True, methods=['get'])
    def status(self, request, pk=None):
        drone = self.get_object()
        now = timezone.now()
        is_online = drone.last_heartbeat and (now - drone.last_heartbeat).total_seconds() < 60
        return Response({
            'drone': DroneMqttStatusSerializer(drone).data,
            'is_online': is_online,
            'offline_seconds': (now - drone.last_heartbeat).total_seconds() if drone.last_heartbeat else None,
            'recent_reports': {
                'telemetry_count': DroneTelemetry.objects.filter(drone=drone, report_time__gte=now - timedelta(hours=1)).count(),
                'event_count': DroneEvent.objects.filter(drone=drone, report_time__gte=now - timedelta(hours=1)).count(),
                'media_count': DroneMediaReport.objects.filter(drone=drone, report_time__gte=now - timedelta(hours=1)).count(),
                'task_summary_count': DroneTaskSummary.objects.filter(drone=drone, report_time__gte=now - timedelta(hours=1)).count(),
            }
        })

    @action(detail=True, methods=['get'])
    def token(self, request, pk=None):
        drone = self.get_object()
        if request.user.role not in ['admin', 'superadmin']:
            raise PermissionDenied('无权查看Token')
        import uuid
        if not drone.mqtt_token:
            drone.mqtt_token = uuid.uuid4().hex
            drone.save(update_fields=['mqtt_token'])
        return Response({
            'drone_id': drone.id,
            'device_id': drone.serial_number or str(drone.id),
            'mqtt_token': drone.mqtt_token,
        })

    @action(detail=True, methods=['post'])
    def regenerate_token(self, request, pk=None):
        drone = self.get_object()
        if request.user.role not in ['admin', 'superadmin']:
            raise PermissionDenied('无权操作')
        import uuid
        drone.mqtt_token = uuid.uuid4().hex
        drone.save(update_fields=['mqtt_token'])
        return Response({
            'message': 'Token已重新生成',
            'mqtt_token': drone.mqtt_token,
        })

    @action(detail=True, methods=['post'])
    def send_command(self, request, pk=None):
        if request.user.role not in ['admin', 'superadmin', 'pilot']:
            raise PermissionDenied('无权发送命令')
        serializer = DroneCommandSerializer(data={'drone_id': pk, **request.data})
        serializer.is_valid(raise_exception=True)
        result = TaskPushService.push_command(
            serializer.validated_data['drone_id'],
            serializer.validated_data['command'],
            serializer.validated_data.get('params', {}),
        )
        return Response(result, status=status.HTTP_200_OK if result['success'] else status.HTTP_500_INTERNAL_SERVER_ERROR)


class DroneTelemetryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = DroneTelemetry.objects.all()
    permission_classes = [IsAuthenticated]
    serializer_class = DroneTelemetrySerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['drone']
    ordering_fields = ['report_time', 'created_at']
    ordering = ['-report_time']

    @action(detail=False, methods=['get'])
    def by_drone(self, request):
        drone_id = request.query_params.get('drone_id')
        hours = int(request.query_params.get('hours', 1))
        if not drone_id:
            return Response({'error': 'drone_id required'}, status=status.HTTP_400_BAD_REQUEST)
        since = timezone.now() - timedelta(hours=hours)
        qs = self.get_queryset().filter(drone_id=drone_id, report_time__gte=since).order_by('report_time')
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)


class DroneEventViewSet(viewsets.ModelViewSet):
    queryset = DroneEvent.objects.all()
    permission_classes = [IsAuthenticated]
    serializer_class = DroneEventSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['drone', 'event_level', 'event_category', 'handled']
    search_fields = ['title', 'description', 'event_code']
    ordering_fields = ['report_time', 'created_at']
    ordering = ['-report_time']

    @action(detail=True, methods=['post'])
    def handle(self, request, pk=None):
        event = self.get_object()
        if event.handled:
            return Response({'error': '事件已处理'}, status=status.HTTP_400_BAD_REQUEST)
        event.handled = True
        event.handled_note = request.data.get('note', '')
        event.handled_at = timezone.now()
        event.save()
        serializer = self.get_serializer(event)
        return Response(serializer.data)


class DroneMediaReportViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = DroneMediaReport.objects.all()
    permission_classes = [IsAuthenticated]
    serializer_class = DroneMediaReportSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['drone', 'task', 'media_type', 'uploaded']
    ordering_fields = ['report_time', 'created_at']
    ordering = ['-report_time']


class DroneTaskSummaryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = DroneTaskSummary.objects.all()
    permission_classes = [IsAuthenticated]
    serializer_class = DroneTaskSummarySerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['drone', 'task', 'task_status']
    ordering_fields = ['report_time', 'created_at', 'progress']
    ordering = ['-report_time']

    @action(detail=False, methods=['get'])
    def by_task(self, request):
        task_id = request.query_params.get('task_id')
        if not task_id:
            return Response({'error': 'task_id required'}, status=status.HTTP_400_BAD_REQUEST)
        qs = self.get_queryset().filter(task_id=task_id).order_by('report_time')
        serializer = self.get_serializer(qs, many=True)
        data = serializer.data
        latest = qs.order_by('-report_time').first()
        return Response({
            'summaries': data,
            'latest': self.get_serializer(latest).data if latest else None,
            'progress': latest.progress if latest else 0,
            'status': latest.get_task_status_display() if latest else None,
        })


class TaskPushViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['post'])
    def bind_task(self, request):
        if request.user.role not in ['admin', 'superadmin', 'pilot']:
            raise PermissionDenied('无权操作')
        serializer = TaskPushSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = TaskPushService.push_task_bind(serializer.validated_data['task_id'])
        return Response(result, status=status.HTTP_200_OK if result['success'] else status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def task_control(self, request):
        if request.user.role not in ['admin', 'superadmin', 'pilot']:
            raise PermissionDenied('无权操作')
        serializer = TaskControlSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = TaskPushService.push_task_control(
            serializer.validated_data['task_id'],
            serializer.validated_data['action'],
            serializer.validated_data.get('params', {}),
        )
        return Response(result, status=status.HTTP_200_OK if result['success'] else status.HTTP_400_BAD_REQUEST)
