from rest_framework import serializers
from .models import SectionDefectStat, LineDefectStat
from lines.models import Tower


class SectionDefectStatSerializer(serializers.ModelSerializer):
    section_name = serializers.CharField(source='section.name', read_only=True)
    line_name = serializers.CharField(source='line.name', read_only=True)

    class Meta:
        model = SectionDefectStat
        fields = ['id', 'section', 'section_name', 'line', 'line_name',
                  'total_defects', 'critical_count', 'major_count', 'minor_count',
                  'trend_data', 'last_updated']


class TowerDefectRankSerializer(serializers.ModelSerializer):
    line_name = serializers.CharField(source='line.name', read_only=True)
    defect_count = serializers.IntegerField(read_only=True)
    coordinates = serializers.SerializerMethodField()

    class Meta:
        model = Tower
        fields = ['id', 'code', 'line_name', 'defect_count', 'coordinates']

    def get_coordinates(self, obj):
        if obj.geom:
            return {'lon': obj.geom.x, 'lat': obj.geom.y}
        return None


class LineDefectStatSerializer(serializers.ModelSerializer):
    line_name = serializers.CharField(source='line.name', read_only=True)

    class Meta:
        model = LineDefectStat
        fields = ['id', 'line', 'line_name', 'total_defects', 'critical_count',
                  'major_count', 'minor_count', 'tower_count', 'defect_rate', 'last_updated']


class TrendDataSerializer(serializers.Serializer):
    date = serializers.DateField()
    count = serializers.IntegerField()
