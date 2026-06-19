from celery import shared_task
from django.db.models import Count, Q
from django.utils import timezone

from lines.models import Line, Tower, Section
from inspection.models import Defect
from .models import SectionDefectStat, LineDefectStat


@shared_task
def update_section_stats():
    """更新区段缺陷统计"""
    sections = Section.objects.all()
    for section in sections:
        total = Defect.objects.filter(tower__section=section).count()
        critical = Defect.objects.filter(tower__section=section, severity='critical').count()
        major = Defect.objects.filter(tower__section=section, severity='major').count()
        minor = Defect.objects.filter(tower__section=section, severity='minor').count()

        SectionDefectStat.objects.update_or_create(
            section=section,
            defaults={
                'line': section.line,
                'total_defects': total,
                'critical_count': critical,
                'major_count': major,
                'minor_count': minor,
            }
        )
    return f'Updated {sections.count()} section stats'


@shared_task
def update_line_stats():
    """更新线路缺陷统计"""
    lines = Line.objects.all()
    for line in lines:
        tower_count = line.towers.count()
        total = Defect.objects.filter(tower__line=line).count()
        critical = Defect.objects.filter(tower__line=line, severity='critical').count()
        major = Defect.objects.filter(tower__line=line, severity='major').count()
        minor = Defect.objects.filter(tower__line=line, severity='minor').count()
        rate = (total / tower_count * 100) if tower_count > 0 else 0

        LineDefectStat.objects.update_or_create(
            line=line,
            defaults={
                'total_defects': total,
                'critical_count': critical,
                'major_count': major,
                'minor_count': minor,
                'tower_count': tower_count,
                'defect_rate': rate,
            }
        )
    return f'Updated {lines.count()} line stats'
