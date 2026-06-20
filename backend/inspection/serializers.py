from rest_framework import serializers
from django.contrib.gis.geos import Point, LineString
from django.contrib.gis.db.models.functions import Distance
from .models import Drone, FlightRoute, FlightRouteVersion, InspectionTask, InspectionMedia, Defect, Alert
from lines.models import Tower, Section


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


class DroneSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Drone
        fields = ['id', 'name', 'model', 'serial_number', 'status', 'status_display',
                  'battery', 'max_flight_time', 'payload', 'created_at']
        read_only_fields = ['id', 'created_at']


class FlightRouteVersionSerializer(serializers.ModelSerializer):
    line_name = serializers.CharField(source='line.name', read_only=True)
    status_display = serializers.CharField(source='status_display', read_only=True)
    waypoint_count = serializers.IntegerField(read_only=True)
    coordinates = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = FlightRouteVersion
        fields = ['id', 'route', 'version', 'name', 'line', 'line_name', 'coordinates',
                  'waypoints_data', 'waypoint_count', 'altitude', 'speed', 'distance',
                  'estimated_duration', 'status', 'status_display', 'description',
                  'created_by', 'created_by_name', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_coordinates(self, obj):
        if obj.waypoints:
            return list(obj.waypoints.coords)
        return []

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.name or obj.created_by.username
        return ''


class FlightRouteListSerializer(serializers.ModelSerializer):
    line_name = serializers.CharField(source='line.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    waypoint_count = serializers.IntegerField(read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = FlightRoute
        fields = ['id', 'name', 'line', 'line_name', 'waypoint_count', 'altitude',
                  'speed', 'distance', 'estimated_duration', 'status', 'status_display',
                  'description', 'version', 'created_by', 'created_by_name', 'created_at']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.name or obj.created_by.username
        return ''


class TowerSimpleSerializer(serializers.ModelSerializer):
    coordinates = serializers.SerializerMethodField()
    section_name = serializers.SerializerMethodField()

    class Meta:
        model = Tower
        fields = ['id', 'code', 'coordinates', 'section', 'section_name', 'height', 'tower_type', 'sequence']

    def get_coordinates(self, obj):
        if obj.geom:
            return {'lon': obj.geom.x, 'lat': obj.geom.y}
        return None

    def get_section_name(self, obj):
        if obj.section:
            return obj.section.name
        return ''


class SectionSimpleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Section
        fields = ['id', 'name', 'start_km', 'end_km']


class FlightRouteDetailSerializer(serializers.ModelSerializer):
    line_name = serializers.CharField(source='line.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    waypoint_count = serializers.IntegerField(read_only=True)
    coordinates = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField()
    altitude_validation = serializers.SerializerMethodField()
    speed_validation = serializers.SerializerMethodField()
    nearby_towers = serializers.SerializerMethodField()
    affected_sections = serializers.SerializerMethodField()
    versions = FlightRouteVersionSerializer(many=True, read_only=True)

    class Meta:
        model = FlightRoute
        fields = ['id', 'name', 'line', 'line_name', 'coordinates', 'waypoints_data',
                  'waypoint_count', 'altitude', 'speed', 'distance',
                  'estimated_duration', 'status', 'status_display', 'version',
                  'review_note', 'reviewed_by', 'reviewed_by_name', 'reviewed_at',
                  'description', 'created_by', 'created_by_name', 'created_at',
                  'updated_at', 'altitude_validation', 'speed_validation',
                  'nearby_towers', 'affected_sections', 'versions']
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at', 'distance', 'estimated_duration']

    def get_coordinates(self, obj):
        if obj.waypoints:
            return list(obj.waypoints.coords)
        return []

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.name or obj.created_by.username
        return ''

    def get_reviewed_by_name(self, obj):
        if obj.reviewed_by:
            return obj.reviewed_by.name or obj.reviewed_by.username
        return ''

    def get_altitude_validation(self, obj):
        return obj.validate_altitude()

    def get_speed_validation(self, obj):
        return obj.validate_speed()

    def get_nearby_towers(self, obj):
        towers = obj.get_nearby_towers()
        return TowerSimpleSerializer(towers, many=True).data

    def get_affected_sections(self, obj):
        sections = obj.get_affected_sections()
        return SectionSimpleSerializer(sections, many=True).data


class FlightRouteSerializer(serializers.ModelSerializer):
    line_name = serializers.CharField(source='line.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    waypoint_count = serializers.IntegerField(read_only=True)
    waypoints_list = serializers.ListField(child=serializers.ListField(child=serializers.FloatField()), write_only=True, required=False)
    coordinates = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = FlightRoute
        fields = ['id', 'name', 'line', 'line_name', 'waypoints', 'coordinates', 'waypoints_data',
                  'waypoints_list', 'waypoint_count', 'altitude', 'speed', 'distance',
                  'estimated_duration', 'status', 'status_display', 'version',
                  'review_note', 'description', 'created_by', 'created_by_name',
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at', 'distance', 'estimated_duration', 'version']
        extra_kwargs = {
            'waypoints': {'write_only': True, 'required': False}
        }

    def get_coordinates(self, obj):
        if obj.waypoints:
            return list(obj.waypoints.coords)
        return []

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.name or obj.created_by.username
        return ''

    def validate_waypoints_list(self, value):
        if value:
            for i, wp in enumerate(value):
                if len(wp) != 2:
                    raise serializers.ValidationError(f'第{i + 1}个坐标点必须包含经度和纬度')
                validate_lon(wp[0])
                validate_lat(wp[1])
            if len(value) < 2:
                raise serializers.ValidationError('至少需要2个航点')
        return value

    def validate_altitude(self, value):
        if value < 0:
            raise serializers.ValidationError('飞行高度不能为负数')
        return value

    def validate_speed(self, value):
        if value <= 0:
            raise serializers.ValidationError('飞行速度必须大于0')
        return value

    def create(self, validated_data):
        waypoints_list = validated_data.pop('waypoints_list', None)
        if waypoints_list and 'waypoints' not in validated_data:
            coords = [(float(wp[0]), float(wp[1])) for wp in waypoints_list]
            validated_data['waypoints'] = LineString(coords, srid=4326)
        validated_data['created_by'] = self.context['request'].user
        instance = super().create(validated_data)
        instance.distance = instance.calculate_distance()
        instance.estimated_duration = instance.calculate_duration()
        instance.save(update_fields=['distance', 'estimated_duration'])
        instance.create_version_snapshot()
        return instance

    def update(self, instance, validated_data):
        waypoints_list = validated_data.pop('waypoints_list', None)
        if waypoints_list:
            coords = [(float(wp[0]), float(wp[1])) for wp in waypoints_list]
            validated_data['waypoints'] = LineString(coords, srid=4326)
        if instance.status == 'approved':
            instance.version += 1
            instance.status = 'draft'
        if 'status' in validated_data and validated_data['status'] == 'approved' and instance.status != 'approved':
            instance.create_version_snapshot()
        instance = super().update(instance, validated_data)
        instance.distance = instance.calculate_distance()
        instance.estimated_duration = instance.calculate_duration()
        instance.save(update_fields=['distance', 'estimated_duration'])
        return instance


class InspectionTaskListSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    route_name = serializers.CharField(source='route.name', read_only=True)
    drone_name = serializers.CharField(source='drone.name', read_only=True)
    pilot_name = serializers.CharField(source='pilot.name', read_only=True)

    class Meta:
        model = InspectionTask
        fields = ['id', 'code', 'name', 'route', 'route_name', 'drone', 'drone_name',
                  'pilot', 'pilot_name', 'status', 'status_display', 'planned_date',
                  'started_at', 'ended_at', 'media_count', 'defect_count',
                  'notes', 'created_at']


class InspectionTaskSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    route_name = serializers.CharField(source='route.name', read_only=True)
    drone_name = serializers.CharField(source='drone.name', read_only=True)
    pilot_name = serializers.CharField(source='pilot.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)

    class Meta:
        model = InspectionTask
        fields = ['id', 'code', 'name', 'route', 'route_name', 'drone', 'drone_name',
                  'pilot', 'pilot_name', 'status', 'status_display', 'planned_date',
                  'started_at', 'ended_at', 'media_count', 'defect_count',
                  'notes', 'created_by', 'created_by_name', 'created_at']
        read_only_fields = ['id', 'code', 'media_count', 'defect_count', 'created_by', 'created_at']

    def validate_route(self, value):
        if value and value.status != 'approved':
            raise serializers.ValidationError('只能选择已审核通过的航线')
        return value

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class InspectionMediaSerializer(serializers.ModelSerializer):
    media_type_display = serializers.CharField(source='get_media_type_display', read_only=True)
    tower_code = serializers.CharField(source='tower.code', read_only=True)
    file_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()
    coordinates = serializers.SerializerMethodField()

    class Meta:
        model = InspectionMedia
        fields = ['id', 'task', 'tower', 'tower_code', 'file', 'file_url',
                  'thumbnail', 'thumbnail_url', 'media_type', 'media_type_display',
                  'geom', 'coordinates', 'captured_at', 'altitude',
                  'has_defect', 'defect_count', 'uploaded_at']
        read_only_fields = ['id', 'uploaded_at']

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return None

    def get_thumbnail_url(self, obj):
        request = self.context.get('request')
        if obj.thumbnail and request:
            return request.build_absolute_uri(obj.thumbnail.url)
        return self.get_file_url(obj)

    def get_coordinates(self, obj):
        if obj.geom:
            return {'lon': obj.geom.x, 'lat': obj.geom.y}
        return None


class DefectListSerializer(serializers.ModelSerializer):
    defect_type_display = serializers.CharField(source='get_defect_type_display', read_only=True)
    severity_display = serializers.CharField(source='get_severity_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    tower_code = serializers.CharField(source='tower.code', read_only=True)
    tower_line = serializers.CharField(source='tower.line.name', read_only=True)
    media_thumbnail = serializers.SerializerMethodField()

    class Meta:
        model = Defect
        fields = ['id', 'media', 'tower', 'tower_code', 'tower_line', 'defect_type',
                  'defect_type_display', 'subtype', 'severity', 'severity_display',
                  'status', 'status_display', 'confidence', 'media_thumbnail',
                  'bbox', 'description', 'created_at']

    def get_media_thumbnail(self, obj):
        request = self.context.get('request')
        if obj.media and obj.media.thumbnail and request:
            return request.build_absolute_uri(obj.media.thumbnail.url)
        if obj.media and obj.media.file and request:
            return request.build_absolute_uri(obj.media.file.url)
        return None


class DefectSerializer(serializers.ModelSerializer):
    defect_type_display = serializers.CharField(source='get_defect_type_display', read_only=True)
    severity_display = serializers.CharField(source='get_severity_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    tower_code = serializers.CharField(source='tower.code', read_only=True)
    tower_line = serializers.CharField(source='tower.line.name', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.name', read_only=True)
    media_detail = InspectionMediaSerializer(source='media', read_only=True)

    class Meta:
        model = Defect
        fields = ['id', 'media', 'media_detail', 'tower', 'tower_code', 'tower_line',
                  'task', 'defect_type', 'defect_type_display', 'subtype',
                  'severity', 'severity_display', 'status', 'status_display',
                  'bbox', 'confidence', 'description', 'review_note',
                  'reviewed_by', 'reviewed_by_name', 'reviewed_at', 'created_at']
        read_only_fields = ['id', 'created_at']


class AlertListSerializer(serializers.ModelSerializer):
    level_display = serializers.CharField(source='get_level_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    tower_code = serializers.CharField(source='tower.code', read_only=True)
    tower_line = serializers.CharField(source='tower.line.name', read_only=True, default=None)

    class Meta:
        model = Alert
        fields = ['id', 'defect', 'tower', 'tower_code', 'tower_line',
                  'category', 'category_display', 'level', 'level_display',
                  'title', 'status', 'status_display', 'created_at']


class AlertSerializer(serializers.ModelSerializer):
    level_display = serializers.CharField(source='get_level_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    tower_code = serializers.CharField(source='tower.code', read_only=True)
    handled_by_name = serializers.CharField(source='handled_by.name', read_only=True)
    defect_detail = DefectListSerializer(source='defect', read_only=True)

    class Meta:
        model = Alert
        fields = ['id', 'defect', 'defect_detail', 'tower', 'tower_code',
                  'category', 'category_display', 'level', 'level_display',
                  'title', 'content', 'status', 'status_display',
                  'handled_by', 'handled_by_name', 'handled_at', 'handle_note',
                  'created_at']
        read_only_fields = ['id', 'created_at']
