from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
import uuid

from .models import WorkOrder, WorkOrderLog
from .serializers import WorkOrderListSerializer, WorkOrderDetailSerializer, WorkOrderLogSerializer


class WorkOrderViewSet(viewsets.ModelViewSet):
    queryset = WorkOrder.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'severity', 'priority', 'tower', 'assignee']
    search_fields = ['code', 'title', 'description']

    def get_serializer_class(self):
        if self.action == 'list':
            return WorkOrderListSerializer
        return WorkOrderDetailSerializer

    def perform_create(self, serializer):
        code = f'WO{timezone.now().strftime("%Y%m%d")}{uuid.uuid4().hex[:6].upper()}'
        serializer.save(
            created_by=self.request.user,
            code=code,
        )
        wo = serializer.instance
        WorkOrderLog.objects.create(
            work_order=wo,
            action='create',
            operator=self.request.user,
            note='工单创建',
            to_status=wo.status,
        )

    def _add_log(self, work_order, action, note='', from_status='', to_status=''):
        WorkOrderLog.objects.create(
            work_order=work_order,
            action=action,
            operator=self.request.user,
            note=note,
            from_status=from_status,
            to_status=to_status,
        )

    @action(detail=True, methods=['post'])
    def transition(self, request, pk=None):
        work_order = self.get_object()
        action = request.data.get('action')
        note = request.data.get('note', '')
        assignee_id = request.data.get('assignee_id')

        if not action:
            return Response({'error': 'Action required'}, status=status.HTTP_400_BAD_REQUEST)

        old_status = work_order.status

        if action == 'assign':
            if work_order.status not in ['created', 'processing']:
                return Response({'error': 'Cannot assign in current status'}, status=400)
            if not assignee_id:
                return Response({'error': 'assignee_id required'}, status=400)
            from accounts.models import User
            assignee = User.objects.get(id=assignee_id)
            work_order.assignee = assignee
            work_order.status = 'assigned'

        elif action == 'start':
            if work_order.status not in ['assigned']:
                return Response({'error': 'Cannot start in current status'}, status=400)
            work_order.status = 'processing'
            work_order.actual_start = timezone.now()

        elif action == 'submit_review':
            if work_order.status != 'processing':
                return Response({'error': 'Cannot submit review in current status'}, status=400)
            work_order.status = 'review'

        elif action == 'review_pass':
            if work_order.status != 'review':
                return Response({'error': 'Cannot review in current status'}, status=400)
            work_order.status = 'closed'
            work_order.reviewer = request.user
            work_order.actual_end = timezone.now()
            work_order.closed_at = timezone.now()

        elif action == 'review_fail':
            if work_order.status != 'review':
                return Response({'error': 'Cannot review in current status'}, status=400)
            work_order.status = 'processing'

        elif action == 'close':
            if work_order.status not in ['review', 'processing']:
                return Response({'error': 'Cannot close in current status'}, status=400)
            work_order.status = 'closed'
            work_order.closed_at = timezone.now()

        elif action == 'cancel':
            if work_order.status in ['closed']:
                return Response({'error': 'Cannot cancel closed order'}, status=400)
            work_order.status = 'cancelled'

        else:
            return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)

        work_order.save()
        self._add_log(work_order, action, note, old_status, work_order.status)

        serializer = self.get_serializer(work_order)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def add_log(self, request, pk=None):
        work_order = self.get_object()
        note = request.data.get('note', '')
        if not note:
            return Response({'error': 'Note required'}, status=400)

        log = WorkOrderLog.objects.create(
            work_order=work_order,
            action='note',
            operator=request.user,
            note=note,
        )
        return Response(WorkOrderLogSerializer(log).data, status=201)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        total = WorkOrder.objects.count()
        by_status = {}
        for status_key, _ in WorkOrder.STATUS_CHOICES:
            by_status[status_key] = WorkOrder.objects.filter(status=status_key).count()
        return Response({
            'total': total,
            'by_status': by_status,
        })
