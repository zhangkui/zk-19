from django.contrib.gis.db import models
from django.contrib.gis.geos import Point, LineString
from django.db.models import Count
from django.conf import settings
import json


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
    geom = models.LineStringField(srid=4326, verbose_name='线路几何', null=True, blank=True)
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

    @property
    def total_length_km(self):
        if self.geom:
            from django.contrib.gis.geos import GEOSGeometry
            geog = self.geom.transform(4326, clone=True)
            return geog.length * 111
        return 0

    def snap_point_to_line(self, point: Point, threshold_meters: float = 50.0) -> Point:
        if not self.geom or not point:
            return point
        line_geog = self.geom.transform(3857, clone=True)
        point_geog = point.transform(3857, clone=True)
        distance = line_geog.distance(point_geog)
        if distance <= threshold_meters:
            snapped_3857 = line_geog.interpolate(line_geog.project(point_geog))
            snapped_4326 = snapped_3857.transform(4326, clone=True)
            return Point(snapped_4326.x, snapped_4326.y, srid=4326)
        return point

    def get_tower_section(self, tower: 'Tower') -> 'Section | None':
        if not self.geom or not tower.geom:
            return None
        line_geog = self.geom.transform(3857, clone=True)
        point_geog = tower.geom.transform(3857, clone=True)
        distance_along_line = line_geog.project(point_geog)
        distance_km = distance_along_line / 1000.0
        return self.sections.filter(
            start_km__lte=distance_km,
            end_km__gte=distance_km
        ).first()


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
        if self.line:
            return f'{self.line.name} - {self.name}'
        return self.name


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
    geom = models.PointField(srid=4326, verbose_name='杆塔位置', null=True, blank=True)
    height = models.FloatField(null=True, blank=True, verbose_name='杆塔高度(m)')
    tower_type = models.CharField(max_length=20, choices=TOWER_TYPES, default='straight', verbose_name='杆塔类型')
    sequence = models.IntegerField(default=0, verbose_name='序号')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'lines_tower'
        verbose_name = '杆塔'
        verbose_name_plural = '杆塔'
        ordering = ['line', 'sequence']

    def __str__(self):
        if self.line:
            return f'{self.line.name} - {self.code}'
        return self.code

    @property
    def defect_count(self):
        return self.defects.count()


class ChangeHistory(models.Model):
    ACTION_CHOICES = [
        ('create', '创建'),
        ('update', '更新'),
        ('delete', '删除'),
        ('import', '导入'),
    ]

    CONTENT_TYPE_CHOICES = [
        ('line', '线路'),
        ('tower', '杆塔'),
        ('section', '区段'),
    ]

    content_type = models.CharField(max_length=20, choices=CONTENT_TYPE_CHOICES, verbose_name='对象类型')
    object_id = models.IntegerField(null=True, blank=True, verbose_name='对象ID')
    object_name = models.CharField(max_length=200, blank=True, verbose_name='对象名称')
    action = models.CharField(max_length=20, choices=ACTION_CHOICES, verbose_name='操作类型')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, verbose_name='操作人')
    changes = models.JSONField(null=True, blank=True, verbose_name='变更内容')
    note = models.CharField(max_length=500, blank=True, verbose_name='备注')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'lines_change_history'
        verbose_name = '修改历史'
        verbose_name_plural = '修改历史'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.get_content_type_display()} - {self.get_action_display()} - {self.object_name}'
