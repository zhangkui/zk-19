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

    name = models.CharField(max_length=100, verbose_name='无人机名称')
    model = models.CharField(max_length=100, verbose_name='型号')
    serial_number = models.CharField(max_length=100, unique=True, verbose_name='序列号')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='idle', verbose_name='状态')
    battery = models.IntegerField(default=100, verbose_name='电量(%)')
    max_flight_time = models.IntegerField(default=30, verbose_name='最大续航(分钟)')
    payload = models.CharField(max_length=200, blank=True, verbose_name='载荷')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'inspection_drone'
        verbose_name = '无人机'
        verbose_name_plural = '无人机'

    def __str__(self):
        return f'{self.name} ({self.model})'


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
