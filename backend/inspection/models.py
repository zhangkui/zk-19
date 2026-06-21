from django.contrib.gis.db import models
from django.db.models import JSONField
from django.contrib.gis.geos import Point, LineString
from django.contrib.gis.db.models.functions import Distance
from lines.models import Line, Tower, Section
from accounts.models import User
from decimal import Decimal
import math


class Drone(models.Model):
    STATUS_CHOICES = [
        ('idle', '空闲'),
        ('busy', '作业中'),
        ('maintenance', '维护中'),
        ('offline', '离线'),
    ]

    REPORT_TYPE_CHOICES = [
        ('heartbeat', '心跳上报'),
        ('telemetry', '遥测上报'),
        ('media', '媒体上报'),
        ('event', '事件上报'),
        ('task_summary', '任务汇总上报'),
    ]

    name = models.CharField(max_length=100, verbose_name='无人机名称')
    model = models.CharField(max_length=100, verbose_name='型号')
    serial_number = models.CharField(max_length=100, unique=True, verbose_name='序列号')
    firmware_version = models.CharField(max_length=50, blank=True, default='v1.0.0', verbose_name='固件版本')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='idle', verbose_name='状态')
    battery = models.IntegerField(default=100, verbose_name='电量(%)')
    signal_strength = models.IntegerField(default=100, verbose_name='信号强度(%)')
    altitude = models.FloatField(default=0, verbose_name='高度(m)')
    speed = models.FloatField(default=0, verbose_name='速度(m/s)')
    heading = models.FloatField(default=0, verbose_name='航向(度)')
    latitude = models.FloatField(null=True, blank=True, verbose_name='纬度')
    longitude = models.FloatField(null=True, blank=True, verbose_name='经度')
    last_heartbeat = models.DateTimeField(null=True, blank=True, verbose_name='最后心跳时间')
    last_report_time = models.DateTimeField(null=True, blank=True, verbose_name='最后上报时间')
    last_report_type = models.CharField(max_length=20, choices=REPORT_TYPE_CHOICES, blank=True, verbose_name='最后上报类型')
    current_task_id = models.IntegerField(null=True, blank=True, verbose_name='当前任务ID')
    current_route_id = models.IntegerField(null=True, blank=True, verbose_name='当前航线ID')
    current_line_id = models.IntegerField(null=True, blank=True, verbose_name='当前线路ID')
    max_flight_time = models.IntegerField(default=30, verbose_name='最大续航(分钟)')
    payload = models.CharField(max_length=200, blank=True, verbose_name='载荷')
    mqtt_token = models.CharField(max_length=100, blank=True, verbose_name='MQTT认证Token')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'inspection_drone'
        verbose_name = '无人机'
        verbose_name_plural = '无人机'

    def __str__(self):
        return f'{self.name} ({self.model})'

    def is_online(self):
        if not self.last_heartbeat:
            return False
        from django.utils import timezone
        return (timezone.now() - self.last_heartbeat).total_seconds() < 60


class DroneTelemetry(models.Model):
    drone = models.ForeignKey(Drone, on_delete=models.CASCADE, related_name='telemetries', verbose_name='无人机')
    report_time = models.DateTimeField(verbose_name='上报时间')
    latitude = models.FloatField(verbose_name='纬度')
    longitude = models.FloatField(verbose_name='经度')
    altitude = models.FloatField(default=0, verbose_name='高度(m)')
    speed = models.FloatField(default=0, verbose_name='速度(m/s)')
    heading = models.FloatField(default=0, verbose_name='航向(度)')
    battery = models.IntegerField(default=100, verbose_name='电量(%)')
    signal_strength = models.IntegerField(default=100, verbose_name='信号强度(%)')
    satellites = models.IntegerField(default=0, verbose_name='卫星数')
    temperature = models.FloatField(null=True, blank=True, verbose_name='温度(℃)')
    wind_speed = models.FloatField(null=True, blank=True, verbose_name='风速(m/s)')
    extra_data = JSONField(default=dict, blank=True, verbose_name='扩展数据')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'inspection_drone_telemetry'
        verbose_name = '无人机遥测数据'
        verbose_name_plural = '无人机遥测数据'
        ordering = ['-report_time']

    def __str__(self):
        return f'{self.drone.name} - {self.report_time}'


class DroneEvent(models.Model):
    EVENT_LEVEL_CHOICES = [
        ('info', '信息'),
        ('warning', '警告'),
        ('error', '异常'),
        ('critical', '严重'),
    ]

    EVENT_CATEGORY_CHOICES = [
        ('battery', '电量异常'),
        ('signal', '信号异常'),
        ('weather', '气象异常'),
        ('flight', '飞行异常'),
        ('device', '设备故障'),
        ('obstacle', '避障告警'),
        ('other', '其他'),
    ]

    drone = models.ForeignKey(Drone, on_delete=models.CASCADE, related_name='events', verbose_name='无人机')
    report_time = models.DateTimeField(verbose_name='上报时间')
    event_level = models.CharField(max_length=20, choices=EVENT_LEVEL_CHOICES, default='info', verbose_name='事件级别')
    event_category = models.CharField(max_length=30, choices=EVENT_CATEGORY_CHOICES, default='other', verbose_name='事件类别')
    event_code = models.CharField(max_length=50, blank=True, verbose_name='事件代码')
    title = models.CharField(max_length=200, verbose_name='事件标题')
    description = models.TextField(blank=True, verbose_name='事件描述')
    latitude = models.FloatField(null=True, blank=True, verbose_name='纬度')
    longitude = models.FloatField(null=True, blank=True, verbose_name='经度')
    altitude = models.FloatField(null=True, blank=True, verbose_name='高度(m)')
    handled = models.BooleanField(default=False, verbose_name='是否已处理')
    handled_note = models.TextField(blank=True, verbose_name='处理说明')
    handled_at = models.DateTimeField(null=True, blank=True, verbose_name='处理时间')
    extra_data = JSONField(default=dict, blank=True, verbose_name='扩展数据')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'inspection_drone_event'
        verbose_name = '无人机事件'
        verbose_name_plural = '无人机事件'
        ordering = ['-report_time']

    def __str__(self):
        return f'{self.drone.name} - {self.get_event_level_display()} - {self.title}'


class DroneMediaReport(models.Model):
    MEDIA_TYPE_CHOICES = [
        ('image', '图片'),
        ('video', '视频'),
        ('panorama', '全景图'),
    ]

    drone = models.ForeignKey(Drone, on_delete=models.CASCADE, related_name='media_reports', verbose_name='无人机')
    task = models.ForeignKey('InspectionTask', on_delete=models.SET_NULL, null=True, blank=True, related_name='media_reports', verbose_name='巡检任务')
    report_time = models.DateTimeField(verbose_name='上报时间')
    media_type = models.CharField(max_length=20, choices=MEDIA_TYPE_CHOICES, default='image', verbose_name='媒体类型')
    file_name = models.CharField(max_length=255, verbose_name='文件名')
    file_url = models.URLField(max_length=500, verbose_name='文件访问链接')
    thumbnail_url = models.URLField(max_length=500, blank=True, verbose_name='缩略图链接')
    file_size = models.BigIntegerField(default=0, verbose_name='文件大小(字节)')
    duration = models.IntegerField(default=0, verbose_name='时长(秒)')
    latitude = models.FloatField(null=True, blank=True, verbose_name='纬度')
    longitude = models.FloatField(null=True, blank=True, verbose_name='经度')
    altitude = models.FloatField(null=True, blank=True, verbose_name='高度(m)')
    heading = models.FloatField(null=True, blank=True, verbose_name='航向(度)')
    tower_id = models.IntegerField(null=True, blank=True, verbose_name='关联杆塔ID')
    uploaded = models.BooleanField(default=False, verbose_name='是否已入库')
    media_id = models.IntegerField(null=True, blank=True, verbose_name='对应影像ID')
    extra_data = JSONField(default=dict, blank=True, verbose_name='扩展数据')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'inspection_drone_media_report'
        verbose_name = '无人机媒体上报'
        verbose_name_plural = '无人机媒体上报'
        ordering = ['-report_time']

    def __str__(self):
        return f'{self.drone.name} - {self.get_media_type_display()} - {self.file_name}'


class DroneTaskSummary(models.Model):
    TASK_STATUS_CHOICES = [
        ('takeoff', '起飞'),
        ('climbing', '爬升中'),
        ('cruising', '巡航中'),
        ('turning', '转弯中'),
        ('descending', '下降中'),
        ('landing', '降落中'),
        ('paused', '暂停'),
        ('returning', '返航中'),
        ('completed', '任务完成'),
        ('aborted', '任务中止'),
        ('error', '异常中断'),
    ]

    drone = models.ForeignKey(Drone, on_delete=models.CASCADE, related_name='task_summaries', verbose_name='无人机')
    task = models.ForeignKey('InspectionTask', on_delete=models.CASCADE, related_name='task_summaries', verbose_name='巡检任务')
    route = models.ForeignKey('FlightRoute', on_delete=models.SET_NULL, null=True, blank=True, related_name='task_summaries', verbose_name='飞行航线')
    report_time = models.DateTimeField(verbose_name='上报时间')
    task_status = models.CharField(max_length=20, choices=TASK_STATUS_CHOICES, verbose_name='任务状态')
    flight_phase = models.CharField(max_length=50, blank=True, verbose_name='飞行阶段')
    current_waypoint_index = models.IntegerField(default=0, verbose_name='当前航点索引')
    total_waypoints = models.IntegerField(default=0, verbose_name='总航点数')
    progress = models.FloatField(default=0, verbose_name='任务进度(%)')
    flight_distance = models.FloatField(default=0, verbose_name='已飞行距离(m)')
    remaining_distance = models.FloatField(default=0, verbose_name='剩余距离(m)')
    elapsed_time = models.IntegerField(default=0, verbose_name='已用时间(秒)')
    remaining_time = models.IntegerField(default=0, verbose_name='预计剩余时间(秒)')
    photos_taken = models.IntegerField(default=0, verbose_name='已拍摄照片数')
    videos_recorded = models.IntegerField(default=0, verbose_name='已录制视频数')
    battery_used = models.IntegerField(default=0, verbose_name='已消耗电量(%)')
    latitude = models.FloatField(null=True, blank=True, verbose_name='纬度')
    longitude = models.FloatField(null=True, blank=True, verbose_name='经度')
    altitude = models.FloatField(default=0, verbose_name='高度(m)')
    speed = models.FloatField(default=0, verbose_name='速度(m/s)')
    heading = models.FloatField(default=0, verbose_name='航向(度)')
    extra_data = JSONField(default=dict, blank=True, verbose_name='扩展数据')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'inspection_drone_task_summary'
        verbose_name = '无人机任务汇总'
        verbose_name_plural = '无人机任务汇总'
        ordering = ['-report_time']

    def __str__(self):
        return f'{self.drone.name} - {self.task.code} - {self.get_task_status_display()}'


class FlightRoute(models.Model):
    STATUS_CHOICES = [
        ('draft', '草稿'),
        ('pending_review', '待审核'),
        ('approved', '已审批'),
        ('rejected', '已驳回'),
        ('archived', '已归档'),
    ]

    name = models.CharField(max_length=120, verbose_name='航线名称')
    line = models.ForeignKey(Line, on_delete=models.CASCADE, related_name='flight_routes', verbose_name='所属线路')
    waypoints = models.LineStringField(srid=4326, null=True, blank=True, verbose_name='航点轨迹')
    waypoints_data = JSONField(default=list, blank=True, verbose_name='航点详情')
    altitude = models.FloatField(default=50, verbose_name='飞行高度(m)')
    speed = models.FloatField(default=8, verbose_name='飞行速度(m/s)')
    distance = models.FloatField(default=0, verbose_name='航线长度(米)')
    estimated_duration = models.IntegerField(default=0, verbose_name='预计时长(分钟)')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft', verbose_name='状态')
    version = models.IntegerField(default=1, verbose_name='版本号')
    review_note = models.TextField(blank=True, verbose_name='审核意见')
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_routes', verbose_name='审核人')
    reviewed_at = models.DateTimeField(null=True, blank=True, verbose_name='审核时间')
    description = models.TextField(blank=True, verbose_name='描述')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_routes', verbose_name='创建人')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'inspection_flightroute'
        verbose_name = '飞行航线'
        verbose_name_plural = '飞行航线'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} (v{self.version})'

    @property
    def waypoint_count(self):
        if self.waypoints_data:
            return len(self.waypoints_data)
        if self.waypoints:
            return len(self.waypoints.coords)
        return 0

    @property
    def total_length_km(self):
        if self.waypoints:
            geog = self.waypoints.transform(4326, clone=True)
            return geog.length * 111
        return 0

    def calculate_distance(self):
        if not self.waypoints or len(self.waypoints.coords) < 2:
            return 0
        coords = self.waypoints.coords
        total_distance = 0
        for i in range(len(coords) - 1):
            lon1, lat1 = coords[i]
            lon2, lat2 = coords[i + 1]
            R = 6371000
            phi1 = math.radians(lat1)
            phi2 = math.radians(lat2)
            delta_phi = math.radians(lat2 - lat1)
            delta_lambda = math.radians(lon2 - lon1)
            a = math.sin(delta_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
            c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
            total_distance += R * c
        return round(total_distance, 2)

    def calculate_duration(self):
        distance = self.calculate_distance()
        if distance <= 0 or self.speed <= 0:
            return 0
        duration_seconds = distance / self.speed
        return math.ceil(duration_seconds / 60)

    def validate_altitude(self):
        min_altitude = 30
        max_altitude = 120
        if self.altitude < min_altitude:
            return {'valid': False, 'message': f'飞行高度过低，建议不低于{min_altitude}米'}
        if self.altitude > max_altitude:
            return {'valid': False, 'message': f'飞行高度过高，建议不超过{max_altitude}米'}
        return {'valid': True, 'message': '高度合理'}

    def validate_speed(self):
        min_speed = 2
        max_speed = 15
        if self.speed < min_speed:
            return {'valid': False, 'message': f'飞行速度过慢，建议不低于{min_speed}m/s'}
        if self.speed > max_speed:
            return {'valid': False, 'message': f'飞行速度过快，建议不超过{max_speed}m/s'}
        return {'valid': True, 'message': '速度合理'}

    def get_nearby_towers(self, distance_threshold=50):
        if not self.waypoints or not self.line:
            return []
        towers = []
        for coord in self.waypoints.coords:
            point = Point(coord[0], coord[1], srid=4326)
            nearby = Tower.objects.filter(
                line=self.line,
                geom__isnull=False
            ).annotate(
                distance=Distance('geom', point)
            ).filter(
                distance__lte=distance_threshold
            ).order_by('distance')
            for tower in nearby:
                if tower.id not in [t.id for t in towers]:
                    towers.append(tower)
        return towers

    def get_affected_sections(self, distance_threshold=50):
        towers = self.get_nearby_towers(distance_threshold)
        sections = []
        for tower in towers:
            if tower.section and tower.section.id not in [s.id for s in sections]:
                sections.append(tower.section)
        return sections

    def create_version_snapshot(self):
        FlightRouteVersion.objects.create(
            route=self,
            version=self.version,
            name=self.name,
            line=self.line,
            waypoints=self.waypoints,
            waypoints_data=self.waypoints_data,
            altitude=self.altitude,
            speed=self.speed,
            distance=self.distance,
            estimated_duration=self.estimated_duration,
            status=self.status,
            description=self.description,
            created_by=self.created_by,
        )


class FlightRouteVersion(models.Model):
    route = models.ForeignKey(FlightRoute, on_delete=models.CASCADE, related_name='versions', verbose_name='航线')
    version = models.IntegerField(verbose_name='版本号')
    name = models.CharField(max_length=120, verbose_name='航线名称')
    line = models.ForeignKey(Line, on_delete=models.CASCADE, related_name='route_versions', verbose_name='所属线路')
    waypoints = models.LineStringField(srid=4326, null=True, blank=True, verbose_name='航点轨迹')
    waypoints_data = JSONField(default=list, blank=True, verbose_name='航点详情')
    altitude = models.FloatField(default=50, verbose_name='飞行高度(m)')
    speed = models.FloatField(default=8, verbose_name='飞行速度(m/s)')
    distance = models.FloatField(default=0, verbose_name='航线长度(米)')
    estimated_duration = models.IntegerField(default=0, verbose_name='预计时长(分钟)')
    status = models.CharField(max_length=20, choices=FlightRoute.STATUS_CHOICES, default='draft', verbose_name='状态')
    description = models.TextField(blank=True, verbose_name='描述')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, verbose_name='创建人')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'inspection_flightrouteversion'
        verbose_name = '航线版本'
        verbose_name_plural = '航线版本'
        ordering = ['route', '-version']
        unique_together = ['route', 'version']

    def __str__(self):
        return f'{self.route.name} v{self.version}'

    @property
    def waypoint_count(self):
        if self.waypoints_data:
            return len(self.waypoints_data)
        if self.waypoints:
            return len(self.waypoints.coords)
        return 0

    @property
    def status_display(self):
        return dict(FlightRoute.STATUS_CHOICES).get(self.status, self.status)


class InspectionTask(models.Model):
    STATUS_CHOICES = [
        ('pending', '待执行'),
        ('running', '执行中'),
        ('paused', '已暂停'),
        ('completed', '已完成'),
        ('cancelled', '已取消'),
    ]

    code = models.CharField(max_length=60, unique=True, verbose_name='任务编号')
    name = models.CharField(max_length=120, verbose_name='任务名称')
    route = models.ForeignKey(FlightRoute, on_delete=models.SET_NULL, null=True, blank=True, related_name='tasks', verbose_name='航线')
    drone = models.ForeignKey(Drone, on_delete=models.SET_NULL, null=True, blank=True, related_name='tasks', verbose_name='无人机')
    pilot = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='pilot_tasks', verbose_name='飞手')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name='状态')
    planned_date = models.DateField(null=True, blank=True, verbose_name='计划日期')
    started_at = models.DateTimeField(null=True, blank=True, verbose_name='开始时间')
    ended_at = models.DateTimeField(null=True, blank=True, verbose_name='结束时间')
    media_count = models.IntegerField(default=0, verbose_name='影像数量')
    defect_count = models.IntegerField(default=0, verbose_name='缺陷数量')
    notes = models.TextField(blank=True, verbose_name='备注')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_tasks', verbose_name='创建人')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'inspection_task'
        verbose_name = '巡检任务'
        verbose_name_plural = '巡检任务'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.code} - {self.name}'


class InspectionMedia(models.Model):
    MEDIA_TYPES = [
        ('image', '图片'),
        ('video', '视频'),
    ]

    task = models.ForeignKey(InspectionTask, on_delete=models.CASCADE, related_name='media', verbose_name='巡检任务')
    tower = models.ForeignKey(Tower, on_delete=models.SET_NULL, null=True, blank=True, related_name='media', verbose_name='杆塔')
    file = models.FileField(upload_to='inspection/%Y/%m/%d/', blank=True, verbose_name='文件')
    media_type = models.CharField(max_length=10, choices=MEDIA_TYPES, default='image', verbose_name='类型')
    thumbnail = models.ImageField(upload_to='inspection/thumbs/%Y/%m/%d/', null=True, blank=True, verbose_name='缩略图')
    geom = models.PointField(srid=4326, null=True, blank=True, verbose_name='拍摄位置')
    captured_at = models.DateTimeField(null=True, blank=True, verbose_name='拍摄时间')
    altitude = models.FloatField(null=True, blank=True, verbose_name='飞行高度(m)')
    has_defect = models.BooleanField(default=False, verbose_name='是否有缺陷')
    defect_count = models.IntegerField(default=0, verbose_name='缺陷数量')
    extra_data = JSONField(default=dict, blank=True, verbose_name='扩展数据')
    uploaded_at = models.DateTimeField(auto_now_add=True, verbose_name='上传时间')

    class Meta:
        db_table = 'inspection_media'
        verbose_name = '巡检影像'
        verbose_name_plural = '巡检影像'
        ordering = ['-captured_at', '-uploaded_at']

    def __str__(self):
        return f'Media #{self.id} - {self.task.code}'


class Defect(models.Model):
    TYPE_CHOICES = [
        ('insulator', '绝缘子'),
        ('tower', '塔体'),
        ('hardware', '金具'),
        ('conductor', '导线'),
        ('other', '其他'),
    ]

    SUBTYPE_CHOICES = {
        'insulator': [
            ('breakage', '破损'),
            ('tilt', '串歪斜'),
            ('pollution', '污秽'),
            ('missing', '缺失'),
        ],
        'tower': [
            ('rust', '锈蚀'),
            ('bolt_missing', '螺栓缺失'),
            ('deformation', '变形'),
            ('crack', '裂纹'),
        ],
        'hardware': [
            ('loose', '松动'),
            ('rust', '锈蚀'),
            ('damage', '损坏'),
        ],
        'conductor': [
            ('broken_strand', '断股'),
            ('discharge', '放电痕迹'),
            ('foreign_matter', '异物悬挂'),
        ],
        'other': [
            ('other', '其他'),
        ],
    }

    SEVERITY_CHOICES = [
        ('critical', '危急'),
        ('major', '重大'),
        ('minor', '一般'),
    ]

    STATUS_CHOICES = [
        ('pending', '待审核'),
        ('confirmed', '已确认'),
        ('rejected', '已驳回'),
    ]

    media = models.ForeignKey(InspectionMedia, on_delete=models.CASCADE, related_name='defects', verbose_name='影像')
    tower = models.ForeignKey(Tower, on_delete=models.CASCADE, related_name='defects', verbose_name='杆塔')
    task = models.ForeignKey(InspectionTask, on_delete=models.CASCADE, related_name='defects', null=True, blank=True, verbose_name='巡检任务')
    defect_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='insulator', verbose_name='缺陷类型')
    subtype = models.CharField(max_length=40, verbose_name='缺陷子类')
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default='minor', verbose_name='严重程度')
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='pending', verbose_name='状态')
    bbox = JSONField(default=dict, blank=True, verbose_name='缺陷框')
    confidence = models.FloatField(default=0.0, verbose_name='AI置信度')
    description = models.TextField(blank=True, verbose_name='缺陷描述')
    review_note = models.TextField(blank=True, verbose_name='审核意见')
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_defects', verbose_name='审核人')
    reviewed_at = models.DateTimeField(null=True, blank=True, verbose_name='审核时间')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'inspection_defect'
        verbose_name = '缺陷'
        verbose_name_plural = '缺陷'
        ordering = ['-created_at']

    def __str__(self):
        return f'#{self.id} {self.get_defect_type_display()}-{self.subtype}'

    def get_subtype_display(self):
        subtypes = self.SUBTYPE_CHOICES.get(self.defect_type, [])
        for key, value in subtypes:
            if key == self.subtype:
                return value
        return self.subtype


class Alert(models.Model):
    LEVEL_CHOICES = [
        ('critical', '危急'),
        ('major', '重大'),
        ('minor', '一般'),
    ]

    STATUS_CHOICES = [
        ('open', '待处置'),
        ('processing', '处理中'),
        ('handled', '已处置'),
        ('closed', '已关闭'),
    ]

    CATEGORY_CHOICES = [
        ('defect', '缺陷告警'),
        ('device', '设备告警'),
        ('weather', '气象告警'),
        ('other', '其他'),
    ]

    defect = models.ForeignKey(Defect, on_delete=models.CASCADE, null=True, blank=True, related_name='alerts', verbose_name='关联缺陷')
    tower = models.ForeignKey(Tower, on_delete=models.CASCADE, null=True, blank=True, related_name='alerts', verbose_name='杆塔')
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='defect', verbose_name='告警类型')
    level = models.CharField(max_length=10, choices=LEVEL_CHOICES, default='minor', verbose_name='告警级别')
    title = models.CharField(max_length=200, verbose_name='告警标题')
    content = models.TextField(blank=True, verbose_name='告警内容')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open', verbose_name='状态')
    handled_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='handled_alerts', verbose_name='处置人')
    handled_at = models.DateTimeField(null=True, blank=True, verbose_name='处置时间')
    handle_note = models.TextField(blank=True, verbose_name='处置说明')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'inspection_alert'
        verbose_name = '隐患告警'
        verbose_name_plural = '隐患告警'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.get_level_display()} - {self.title}'


class SystemLog(models.Model):
    LOG_TYPE_CHOICES = [
        ('push', '系统推送'),
        ('report', '无人机上报'),
    ]

    LOG_CATEGORY_CHOICES = [
        ('heartbeat', '心跳上报'),
        ('telemetry', '遥测上报'),
        ('media', '媒体上报'),
        ('event', '事件上报'),
        ('task_summary', '任务汇总'),
        ('task_bind', '任务绑定'),
        ('task_unbind', '任务解绑'),
        ('task_start', '任务开始'),
        ('task_pause', '任务暂停'),
        ('task_resume', '任务恢复'),
        ('task_stop', '任务停止'),
        ('return_home', '返航指令'),
        ('command', '通用指令'),
        ('other', '其他'),
    ]

    LOG_LEVEL_CHOICES = [
        ('info', '信息'),
        ('warning', '警告'),
        ('error', '错误'),
        ('critical', '严重'),
    ]

    log_type = models.CharField(max_length=10, choices=LOG_TYPE_CHOICES, verbose_name='日志类型')
    log_category = models.CharField(max_length=30, choices=LOG_CATEGORY_CHOICES, default='other', verbose_name='日志类别')
    log_level = models.CharField(max_length=10, choices=LOG_LEVEL_CHOICES, default='info', verbose_name='日志级别')
    drone = models.ForeignKey(Drone, on_delete=models.SET_NULL, null=True, blank=True, related_name='logs', verbose_name='无人机')
    task = models.ForeignKey(InspectionTask, on_delete=models.SET_NULL, null=True, blank=True, related_name='logs', verbose_name='巡检任务')
    title = models.CharField(max_length=200, verbose_name='日志标题')
    content = models.TextField(blank=True, verbose_name='日志内容')
    raw_data = JSONField(default=dict, blank=True, verbose_name='原始数据')
    latitude = models.FloatField(null=True, blank=True, verbose_name='纬度')
    longitude = models.FloatField(null=True, blank=True, verbose_name='经度')
    altitude = models.FloatField(null=True, blank=True, verbose_name='高度(m)')
    speed = models.FloatField(null=True, blank=True, verbose_name='速度(m/s)')
    battery = models.IntegerField(null=True, blank=True, verbose_name='电量(%)')
    signal_strength = models.IntegerField(null=True, blank=True, verbose_name='信号强度(%)')
    report_time = models.DateTimeField(verbose_name='上报/推送时间')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'inspection_system_log'
        verbose_name = '系统日志'
        verbose_name_plural = '系统日志'
        ordering = ['-report_time', '-created_at']
        indexes = [
            models.Index(fields=['log_type', 'log_category']),
            models.Index(fields=['drone', 'report_time']),
            models.Index(fields=['task', 'report_time']),
        ]

    def __str__(self):
        drone_name = self.drone.name if self.drone else '未知设备'
        return f'[{self.get_log_type_display()}] {drone_name} - {self.title}'

    @staticmethod
    def log_push(drone, task, category, title, content='', raw_data=None, **kwargs):
        from django.utils import timezone
        return SystemLog.objects.create(
            log_type='push',
            log_category=category,
            log_level=kwargs.get('log_level', 'info'),
            drone=drone,
            task=task,
            title=title,
            content=content,
            raw_data=raw_data or {},
            report_time=kwargs.get('report_time') or timezone.now(),
            latitude=kwargs.get('latitude'),
            longitude=kwargs.get('longitude'),
            altitude=kwargs.get('altitude'),
            speed=kwargs.get('speed'),
            battery=kwargs.get('battery'),
            signal_strength=kwargs.get('signal_strength'),
        )

    @staticmethod
    def log_report(drone, task, category, title, content='', raw_data=None, **kwargs):
        from django.utils import timezone
        return SystemLog.objects.create(
            log_type='report',
            log_category=category,
            log_level=kwargs.get('log_level', 'info'),
            drone=drone,
            task=task,
            title=title,
            content=content,
            raw_data=raw_data or {},
            report_time=kwargs.get('report_time') or timezone.now(),
            latitude=kwargs.get('latitude'),
            longitude=kwargs.get('longitude'),
            altitude=kwargs.get('altitude'),
            speed=kwargs.get('speed'),
            battery=kwargs.get('battery'),
            signal_strength=kwargs.get('signal_strength'),
        )
