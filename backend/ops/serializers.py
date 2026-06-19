from rest_framework import serializers
from .models import WorkOrder, WorkOrderLog


class WorkOrderLogSerializer(serializers.ModelSerializer):
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    operator_name = serializers.CharField(source='operator.name', read_only=True)

    class Meta:
        model = WorkOrderLog
        fields = ['id', 'action', 'action_display', 'operator', 'operator_name',
                  'note', 'from_status', 'to_status', 'created_at']


class WorkOrderListSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    severity_display = serializers.CharField(source='get_severity_display', read_only=True)
    tower_code = serializers.CharField(source='tower.code', read_only=True)
    tower_line = serializers.CharField(source='tower.line.name', read_only=True)
    assignee_name = serializers.CharField(source='assignee.name', read_only=True, default=None)
    created_by_name = serializers.CharField(source='created_by.name', read_only=True, default=None)

    class Meta:
        model = WorkOrder
        fields = ['id', 'code', 'title', 'tower', 'tower_code', 'tower_line',
                  'severity', 'severity_display', 'priority', 'priority_display',
                  'status', 'status_display', 'assignee', 'assignee_name',
                  'created_by', 'created_by_name', 'planned_start', 'planned_end',
                  'actual_start', 'actual_end', 'created_at']


class WorkOrderDetailSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    severity_display = serializers.CharField(source='get_severity_display', read_only=True)
    tower_code = serializers.CharField(source='tower.code', read_only=True)
    tower_line = serializers.CharField(source='tower.line.name', read_only=True)
    assignee_name = serializers.CharField(source='assignee.name', read_only=True, default=None)
    created_by_name = serializers.CharField(source='created_by.name', read_only=True, default=None)
    reviewer_name = serializers.CharField(source='reviewer.name', read_only=True, default=None)
    logs = WorkOrderLogSerializer(many=True, read_only=True)
    defect_info = serializers.SerializerMethodField()

    class Meta:
        model = WorkOrder
        fields = ['id', 'code', 'title', 'description', 'defect', 'defect_info',
                  'tower', 'tower_code', 'tower_line',
                  'severity', 'severity_display', 'priority', 'priority_display',
                  'status', 'status_display', 'assignee', 'assignee_name',
                  'created_by', 'created_by_name', 'reviewer', 'reviewer_name',
                  'planned_start', 'planned_end', 'actual_start', 'actual_end',
                  'closed_at', 'logs', 'created_at', 'updated_at']

    def get_defect_info(self, obj):
        if obj.defect:
            return {
                'id': obj.defect.id,
                'type': obj.defect.defect_type,
                'type_display': obj.defect.get_defect_type_display(),
                'subtype': obj.defect.subtype,
                'subtype_display': obj.defect.get_subtype_display(),
                'confidence': obj.defect.confidence,
            }
        return None
