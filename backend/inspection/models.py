from django.contrib.gis.db import models
from django.db.models import JSONField
from lines.models import Line, Tower
from accounts.models import User


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
        ('approved', '已审批'),
        ('archived', '已归档'),
    ]

    name = models.CharField(max_length=120, verbose_name='航线名称')
    line = models.ForeignKey(Line, on_delete=models.CASCADE, related_name='flight_routes', verbose_name='所属线路')
    waypoints = models.LineStringField(srid=4326, null=True, blank=True, verbose_name='航点轨迹')
    waypoints_data = JSONField(default=list, blank=True, verbose_name='航点详情')
    altitude = models.FloatField(default=50, verbose_name='飞行高度(m)')
    speed = models.FloatField(default=8, verbose_name='飞行速度(m/s)')
    estimated_duration = models.IntegerField(default=0, verbose_name='预计时长(分钟)')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft', verbose_name='状态')
    description = models.TextField(blank=True, verbose_name='描述')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_routes', verbose_name='创建人')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    objects = models.GeoManager()

    class Meta:
        db_table = 'inspection_flightroute'
        verbose_name = '飞行航线'
        verbose_name_plural = '飞行航线'
        ordering = ['-created_at']

    def __str__(self):
        return self.name

    @property
    def waypoint_count(self):
        if self.waypoints_data:
            return len(self.waypoints_data)
        if self.waypoints:
            return len(self.waypoints.coords)
        return 0


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
    file = models.FileField(upload_to='inspection/%Y/%m/%d/', verbose_name='文件')
    media_type = models.CharField(max_length=10, choices=MEDIA_TYPES, default='image', verbose_name='类型')
    thumbnail = models.ImageField(upload_to='inspection/thumbs/%Y/%m/%d/', null=True, blank=True, verbose_name='缩略图')
    geom = models.PointField(srid=4326, null=True, blank=True, verbose_name='拍摄位置')
    captured_at = models.DateTimeField(null=True, blank=True, verbose_name='拍摄时间')
    altitude = models.FloatField(null=True, blank=True, verbose_name='飞行高度(m)')
    has_defect = models.BooleanField(default=False, verbose_name='是否有缺陷')
    defect_count = models.IntegerField(default=0, verbose_name='缺陷数量')
    uploaded_at = models.DateTimeField(auto_now_add=True, verbose_name='上传时间')

    objects = models.GeoManager()

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
