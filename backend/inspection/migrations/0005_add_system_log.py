from django.db import migrations, models
import django.db.models.deletion
from django.contrib.postgres.fields import JSONField


class Migration(migrations.Migration):

    dependencies = [
        ('inspection', '0004_inspectionmedia_extra_data'),
    ]

    operations = [
        migrations.CreateModel(
            name='SystemLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('log_type', models.CharField(choices=[('push', '系统推送'), ('report', '无人机上报')], max_length=10, verbose_name='日志类型')),
                ('log_category', models.CharField(choices=[('heartbeat', '心跳上报'), ('telemetry', '遥测上报'), ('media', '媒体上报'), ('event', '事件上报'), ('task_summary', '任务汇总'), ('task_bind', '任务绑定'), ('task_unbind', '任务解绑'), ('task_start', '任务开始'), ('task_pause', '任务暂停'), ('task_resume', '任务恢复'), ('task_stop', '任务停止'), ('return_home', '返航指令'), ('command', '通用指令'), ('other', '其他')], default='other', max_length=30, verbose_name='日志类别')),
                ('log_level', models.CharField(choices=[('info', '信息'), ('warning', '警告'), ('error', '错误'), ('critical', '严重')], default='info', max_length=10, verbose_name='日志级别')),
                ('title', models.CharField(max_length=200, verbose_name='日志标题')),
                ('content', models.TextField(blank=True, verbose_name='日志内容')),
                ('raw_data', JSONField(blank=True, default=dict, verbose_name='原始数据')),
                ('latitude', models.FloatField(blank=True, null=True, verbose_name='纬度')),
                ('longitude', models.FloatField(blank=True, null=True, verbose_name='经度')),
                ('altitude', models.FloatField(blank=True, null=True, verbose_name='高度(m)')),
                ('speed', models.FloatField(blank=True, null=True, verbose_name='速度(m/s)')),
                ('battery', models.IntegerField(blank=True, null=True, verbose_name='电量(%)')),
                ('signal_strength', models.IntegerField(blank=True, null=True, verbose_name='信号强度(%)')),
                ('report_time', models.DateTimeField(verbose_name='上报/推送时间')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='创建时间')),
                ('drone', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='logs', to='inspection.drone', verbose_name='无人机')),
                ('task', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='logs', to='inspection.inspectiontask', verbose_name='巡检任务')),
            ],
            options={
                'verbose_name': '系统日志',
                'verbose_name_plural': '系统日志',
                'db_table': 'inspection_system_log',
                'ordering': ['-report_time', '-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='systemlog',
            index=models.Index(fields=['log_type', 'log_category'], name='inspection__log_typ_9e1574_idx'),
        ),
        migrations.AddIndex(
            model_name='systemlog',
            index=models.Index(fields=['drone', 'report_time'], name='inspection__drone_id_8a5c29_idx'),
        ),
        migrations.AddIndex(
            model_name='systemlog',
            index=models.Index(fields=['task', 'report_time'], name='inspection__task_id_a4b8c3_idx'),
        ),
    ]
