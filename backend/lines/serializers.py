from rest_framework import serializers
from django.contrib.gis.geos import Point, LineString
from .models import Line, Section, Tower, ChangeHistory
import json


def validate_lon(value):
    try:
        v = float(value)
        if v < -180 or v > 180:
            raise serializers.ValidationError('经度范围必须在-180到180之间')
    except (TypeError, ValueError):
        raise serializers.ValidationError('经度格式不正确，必须为数字')
    return value


def validate_lat(value):
    try:
        v = float(value)
        if v < -90 or v > 90:
            raise serializers.ValidationError('纬度范围必须在-90到90之间')
    except (TypeError, ValueError):
        raise serializers.ValidationError('纬度格式不正确，必须为数字')
    return value


class ChangeHistorySerializer(serializers.ModelSerializer):
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    content_type_display = serializers.CharField(source='get_content_type_display', read_only=True)
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = ChangeHistory
        fields = ['id', 'content_type', 'content_type_display', 'object_id', 'object_name',
                  'action', 'action_display', 'user', 'user_name', 'changes', 'note', 'created_at']

    def get_user_name(self, obj):
        if obj.user:
            return obj.user.name or obj.user.username
        return ''


class TowerSerializer(serializers.ModelSerializer):
    tower_type_display = serializers.CharField(source='get_tower_type_display', read_only=True)
    lon = serializers.FloatField(write_only=True, required=False, validators=[validate_lon])
    lat = serializers.FloatField(write_only=True, required=False, validators=[validate_lat])
    coordinates = serializers.SerializerMethodField()
    snapped = serializers.BooleanField(write_only=True, required=False, default=True)
    section_name = serializers.SerializerMethodField()

    class Meta:
        model = Tower
        fields = ['id', 'line', 'section', 'section_name', 'code', 'geom', 'coordinates', 'height',
                  'tower_type', 'tower_type_display', 'sequence', 'lon', 'lat', 'snapped',
                  'defect_count', 'created_at', 'updated_at']
        read_only_fields = ['id', 'defect_count', 'created_at', 'updated_at']
        extra_kwargs = {
            'geom': {'write_only': True, 'required': False}
        }

    def get_coordinates(self, obj):
        if obj.geom:
            return {'lon': obj.geom.x, 'lat': obj.geom.y}
        return None

    def get_section_name(self, obj):
        if obj.section:
            return obj.section.name
        return ''

    def create(self, validated_data):
        lon = validated_data.pop('lon', None)
        lat = validated_data.pop('lat', None)
        snapped = validated_data.pop('snapped', True)
        if lon is not None and lat is not None and 'geom' not in validated_data:
            point = Point(float(lon), float(lat), srid=4326)
            if snapped and validated_data.get('line'):
                try:
                    line = Line.objects.get(id=validated_data['line'])
                    point = line.snap_point_to_line(point)
                except Line.DoesNotExist:
                    pass
            validated_data['geom'] = point
        instance = super().create(validated_data)
        if instance.line and not instance.section:
            try:
                line = Line.objects.get(id=instance.line_id)
                section = line.get_tower_section(instance)
                if section:
                    instance.section = section
                    instance.save(update_fields=['section'])
            except Line.DoesNotExist:
                pass
        request = self.context.get('request')
        user = request.user if request and hasattr(request, 'user') else None
        changes = {}
        for field in ['code', 'line', 'section', 'height', 'tower_type', 'sequence']:
            if field in validated_data:
                changes[field] = str(validated_data[field])
        if instance.geom:
            changes['coordinates'] = {'lon': instance.geom.x, 'lat': instance.geom.y}
        ChangeHistory.objects.create(
            content_type='tower',
            object_id=instance.id,
            object_name=instance.code,
            action='create',
            user=user,
            changes=changes,
        )
        return instance

    def update(self, instance, validated_data):
        old_data = {}
        if instance.geom:
            old_data['coordinates'] = {'lon': instance.geom.x, 'lat': instance.geom.y}
        for field in ['code', 'line', 'section', 'height', 'tower_type', 'sequence']:
            old_val = getattr(instance, field, None)
            if old_val is not None:
                old_data[field] = str(old_val)
        lon = validated_data.pop('lon', None)
        lat = validated_data.pop('lat', None)
        snapped = validated_data.pop('snapped', True)
        if lon is not None and lat is not None:
            point = Point(float(lon), float(lat), srid=4326)
            line_id = validated_data.get('line') or instance.line_id
            if snapped and line_id:
                try:
                    line = Line.objects.get(id=line_id)
                    point = line.snap_point_to_line(point)
                except Line.DoesNotExist:
                    pass
            validated_data['geom'] = point
        instance = super().update(instance, validated_data)
        if instance.line and not instance.section:
            try:
                line = Line.objects.get(id=instance.line_id)
                section = line.get_tower_section(instance)
                if section:
                    instance.section = section
                    instance.save(update_fields=['section'])
            except Line.DoesNotExist:
                pass
        request = self.context.get('request')
        user = request.user if request and hasattr(request, 'user') else None
        changes = {}
        for field in ['code', 'line', 'section', 'height', 'tower_type', 'sequence']:
            if field in validated_data:
                changes[field] = {'old': old_data.get(field, ''), 'new': str(validated_data[field])}
        if 'geom' in validated_data and instance.geom:
            changes['coordinates'] = {
                'old': old_data.get('coordinates', {}),
                'new': {'lon': instance.geom.x, 'lat': instance.geom.y}
            }
        if changes:
            ChangeHistory.objects.create(
                content_type='tower',
                object_id=instance.id,
                object_name=instance.code,
                action='update',
                user=user,
                changes=changes,
            )
        return instance


class LineListSerializer(serializers.ModelSerializer):
    voltage_display = serializers.CharField(source='get_voltage_display', read_only=True)
    tower_count = serializers.IntegerField(read_only=True)
    defect_count = serializers.IntegerField(read_only=True)
    coordinates = serializers.SerializerMethodField()

    class Meta:
        model = Line
        fields = ['id', 'name', 'voltage', 'voltage_display', 'tower_count', 'defect_count',
                  'description', 'coordinates', 'created_at', 'updated_at']

    def get_coordinates(self, obj):
        if obj.geom:
            return list(obj.geom.coords)
        return []


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

    def validate_waypoints(self, value):
        if value:
            for wp in value:
                if len(wp) != 2:
                    raise serializers.ValidationError('每个坐标点必须包含经度和纬度')
                validate_lon(wp[0])
                validate_lat(wp[1])
        return value

    def create(self, validated_data):
        waypoints = validated_data.pop('waypoints', None)
        if waypoints and 'geom' not in validated_data:
            coords = [(float(wp[0]), float(wp[1])) for wp in waypoints]
            validated_data['geom'] = LineString(coords, srid=4326)
        instance = super().create(validated_data)
        request = self.context.get('request')
        user = request.user if request and hasattr(request, 'user') else None
        changes = {}
        for field in ['name', 'voltage', 'description']:
            if field in validated_data:
                changes[field] = str(validated_data[field])
        if instance.geom:
            changes['coordinates'] = list(instance.geom.coords)
        ChangeHistory.objects.create(
            content_type='line',
            object_id=instance.id,
            object_name=instance.name,
            action='create',
            user=user,
            changes=changes,
        )
        return instance

    def update(self, instance, validated_data):
        old_data = {}
        if instance.geom:
            old_data['coordinates'] = list(instance.geom.coords)
        for field in ['name', 'voltage', 'description']:
            old_data[field] = str(getattr(instance, field, ''))
        waypoints = validated_data.pop('waypoints', None)
        if waypoints:
            coords = [(float(wp[0]), float(wp[1])) for wp in waypoints]
            validated_data['geom'] = LineString(coords, srid=4326)
        instance = super().update(instance, validated_data)
        request = self.context.get('request')
        user = request.user if request and hasattr(request, 'user') else None
        changes = {}
        for field in ['name', 'voltage', 'description']:
            if field in validated_data:
                changes[field] = {'old': old_data.get(field, ''), 'new': str(validated_data[field])}
        if 'geom' in validated_data and instance.geom:
            changes['coordinates'] = {
                'old': old_data.get('coordinates', []),
                'new': list(instance.geom.coords)
            }
        if changes:
            ChangeHistory.objects.create(
                content_type='line',
                object_id=instance.id,
                object_name=instance.name,
                action='update',
                user=user,
                changes=changes,
            )
        return instance


class LineDetailSerializer(LineSerializer):
    towers = TowerSerializer(many=True, read_only=True)

    class Meta(LineSerializer.Meta):
        fields = LineSerializer.Meta.fields + ['towers']


class SectionSerializer(serializers.ModelSerializer):
    line_name = serializers.SerializerMethodField()
    tower_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Section
        fields = ['id', 'line', 'line_name', 'name', 'start_km', 'end_km', 'description', 'tower_count', 'created_at']

    def get_line_name(self, obj):
        return obj.line.name if obj.line else ''

    def create(self, validated_data):
        instance = super().create(validated_data)
        request = self.context.get('request')
        user = request.user if request and hasattr(request, 'user') else None
        changes = {}
        for field in ['name', 'line', 'start_km', 'end_km', 'description']:
            if field in validated_data:
                changes[field] = str(validated_data[field])
        ChangeHistory.objects.create(
            content_type='section',
            object_id=instance.id,
            object_name=instance.name,
            action='create',
            user=user,
            changes=changes,
        )
        return instance

    def update(self, instance, validated_data):
        old_data = {}
        for field in ['name', 'line', 'start_km', 'end_km', 'description']:
            old_data[field] = str(getattr(instance, field, ''))
        instance = super().update(instance, validated_data)
        request = self.context.get('request')
        user = request.user if request and hasattr(request, 'user') else None
        changes = {}
        for field in ['name', 'line', 'start_km', 'end_km', 'description']:
            if field in validated_data:
                changes[field] = {'old': old_data.get(field, ''), 'new': str(validated_data[field])}
        if changes:
            ChangeHistory.objects.create(
                content_type='section',
                object_id=instance.id,
                object_name=instance.name,
                action='update',
                user=user,
                changes=changes,
            )
        return instance
