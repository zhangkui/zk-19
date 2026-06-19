from django.contrib import admin
from .models import Drone, FlightRoute, InspectionTask, InspectionMedia, Defect, Alert


@admin.register(Drone)
class DroneAdmin(admin.ModelAdmin):
    list_display = ['name', 'model', 'status', 'battery', 'created_at']
    list_filter = ['status']
    search_fields = ['name', 'model', 'serial_number']


@admin.register(FlightRoute)
class FlightRouteAdmin(admin.ModelAdmin):
    list_display = ['name', 'line', 'status', 'altitude', 'speed', 'created_at']
    list_filter = ['status', 'line']
    search_fields = ['name']


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
