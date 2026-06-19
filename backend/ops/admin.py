from django.contrib import admin
from .models import WorkOrder, WorkOrderLog


@admin.register(WorkOrder)
class WorkOrderAdmin(admin.ModelAdmin):
    list_display = ['code', 'title', 'status', 'severity', 'priority', 'tower', 'assignee', 'created_at']
    list_filter = ['status', 'severity', 'priority']
    search_fields = ['code', 'title', 'description']
    date_hierarchy = 'created_at'
    readonly_fields = ['code', 'created_at', 'updated_at']


@admin.register(WorkOrderLog)
class WorkOrderLogAdmin(admin.ModelAdmin):
    list_display = ['work_order', 'action', 'operator', 'from_status', 'to_status', 'created_at']
    list_filter = ['action']
    search_fields = ['work_order__code', 'note']
    date_hierarchy = 'created_at'
