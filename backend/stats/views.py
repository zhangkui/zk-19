from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Q
from django.utils import timezone
from datetime import timedelta

from .models import SectionDefectStat, LineDefectStat
from .serializers import (
    SectionDefectStatSerializer, LineDefectStatSerializer,
    TowerDefectRankSerializer,
)
from lines.models import Line, Tower, Section
from inspection.models import Defect, Alert
from ops.models import WorkOrder


class StatsViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def overview(self, request):
        lines_count = Line.objects.count()
        towers_count = Tower.objects.count()
        defects_count = Defect.objects.count()
        alerts_count = Alert.objects.filter(status='open').count()
        tasks_count = Defect.objects.filter(created_at__date=timezone.now().date()).count()
        workorders_count = WorkOrder.objects.filter(status__in=['created', 'assigned', 'processing', 'review']).count()
        closed_workorders = WorkOrder.objects.filter(status='closed').count()
        total_workorders = WorkOrder.objects.count()
        close_rate = (closed_workorders / total_workorders * 100) if total_workorders > 0 else 0

        by_severity = {
            'critical': Defect.objects.filter(severity='critical').count(),
            'major': Defect.objects.filter(severity='major').count(),
            'minor': Defect.objects.filter(severity='minor').count(),
        }

        return Response({
            'lines': lines_count,
            'towers': towers_count,
            'defects': defects_count,
            'alerts': alerts_count,
            'today_defects': tasks_count,
            'pending_workorders': workorders_count,
            'close_rate': round(close_rate, 1),
            'by_severity': by_severity,
        })

    @action(detail=False, methods=['get'])
    def sections(self, request):
        sections = Section.objects.annotate(
            total=Count('towers__defects'),
            critical=Count('towers__defects', filter=Q(towers__defects__severity='critical')),
            major=Count('towers__defects', filter=Q(towers__defects__severity='major')),
            minor=Count('towers__defects', filter=Q(towers__defects__severity='minor')),
        ).order_by('-total')[:20]

        data = []
        for s in sections:
            data.append({
                'id': s.id,
                'name': s.name,
                'line_id': s.line_id,
                'line_name': s.line.name,
                'total_defects': s.total,
                'critical': s.critical,
                'major': s.major,
                'minor': s.minor,
            })

        return Response(data)

    @action(detail=False, methods=['get'])
    def lines(self, request):
        lines = Line.objects.annotate(
            total=Count('towers__defects', distinct=True),
            critical=Count('towers__defects', filter=Q(towers__defects__severity='critical'), distinct=True),
            major=Count('towers__defects', filter=Q(towers__defects__severity='major'), distinct=True),
            minor=Count('towers__defects', filter=Q(towers__defects__severity='minor'), distinct=True),
            tower_cnt=Count('towers', distinct=True),
        ).order_by('-total')

        data = []
        for l in lines:
            rate = (l.total / l.tower_cnt * 100) if l.tower_cnt > 0 else 0
            geom_coords = None
            if l.geom:
                geom_coords = list(l.geom.coords)
            data.append({
                'id': l.id,
                'name': l.name,
                'voltage': l.voltage,
                'total_defects': l.total,
                'critical': l.critical,
                'major': l.major,
                'minor': l.minor,
                'tower_count': l.tower_cnt,
                'defect_rate': round(rate, 2),
                'coordinates': geom_coords,
            })

        return Response(data)

    @action(detail=False, methods=['get'])
    def tower_rank(self, request):
        limit = int(request.query_params.get('limit', 20))
        towers = Tower.objects.annotate(
            defect_cnt=Count('defects')
        ).filter(defect_cnt__gt=0).order_by('-defect_cnt')[:limit]

        serializer = TowerDefectRankSerializer(towers, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def trends(self, request):
        days = int(request.query_params.get('days', 30))
        end_date = timezone.now().date()
        start_date = end_date - timedelta(days=days - 1)

        daily_data = []
        type_data = {}
        from django.db.models.functions import TruncDate

        defects_by_day = Defect.objects.filter(
            created_at__date__gte=start_date,
            created_at__date__lte=end_date
        ).annotate(
            date=TruncDate('created_at')
        ).values('date').annotate(
            count=Count('id')
        ).order_by('date')

        day_map = {item['date']: item['count'] for item in defects_by_day}
        for i in range(days):
            d = start_date + timedelta(days=i)
            daily_data.append({
                'date': d.isoformat(),
                'count': day_map.get(d, 0),
            })

        types = Defect.objects.values('defect_type', 'severity').annotate(
            count=Count('id')
        )
        type_summary = {}
        for t in types:
            if t['defect_type'] not in type_summary:
                type_summary[t['defect_type']] = {'total': 0}
            type_summary[t['defect_type']][t['severity']] = t['count']
            type_summary[t['defect_type']]['total'] += t['count']

        return Response({
            'daily': daily_data,
            'by_type': type_summary,
        })

    @action(detail=False, methods=['get'])
    def defect_types(self, request):
        from inspection.models import Defect
        types = Defect.objects.values('defect_type', 'subtype').annotate(
            count=Count('id')
        ).order_by('-count')

        result = {}
        for t in types:
            dtype = t['defect_type']
            if dtype not in result:
                result[dtype] = {'total': 0, 'subtypes': []}
            result[dtype]['subtypes'].append({
                'subtype': t['subtype'],
                'count': t['count'],
            })
            result[dtype]['total'] += t['count']

        return Response(result)

    @action(detail=False, methods=['get'])
    def heatmap(self, request):
        towers = Tower.objects.annotate(
            defect_cnt=Count('defects')
        ).filter(defect_cnt__gt=0)

        data = []
        for t in towers:
            if t.geom:
                data.append({
                    'id': t.id,
                    'code': t.code,
                    'line_id': t.line_id,
                    'line_name': t.line.name,
                    'lon': t.geom.x,
                    'lat': t.geom.y,
                    'defect_count': t.defect_cnt,
                    'intensity': min(t.defect_cnt / 10.0, 1.0),
                })

        return Response(data)
