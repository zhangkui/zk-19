from django.contrib import admin
from django.contrib.gis.admin import GeoModelAdmin, OSMGeoAdmin
from .models import Line, Section, Tower, ChangeHistory


@admin.register(Line)
class LineAdmin(OSMGeoAdmin):
    list_display = ['name', 'voltage', 'created_at']
    list_filter = ['voltage']
    search_fields = ['name']
    default_lon = 116.397
    default_lat = 39.908
    default_zoom = 10


@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ['line', 'name', 'start_km', 'end_km']
    list_filter = ['line']
    search_fields = ['name']


@admin.register(Tower)
class TowerAdmin(OSMGeoAdmin):
    list_display = ['line', 'code', 'tower_type', 'height', 'sequence']
    list_filter = ['line', 'tower_type']
    search_fields = ['code']
    default_lon = 116.397
    default_lat = 39.908
    default_zoom = 10


@admin.register(ChangeHistory)
class ChangeHistoryAdmin(admin.ModelAdmin):
    list_display = ['content_type', 'action', 'object_name', 'user', 'created_at']
    list_filter = ['content_type', 'action']
    search_fields = ['object_name', 'note']
    readonly_fields = ['created_at']
