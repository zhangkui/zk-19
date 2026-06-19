from django.db import models
from lines.models import Line, Section, Tower


class SectionDefectStat(models.Model):
    section = models.OneToOneField(Section, on_delete=models.CASCADE, related_name='defect_stats', verbose_name='区段')
    line = models.ForeignKey(Line, on_delete=models.CASCADE, related_name='section_stats', verbose_name='线路')
    total_defects = models.IntegerField(default=0, verbose_name='缺陷总数')
    critical_count = models.IntegerField(default=0, verbose_name='危急缺陷')
    major_count = models.IntegerField(default=0, verbose_name='重大缺陷')
    minor_count = models.IntegerField(default=0, verbose_name='一般缺陷')
    trend_data = models.JSONField(default=dict, blank=True, verbose_name='趋势数据')
    last_updated = models.DateTimeField(auto_now=True, verbose_name='最后更新')

    class Meta:
        db_table = 'stats_section_defect'
        verbose_name = '区段缺陷统计'
        verbose_name_plural = '区段缺陷统计'
        ordering = ['-total_defects']

    def __str__(self):
        return f'{self.section.name} - {self.total_defects}个缺陷'


class LineDefectStat(models.Model):
    line = models.OneToOneField(Line, on_delete=models.CASCADE, related_name='defect_stats', verbose_name='线路')
    total_defects = models.IntegerField(default=0, verbose_name='缺陷总数')
    critical_count = models.IntegerField(default=0, verbose_name='危急缺陷')
    major_count = models.IntegerField(default=0, verbose_name='重大缺陷')
    minor_count = models.IntegerField(default=0, verbose_name='一般缺陷')
    tower_count = models.IntegerField(default=0, verbose_name='杆塔数')
    defect_rate = models.FloatField(default=0, verbose_name='缺陷率')
    last_updated = models.DateTimeField(auto_now=True, verbose_name='最后更新')

    class Meta:
        db_table = 'stats_line_defect'
        verbose_name = '线路缺陷统计'
        verbose_name_plural = '线路缺陷统计'
        ordering = ['-total_defects']

    def __str__(self):
        return f'{self.line.name} - {self.total_defects}个缺陷'
