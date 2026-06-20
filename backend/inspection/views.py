from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.filters import SearchFilter
from rest_framework.exceptions import PermissionDenied
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q, Count
from django.utils import timezone
from datetime import datetime
import uuid

from .models import Drone, FlightRoute, InspectionTask, InspectionMedia, Defect, Alert
from .serializers import (
    DroneSerializer,
    FlightRouteSerializer, FlightRouteListSerializer,
    InspectionTaskSerializer, InspectionTaskListSerializer,
    InspectionMediaSerializer,
    DefectSerializer, DefectListSerializer,
    AlertSerializer, AlertListSerializer,
)
from .tasks import process_inspection_media_task


class DroneViewSet(viewsets.ModelViewSet):
    queryset = Drone.objects.all()
    permission_classes = [IsAuthenticated]
    serializer_class = DroneSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['status']
    search_fields = ['name', 'model', 'serial_number']

    def perform_create(self, serializer):
        if self.request.user.role not in ['admin', 'superadmin']:
            raise PermissionDenied('只有调度管理员可以创建无人机')
        serializer.save()

    def perform_update(self, serializer):
        if self.request.user.role not in ['admin', 'superadmin']:
            raise PermissionDenied('只有调度管理员可以修改无人机')
        serializer.save()

    def perform_destroy(self, instance):
        if self.request.user.role not in ['admin', 'superadmin']:
            raise PermissionDenied('只有调度管理员可以删除无人机')
        instance.delete()


class FlightRouteViewSet(viewsets.ModelViewSet):
    queryset = FlightRoute.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['line', 'status']
    search_fields = ['name']

    def get_serializer_class(self):
        if self.action == 'list':
            return FlightRouteListSerializer
        return FlightRouteSerializer

    def perform_create(self, serializer):
        if self.request.user.role not in ['admin', 'superadmin']:
            raise PermissionDenied('只有调度管理员可以创建航线')
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        if self.request.user.role not in ['admin', 'superadmin']:
            raise PermissionDenied('只有调度管理员可以修改航线')
        serializer.save()

    def perform_destroy(self, instance):
        if self.request.user.role not in ['admin', 'superadmin']:
            raise PermissionDenied('只有调度管理员可以删除航线')
        instance.delete()


class InspectionTaskViewSet(viewsets.ModelViewSet):
    queryset = InspectionTask.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['status', 'route', 'drone', 'pilot']
    search_fields = ['code', 'name']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == 'pilot' and not user.is_superadmin:
            qs = qs.filter(pilot=user)
        return qs

    def get_serializer_class(self):
        if self.action == 'list':
            return InspectionTaskListSerializer
        return InspectionTaskSerializer

    def perform_create(self, serializer):
        user = self.request.user
        if user.role not in ['admin', 'superadmin']:
            raise PermissionDenied('只有调度管理员可以创建任务')
        if not serializer.validated_data.get('code'):
            code = f'TASK{timezone.now().strftime("%Y%m%d")}{uuid.uuid4().hex[:6].upper()}'
            serializer.save(created_by=self.request.user, code=code)
        else:
            serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        user = self.request.user
        if user.role not in ['admin', 'superadmin']:
            raise PermissionDenied('只有调度管理员可以修改任务')
        serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user
        if user.role not in ['admin', 'superadmin']:
            raise PermissionDenied('只有调度管理员可以删除任务')
        instance.delete()

    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def upload(self, request, pk=None):
        task = self.get_object()
        user = request.user
        if user.role == 'pilot' and not user.is_superadmin and task.pilot_id != user.id:
            return Response({'error': '无权操作此任务'}, status=status.HTTP_403_FORBIDDEN)
        files = request.FILES.getlist('files')
        tower_id = request.data.get('tower_id')

        if not files:
            return Response({'error': 'No files provided'}, status=status.HTTP_400_BAD_REQUEST)

        media_ids = []
        for f in files:
            media = InspectionMedia.objects.create(
                task=task,
                file=f,
                media_type='image',
                tower_id=tower_id if tower_id else None,
            )
            if tower_id:
                from lines.models import Tower
                tower = Tower.objects.filter(id=tower_id).first()
                if tower and tower.geom:
                    media.geom = tower.geom
                    media.save()
            media_ids.append(media.id)
            task.media_count += 1
            task.save()

        for mid in media_ids:
            process_inspection_media_task.delay(mid)

        return Response({
            'message': f'Successfully uploaded {len(files)} files',
            'media_ids': media_ids
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        task = self.get_object()
        user = request.user
        if user.role == 'pilot' and not user.is_superadmin and task.pilot_id != user.id:
            return Response({'error': '无权操作此任务'}, status=status.HTTP_403_FORBIDDEN)
        if task.status not in ['pending', 'paused']:
            return Response({'error': 'Task cannot be started'}, status=status.HTTP_400_BAD_REQUEST)
        task.status = 'running'
        task.started_at = timezone.now()
        task.save()
        return Response({'message': 'Task started'})

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        task = self.get_object()
        user = request.user
        if user.role == 'pilot' and not user.is_superadmin and task.pilot_id != user.id:
            return Response({'error': '无权操作此任务'}, status=status.HTTP_403_FORBIDDEN)
        if task.status != 'running':
            return Response({'error': 'Task is not running'}, status=status.HTTP_400_BAD_REQUEST)
        task.status = 'completed'
        task.ended_at = timezone.now()
        task.save()
        return Response({'message': 'Task completed'})


class InspectionMediaViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = InspectionMedia.objects.all()
    permission_classes = [IsAuthenticated]
    serializer_class = InspectionMediaSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['task', 'tower', 'media_type', 'has_defect']


class DefectViewSet(viewsets.ModelViewSet):
    queryset = Defect.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['defect_type', 'severity', 'status', 'tower', 'task']
    search_fields = ['description', 'subtype']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_superadmin:
            return qs
        if user.role == 'reviewer':
            pass
        elif user.role == 'pilot':
            qs = qs.filter(task__pilot=user)
        elif user.role == 'crew':
            qs = qs.filter(status='confirmed')
        return qs

    def get_serializer_class(self):
        if self.action == 'list':
            return DefectListSerializer
        return DefectSerializer

    @action(detail=True, methods=['post'])
    def review(self, request, pk=None):
        defect = self.get_object()
        user = request.user
        if user.role not in ['admin', 'superadmin', 'reviewer']:
            return Response({'error': '无权执行审核操作'}, status=status.HTTP_403_FORBIDDEN)
        if defect.status != 'pending':
            return Response({'error': 'Defect already reviewed'}, status=status.HTTP_400_BAD_REQUEST)

        action = request.data.get('action')
        note = request.data.get('note', '')

        if action not in ['confirm', 'reject']:
            return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)

        defect.status = 'confirmed' if action == 'confirm' else 'rejected'
        defect.review_note = note
        defect.reviewed_by = request.user
        defect.reviewed_at = timezone.now()
        defect.save()

        if action == 'confirm':
            from .tasks import create_alert_and_workorder
            create_alert_and_workorder.delay(defect.id)

        serializer = self.get_serializer(defect)
        return Response(serializer.data)


class AlertViewSet(viewsets.ModelViewSet):
    queryset = Alert.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['level', 'status', 'category', 'tower']
    search_fields = ['title', 'content']

    def get_serializer_class(self):
        if self.action == 'list':
            return AlertListSerializer
        return AlertSerializer

    @action(detail=True, methods=['post'])
    def handle(self, request, pk=None):
        alert = self.get_object()
        if alert.status in ['handled', 'closed']:
            return Response({'error': 'Alert already handled'}, status=status.HTTP_400_BAD_REQUEST)

        note = request.data.get('note', '')
        action_status = request.data.get('status', 'handled')

        if action_status not in ['processing', 'handled', 'closed']:
            return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)

        alert.status = action_status
        if action_status in ['handled', 'closed']:
            alert.handled_by = request.user
            alert.handled_at = timezone.now()
        alert.handle_note = note
        alert.save()

        serializer = self.get_serializer(alert)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def unhandled_count(self, request):
        count = Alert.objects.filter(status='open').count()
        critical = Alert.objects.filter(status='open', level='critical').count()
        major = Alert.objects.filter(status='open', level='major').count()
        return Response({
            'total': count,
            'critical': critical,
            'major': major,
            'minor': count - critical - major
        })
