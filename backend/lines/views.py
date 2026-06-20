from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from django.contrib.gis.db.models.functions import Distance
from django.db.models import Count
from django_filters.rest_framework import DjangoFilterBackend

from .models import Line, Section, Tower
from .serializers import (
    LineSerializer, LineListSerializer, LineDetailSerializer,
    SectionSerializer, TowerSerializer
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
        if self.request.user.role != 'admin':
            raise PermissionDenied('只有调度管理员可以创建线路')
        serializer.save()

    def perform_update(self, serializer):
        if self.request.user.role != 'admin':
            raise PermissionDenied('只有调度管理员可以修改线路')
        serializer.save()

    def perform_destroy(self, instance):
        if self.request.user.role != 'admin':
            raise PermissionDenied('只有调度管理员可以删除线路')
        instance.delete()


class SectionViewSet(viewsets.ModelViewSet):
    queryset = Section.objects.all().annotate(tower_count=Count('towers'))
    permission_classes = [IsAuthenticated]
    serializer_class = SectionSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['line']

    def perform_create(self, serializer):
        if self.request.user.role != 'admin':
            raise PermissionDenied('只有调度管理员可以创建区段')
        serializer.save()

    def perform_update(self, serializer):
        if self.request.user.role != 'admin':
            raise PermissionDenied('只有调度管理员可以修改区段')
        serializer.save()

    def perform_destroy(self, instance):
        if self.request.user.role != 'admin':
            raise PermissionDenied('只有调度管理员可以删除区段')
        instance.delete()


class TowerViewSet(viewsets.ModelViewSet):
    queryset = Tower.objects.all()
    permission_classes = [IsAuthenticated]
    serializer_class = TowerSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['line', 'section', 'tower_type']
    search_fields = ['code']

    def perform_create(self, serializer):
        if self.request.user.role != 'admin':
            raise PermissionDenied('只有调度管理员可以创建杆塔')
        serializer.save()

    def perform_update(self, serializer):
        if self.request.user.role != 'admin':
            raise PermissionDenied('只有调度管理员可以修改杆塔')
        serializer.save()

    def perform_destroy(self, instance):
        if self.request.user.role != 'admin':
            raise PermissionDenied('只有调度管理员可以删除杆塔')
        instance.delete()

    @action(detail=False, methods=['get'])
    def by_line(self, request):
        line_id = request.query_params.get('line_id')
        if not line_id:
            return Response({'error': 'line_id required'}, status=400)
        towers = self.queryset.filter(line_id=line_id).order_by('sequence')
        serializer = self.get_serializer(towers, many=True)
        return Response(serializer.data)
