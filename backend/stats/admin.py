from django.contrib import admin
from .models import SectionDefectStat, LineDefectStat


@admin.register(SectionDefectStat)
class SectionDefectStatAdmin(admin.ModelAdmin):
    list_display = ['section', 'line', 'total_defects', 'critical_count', 'major_count', 'minor_count', 'last_updated']
    list_filter = ['line']
    readonly_fields = ['last_updated']


@admin.register(LineDefectStat)
class LineDefectStatAdmin(admin.ModelAdmin):
    list_display = ['line', 'total_defects', 'critical_count', 'major_count', 'minor_count', 'tower_count', 'defect_rate', 'last_updated']
    readonly_fields = ['last_updated']
