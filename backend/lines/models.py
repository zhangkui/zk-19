from django.contrib.gis.db import models
from django.db.models import Count


class Line(models.Model):
    VOLTAGE_CHOICES = [
        ('110kV', '110kV'),
        ('220kV', '220kV'),
        ('500kV', '500kV'),
        ('750kV', '750kV'),
        ('1000kV', '1000kV'),
    ]

    name = models.CharField(max_length=120, verbose_name='线路名称')
    voltage = models.CharField(max_length=20, choices=VOLTAGE_CHOICES, default='220kV', verbose_name='电压等级')
    geom = models.LineStringField(srid=4326, verbose_name='线路几何')
    description = models.TextField(blank=True, verbose_name='描述')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'lines_line'
        verbose_name = '输电线路'
        verbose_name_plural = '输电线路'
        ordering = ['name']

    def __str__(self):
        return self.name


class Section(models.Model):
    line = models.ForeignKey(Line, on_delete=models.SET_NULL, null=True, blank=True, related_name='sections', verbose_name='所属线路')
    name = models.CharField(max_length=120, verbose_name='区段名称')
    start_km = models.FloatField(default=0, verbose_name='起始公里标')
    end_km = models.FloatField(default=0, verbose_name='结束公里标')
    description = models.TextField(blank=True, verbose_name='描述')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'lines_section'
        verbose_name = '线路区段'
        verbose_name_plural = '线路区段'
        ordering = ['line', 'start_km']

    def __str__(self):
        return f'{self.line.name} - {self.name}'


class Tower(models.Model):
    TOWER_TYPES = [
        ('straight', '直线塔'),
        ('angle', '转角塔'),
        ('terminal', '终端塔'),
        ('tension', '耐张塔'),
    ]

    line = models.ForeignKey(Line, on_delete=models.SET_NULL, null=True, blank=True, related_name='towers', verbose_name='所属线路')
    section = models.ForeignKey(Section, on_delete=models.SET_NULL, null=True, blank=True, related_name='towers', verbose_name='所属区段')
    code = models.CharField(max_length=60, verbose_name='杆塔编号')
    geom = models.PointField(srid=4326, verbose_name='杆塔位置')
    height = models.FloatField(null=True, blank=True, verbose_name='杆塔高度(m)')
    tower_type = models.CharField(max_length=20, choices=TOWER_TYPES, default='straight', verbose_name='杆塔类型')
    sequence = models.IntegerField(default=0, verbose_name='序号')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'lines_tower'
        verbose_name = '杆塔'
        verbose_name_plural = '杆塔'
        ordering = ['line', 'sequence']

    def __str__(self):
        return f'{self.line.name} - {self.code}'

    @property
    def defect_count(self):
        return self.defects.count()
