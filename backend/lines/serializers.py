from rest_framework import serializers
from django.contrib.gis.geos import Point, LineString
from .models import Line, Section, Tower
import json


class TowerSerializer(serializers.ModelSerializer):
    tower_type_display = serializers.CharField(source='get_tower_type_display', read_only=True)
    lon = serializers.FloatField(write_only=True, required=False)
    lat = serializers.FloatField(write_only=True, required=False)
    coordinates = serializers.SerializerMethodField()

    class Meta:
        model = Tower
        fields = ['id', 'line', 'section', 'code', 'geom', 'coordinates', 'height',
                  'tower_type', 'tower_type_display', 'sequence', 'lon', 'lat', 'defect_count', 'created_at']
        read_only_fields = ['id', 'defect_count', 'created_at']
        extra_kwargs = {
            'geom': {'write_only': True, 'required': False}
        }

    def get_coordinates(self, obj):
        if obj.geom:
            return {'lon': obj.geom.x, 'lat': obj.geom.y}
        return None

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        return ret

    def create(self, validated_data):
        lon = validated_data.pop('lon', None)
        lat = validated_data.pop('lat', None)
        if lon is not None and lat is not None and 'geom' not in validated_data:
            validated_data['geom'] = Point(lon, lat, srid=4326)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        lon = validated_data.pop('lon', None)
        lat = validated_data.pop('lat', None)
        if lon is not None and lat is not None:
            validated_data['geom'] = Point(lon, lat, srid=4326)
        return super().update(instance, validated_data)


class LineListSerializer(serializers.ModelSerializer):
    voltage_display = serializers.CharField(source='get_voltage_display', read_only=True)
    tower_count = serializers.IntegerField(read_only=True)
    defect_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Line
        fields = ['id', 'name', 'voltage', 'voltage_display', 'tower_count', 'defect_count', 'description', 'created_at']


class LineSerializer(serializers.ModelSerializer):
    voltage_display = serializers.CharField(source='get_voltage_display', read_only=True)
    tower_count = serializers.IntegerField(read_only=True)
    defect_count = serializers.IntegerField(read_only=True)
    waypoints = serializers.ListField(child=serializers.ListField(child=serializers.FloatField()), write_only=True, required=False)
    coordinates = serializers.SerializerMethodField()

    class Meta:
        model = Line
        fields = ['id', 'name', 'voltage', 'voltage_display', 'geom', 'coordinates', 'tower_count', 'defect_count',
                  'description', 'waypoints', 'created_at', 'updated_at']
        extra_kwargs = {
            'geom': {'write_only': True, 'required': False}
        }

    def get_coordinates(self, obj):
        if obj.geom:
            return list(obj.geom.coords)
        return []

    def create(self, validated_data):
        waypoints = validated_data.pop('waypoints', None)
        if waypoints and 'geom' not in validated_data:
            coords = [(wp[0], wp[1]) for wp in waypoints]
            validated_data['geom'] = LineString(coords, srid=4326)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        waypoints = validated_data.pop('waypoints', None)
        if waypoints:
            coords = [(wp[0], wp[1]) for wp in waypoints]
            validated_data['geom'] = LineString(coords, srid=4326)
        return super().update(instance, validated_data)


class LineDetailSerializer(LineSerializer):
    towers = TowerSerializer(many=True, read_only=True)

    class Meta(LineSerializer.Meta):
        fields = LineSerializer.Meta.fields + ['towers']


class SectionSerializer(serializers.ModelSerializer):
    line_name = serializers.CharField(source='line.name', read_only=True)
    tower_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Section
        fields = ['id', 'line', 'line_name', 'name', 'start_km', 'end_km', 'description', 'tower_count', 'created_at']
