from django.contrib import admin
from .models import (
    Drone, FlightRoute, FlightRouteVersion,
    InspectionTask, InspectionMedia, Defect, Alert,
    DroneTelemetry, DroneEvent, DroneMediaReport, DroneTaskSummary,
)


@admin.register(Drone)
class DroneAdmin(admin.ModelAdmin):
    list_display = ['name', 'model', 'serial_number', 'status', 'battery',
                    'signal_strength', 'last_heartbeat', 'created_at']
    list_filter = ['status', 'last_report_type']
    search_fields = ['name', 'model', 'serial_number', 'firmware_version']
    readonly_fields = ['last_heartbeat', 'last_report_time', 'last_report_type',
                       'current_task_id', 'current_route_id', 'current_line_id']


@admin.register(FlightRoute)
class FlightRouteAdmin(admin.ModelAdmin):
    list_display = ['name', 'line', 'status', 'altitude', 'speed', 'created_at']
    list_filter = ['status', 'line']
    search_fields = ['name']


@admin.register(FlightRouteVersion)
class FlightRouteVersionAdmin(admin.ModelAdmin):
    list_display = ['route', 'version', 'name', 'line', 'status', 'created_at']
    list_filter = ['status', 'line']
    search_fields = ['name']


@admin.register(DroneTelemetry)
class DroneTelemetryAdmin(admin.ModelAdmin):
    list_display = ['drone', 'report_time', 'latitude', 'longitude', 'altitude',
                    'speed', 'battery', 'signal_strength']
    list_filter = ['drone']
    search_fields = ['drone__name']
    date_hierarchy = 'report_time'
    readonly_fields = ['drone', 'report_time', 'latitude', 'longitude', 'altitude',
                       'speed', 'heading', 'battery', 'signal_strength', 'satellites',
                       'temperature', 'wind_speed', 'extra_data']


@admin.register(DroneEvent)
class DroneEventAdmin(admin.ModelAdmin):
    list_display = ['drone', 'report_time', 'event_level', 'event_category',
                    'title', 'handled']
    list_filter = ['drone', 'event_level', 'event_category', 'handled']
    search_fields = ['title', 'description', 'event_code']
    date_hierarchy = 'report_time'
    readonly_fields = ['drone', 'report_time', 'event_level', 'event_category',
                       'event_code', 'title', 'description', 'latitude', 'longitude',
                       'altitude', 'extra_data']


@admin.register(DroneMediaReport)
class DroneMediaReportAdmin(admin.ModelAdmin):
    list_display = ['drone', 'report_time', 'media_type', 'file_name',
                    'task', 'uploaded']
    list_filter = ['drone', 'media_type', 'uploaded']
    search_fields = ['file_name', 'file_url']
    date_hierarchy = 'report_time'
    readonly_fields = ['drone', 'task', 'report_time', 'media_type', 'file_name',
                       'file_url', 'thumbnail_url', 'file_size', 'duration',
                       'latitude', 'longitude', 'altitude', 'heading', 'tower_id',
                       'uploaded', 'media_id', 'extra_data']


@admin.register(DroneTaskSummary)
class DroneTaskSummaryAdmin(admin.ModelAdmin):
    list_display = ['drone', 'task', 'report_time', 'task_status',
                    'progress', 'current_waypoint_index', 'total_waypoints']
    list_filter = ['drone', 'task', 'task_status']
    search_fields = ['task__code', 'drone__name']
    date_hierarchy = 'report_time'
    readonly_fields = ['drone', 'task', 'route', 'report_time', 'task_status',
                       'flight_phase', 'current_waypoint_index', 'total_waypoints',
                       'progress', 'flight_distance', 'remaining_distance',
                       'elapsed_time', 'remaining_time', 'photos_taken',
                       'videos_recorded', 'battery_used', 'latitude', 'longitude',
                       'altitude', 'speed', 'heading', 'extra_data']


@admin.register(InspectionTask)
class InspectionTaskAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'status', 'drone', 'pilot', 'media_count', 'defect_count', 'created_at']
    list_filter = ['status', 'route', 'drone']
    search_fields = ['code', 'name']
    date_hierarchy = 'created_at'


@admin.register(InspectionMedia)
class InspectionMediaAdmin(admin.ModelAdmin):
    list_display = ['id', 'task', 'tower', 'media_type', 'has_defect', 'defect_count', 'uploaded_at']
    list_filter = ['media_type', 'has_defect', 'task']
    date_hierarchy = 'uploaded_at'


@admin.register(Defect)
class DefectAdmin(admin.ModelAdmin):
    list_display = ['id', 'defect_type', 'subtype', 'severity', 'status', 'tower', 'confidence', 'created_at']
    list_filter = ['defect_type', 'severity', 'status']
    search_fields = ['description', 'subtype']
    date_hierarchy = 'created_at'


@admin.register(Alert)
class AlertAdmin(admin.ModelAdmin):
    list_display = ['id', 'level', 'title', 'status', 'tower', 'created_at']
    list_filter = ['level', 'status', 'category']
    search_fields = ['title', 'content']
    date_hierarchy = 'created_at'
