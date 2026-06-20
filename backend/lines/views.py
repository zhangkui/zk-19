from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import MultiPartParser, FormParser
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.geos import Point
from django.db.models import Count
from django.db import transaction
from django_filters.rest_framework import DjangoFilterBackend
from django.http import HttpResponse
import csv
import io

from .models import Line, Section, Tower, ChangeHistory
from .serializers import (
    LineSerializer, LineListSerializer, LineDetailSerializer,
    SectionSerializer, TowerSerializer, ChangeHistorySerializer
)


class LineViewSet(viewsets.ModelViewSet):
    queryset = Line.objects.all().annotate(
        tower_count=Count('towers', distinct=True),
        defect_count=Count('towers__defects', distinct=True)
    )
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['voltage']
    search_fields = ['name']

    def get_serializer_class(self):
        if self.action == 'list':
            return LineListSerializer
        elif self.action == 'retrieve':
            return LineDetailSerializer
        return LineSerializer

    def perform_create(self, serializer):
        if self.request.user.role not in ['admin', 'superadmin']:
            raise PermissionDenied('只有调度管理员可以创建线路')
        serializer.save()

    def perform_update(self, serializer):
        if self.request.user.role not in ['admin', 'superadmin']:
            raise PermissionDenied('只有调度管理员可以修改线路')
        serializer.save()

    def perform_destroy(self, instance):
        if self.request.user.role not in ['admin', 'superadmin']:
            raise PermissionDenied('只有调度管理员可以删除线路')
        user = self.request.user
        ChangeHistory.objects.create(
            content_type='line',
            object_id=instance.id,
            object_name=instance.name,
            action='delete',
            user=user,
            note=f'删除线路: {instance.name}',
        )
        instance.delete()

    @action(detail=False, methods=['get'])
    def export(self, request):
        if request.user.role not in ['admin', 'superadmin']:
            raise PermissionDenied('只有调度管理员可以导出数据')
        response = HttpResponse(content_type='text/csv; charset=utf-8-sig')
        response['Content-Disposition'] = 'attachment; filename="lines.csv"'
        writer = csv.writer(response)
        writer.writerow(['ID', '线路名称', '电压等级', '描述', '杆塔数量', '创建时间', '坐标点(经度,纬度)'])
        for line in self.get_queryset():
            coords = '; '.join([f'{c[0]},{c[1]}' for c in line.coordinates]) if hasattr(line, 'coordinates') and line.coordinates else ''
            writer.writerow([
                line.id, line.name, line.voltage, line.description or '',
                line.tower_count or 0, line.created_at.strftime('%Y-%m-%d %H:%M:%S'), coords
            ])
        return response

    @action(detail=True, methods=['post'])
    def split_sections(self, request, pk=None):
        if request.user.role not in ['admin', 'superadmin']:
            raise PermissionDenied('只有调度管理员可以切分区段')
        line = self.get_object()
        sections_data = request.data.get('sections', [])
        auto_assign = request.data.get('auto_assign', True)
        if not sections_data:
            return Response({'error': 'sections参数不能为空'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            with transaction.atomic():
                created_sections = []
                for sec_data in sections_data:
                    section = Section.objects.create(
                        line=line,
                        name=sec_data.get('name', ''),
                        start_km=float(sec_data.get('start_km', 0)),
                        end_km=float(sec_data.get('end_km', 0)),
                        description=sec_data.get('description', ''),
                    )
                    created_sections.append(section)
                    ChangeHistory.objects.create(
                        content_type='section',
                        object_id=section.id,
                        object_name=section.name,
                        action='create',
                        user=request.user,
                        note=f'线路切分创建区段: {section.name}',
                    )
                if auto_assign:
                    towers = line.towers.all()
                    for tower in towers:
                        assigned_section = line.get_tower_section(tower)
                        if assigned_section:
                            tower.section = assigned_section
                            tower.save(update_fields=['section'])
                serializer = SectionSerializer(created_sections, many=True)
                return Response(serializer.data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class SectionViewSet(viewsets.ModelViewSet):
    queryset = Section.objects.all().annotate(tower_count=Count('towers'))
    permission_classes = [IsAuthenticated]
    serializer_class = SectionSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['line']

    def perform_create(self, serializer):
        if self.request.user.role not in ['admin', 'superadmin']:
            raise PermissionDenied('只有调度管理员可以创建区段')
        serializer.save()

    def perform_update(self, serializer):
        if self.request.user.role not in ['admin', 'superadmin']:
            raise PermissionDenied('只有调度管理员可以修改区段')
        serializer.save()

    def perform_destroy(self, instance):
        if self.request.user.role not in ['admin', 'superadmin']:
            raise PermissionDenied('只有调度管理员可以删除区段')
        user = self.request.user
        ChangeHistory.objects.create(
            content_type='section',
            object_id=instance.id,
            object_name=instance.name,
            action='delete',
            user=user,
            note=f'删除区段: {instance.name}',
        )
        instance.delete()

    @action(detail=False, methods=['get'])
    def export(self, request):
        if request.user.role not in ['admin', 'superadmin']:
            raise PermissionDenied('只有调度管理员可以导出数据')
        response = HttpResponse(content_type='text/csv; charset=utf-8-sig')
        response['Content-Disposition'] = 'attachment; filename="sections.csv"'
        writer = csv.writer(response)
        writer.writerow(['ID', '线路名称', '区段名称', '起始公里标(km)', '结束公里标(km)', '描述', '杆塔数量', '创建时间'])
        for section in self.get_queryset():
            writer.writerow([
                section.id, section.line_name if hasattr(section, 'line_name') else (section.line.name if section.line else ''),
                section.name, section.start_km, section.end_km, section.description or '',
                section.tower_count or 0, section.created_at.strftime('%Y-%m-%d %H:%M:%S')
            ])
        return response

    @action(detail=True, methods=['post'])
    def assign_towers(self, request, pk=None):
        if request.user.role not in ['admin', 'superadmin']:
            raise PermissionDenied('只有调度管理员可以分配杆塔')
        section = self.get_object()
        tower_ids = request.data.get('tower_ids', [])
        if not tower_ids:
            return Response({'error': 'tower_ids参数不能为空'}, status=status.HTTP_400_BAD_REQUEST)
        towers = Tower.objects.filter(id__in=tower_ids, line=section.line_id if section.line else None)
        updated = towers.update(section=section)
        return Response({'updated': updated})


class TowerViewSet(viewsets.ModelViewSet):
    queryset = Tower.objects.all()
    permission_classes = [IsAuthenticated]
    serializer_class = TowerSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['line', 'section', 'tower_type']
    search_fields = ['code']
    parser_classes = [MultiPartParser, FormParser]

    def perform_create(self, serializer):
        if self.request.user.role not in ['admin', 'superadmin']:
            raise PermissionDenied('只有调度管理员可以创建杆塔')
        serializer.save()

    def perform_update(self, serializer):
        if self.request.user.role not in ['admin', 'superadmin']:
            raise PermissionDenied('只有调度管理员可以修改杆塔')
        serializer.save()

    def perform_destroy(self, instance):
        if self.request.user.role not in ['admin', 'superadmin']:
            raise PermissionDenied('只有调度管理员可以删除杆塔')
        user = self.request.user
        ChangeHistory.objects.create(
            content_type='tower',
            object_id=instance.id,
            object_name=instance.code,
            action='delete',
            user=user,
            note=f'删除杆塔: {instance.code}',
        )
        instance.delete()

    @action(detail=False, methods=['get'])
    def by_line(self, request):
        line_id = request.query_params.get('line_id')
        if not line_id:
            return Response({'error': 'line_id required'}, status=400)
        towers = self.queryset.filter(line_id=line_id).order_by('sequence')
        serializer = self.get_serializer(towers, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def export(self, request):
        if request.user.role not in ['admin', 'superadmin']:
            raise PermissionDenied('只有调度管理员可以导出数据')
        line_id = request.query_params.get('line_id')
        queryset = self.get_queryset()
        if line_id:
            queryset = queryset.filter(line_id=line_id)
        response = HttpResponse(content_type='text/csv; charset=utf-8-sig')
        response['Content-Disposition'] = 'attachment; filename="towers.csv"'
        writer = csv.writer(response)
        writer.writerow(['ID', '线路名称', '区段名称', '杆塔编号', '杆塔类型', '高度(m)', '序号', '经度', '纬度', '创建时间'])
        for tower in queryset:
            lon = tower.coordinates.get('lon') if hasattr(tower, 'coordinates') and tower.coordinates else (tower.geom.x if tower.geom else '')
            lat = tower.coordinates.get('lat') if hasattr(tower, 'coordinates') and tower.coordinates else (tower.geom.y if tower.geom else '')
            writer.writerow([
                tower.id, tower.line.name if tower.line else '',
                tower.section.name if tower.section else '',
                tower.code, tower.tower_type, tower.height or '', tower.sequence or '',
                lon, lat, tower.created_at.strftime('%Y-%m-%d %H:%M:%S')
            ])
        return response

    @action(detail=False, methods=['post'])
    def import_csv(self, request):
        if request.user.role not in ['admin', 'superadmin']:
            raise PermissionDenied('只有调度管理员可以导入杆塔')
        if 'file' not in request.FILES:
            return Response({'error': '请上传CSV文件'}, status=status.HTTP_400_BAD_REQUEST)
        file = request.FILES['file']
        line_id = request.data.get('line_id')
        if not line_id:
            return Response({'error': '请选择线路'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            line = Line.objects.get(id=line_id)
        except Line.DoesNotExist:
            return Response({'error': '线路不存在'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            decoded_file = file.read().decode('utf-8-sig')
            reader = csv.DictReader(io.StringIO(decoded_file))
        except Exception:
            decoded_file = file.read().decode('gbk', errors='ignore')
            reader = csv.DictReader(io.StringIO(decoded_file))
        created = 0
        errors = []
        try:
            with transaction.atomic():
                for idx, row in enumerate(reader, start=2):
                    try:
                        code = row.get('杆塔编号') or row.get('code') or row.get('编号')
                        lon_str = row.get('经度') or row.get('lon') or row.get('经度(longitude)')
                        lat_str = row.get('纬度') or row.get('lat') or row.get('纬度(latitude)')
                        if not code or not lon_str or not lat_str:
                            errors.append(f'第{idx}行: 缺少必填字段')
                            continue
                        try:
                            lon = float(str(lon_str).strip())
                            lat = float(str(lat_str).strip())
                        except (TypeError, ValueError):
                            errors.append(f'第{idx}行: 经纬度格式不正确')
                            continue
                        if lon < -180 or lon > 180 or lat < -90 or lat > 90:
                            errors.append(f'第{idx}行: 经纬度超出范围')
                            continue
                        tower_type = row.get('杆塔类型') or row.get('tower_type') or 'straight'
                        height_str = row.get('高度(m)') or row.get('height') or row.get('高度')
                        sequence_str = row.get('序号') or row.get('sequence')
                        tower = Tower(
                            line=line,
                            code=str(code).strip(),
                            tower_type=str(tower_type).strip() if tower_type else 'straight',
                            height=float(height_str) if height_str else None,
                            sequence=int(sequence_str) if sequence_str else 0,
                        )
                        point = Point(lon, lat, srid=4326)
                        point = line.snap_point_to_line(point)
                        tower.geom = point
                        tower.save()
                        section = line.get_tower_section(tower)
                        if section:
                            tower.section = section
                            tower.save(update_fields=['section'])
                        created += 1
                        ChangeHistory.objects.create(
                            content_type='tower',
                            object_id=tower.id,
                            object_name=tower.code,
                            action='import',
                            user=request.user,
                            note=f'CSV导入杆塔: {tower.code}',
                        )
                    except Exception as e:
                        errors.append(f'第{idx}行: {str(e)}')
        except Exception as e:
            return Response({'error': f'导入失败: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)
        return Response({
            'created': created,
            'errors': errors,
            'message': f'成功导入{created}基杆塔' + (f', {len(errors)}条错误' if errors else '')
        })


class ChangeHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ChangeHistory.objects.all()
    permission_classes = [IsAuthenticated]
    serializer_class = ChangeHistorySerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['content_type', 'action', 'object_id']
    search_fields = ['object_name', 'note']
