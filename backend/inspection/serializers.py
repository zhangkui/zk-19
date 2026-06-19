from rest_framework import serializers
from django.contrib.gis.geos import Point, LineString
from .models import Drone, FlightRoute, InspectionTask, InspectionMedia, Defect, Alert


class DroneSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Drone
        fields = ['id', 'name', 'model', 'serial_number', 'status', 'status_display',
                  'battery', 'max_flight_time', 'payload', 'created_at']
        read_only_fields = ['id', 'created_at']


class FlightRouteListSerializer(serializers.ModelSerializer):
    line_name = serializers.CharField(source='line.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    waypoint_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = FlightRoute
        fields = ['id', 'name', 'line', 'line_name', 'waypoint_count', 'altitude',
                  'speed', 'estimated_duration', 'status', 'status_display',
                  'description', 'created_at']


class FlightRouteSerializer(serializers.ModelSerializer):
    line_name = serializers.CharField(source='line.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    waypoint_count = serializers.IntegerField(read_only=True)
    waypoints_list = serializers.ListField(child=serializers.ListField(child=serializers.FloatField()), write_only=True, required=False)
    coordinates = serializers.SerializerMethodField()

    class Meta:
        model = FlightRoute
        fields = ['id', 'name', 'line', 'line_name', 'waypoints', 'coordinates', 'waypoints_data',
                  'waypoints_list', 'waypoint_count', 'altitude', 'speed',
                  'estimated_duration', 'status', 'status_display', 'description',
                  'created_by', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']
        extra_kwargs = {
            'waypoints': {'write_only': True, 'required': False}
        }

    def get_coordinates(self, obj):
        if obj.waypoints:
            return list(obj.waypoints.coords)
        return []

    def create(self, validated_data):
        waypoints_list = validated_data.pop('waypoints_list', None)
        if waypoints_list and 'waypoints' not in validated_data:
            coords = [(wp[0], wp[1]) for wp in waypoints_list]
            validated_data['waypoints'] = LineString(coords, srid=4326)
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        waypoints_list = validated_data.pop('waypoints_list', None)
        if waypoints_list:
            coords = [(wp[0], wp[1]) for wp in waypoints_list]
            validated_data['waypoints'] = LineString(coords, srid=4326)
        return super().update(instance, validated_data)


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
