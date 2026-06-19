from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
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


class SectionViewSet(viewsets.ModelViewSet):
    queryset = Section.objects.all().annotate(tower_count=Count('towers'))
    permission_classes = [IsAuthenticated]
    serializer_class = SectionSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['line']


class TowerViewSet(viewsets.ModelViewSet):
    queryset = Tower.objects.all()
    permission_classes = [IsAuthenticated]
    serializer_class = TowerSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['line', 'section', 'tower_type']
    search_fields = ['code']

    @action(detail=False, methods=['get'])
    def by_line(self, request):
        line_id = request.query_params.get('line_id')
        if not line_id:
            return Response({'error': 'line_id required'}, status=400)
        towers = self.queryset.filter(line_id=line_id).order_by('sequence')
        serializer = self.get_serializer(towers, many=True)
        return Response(serializer.data)
