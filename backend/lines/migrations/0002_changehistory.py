from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('lines', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='tower',
            name='updated_at',
            field=models.DateTimeField(auto_now=True, verbose_name='更新时间'),
        ),
        migrations.AlterField(
            model_name='line',
            name='geom',
            field=django.contrib.gis.db.models.fields.LineStringField(blank=True, null=True, srid=4326, verbose_name='线路几何'),
        ),
        migrations.AlterField(
            model_name='tower',
            name='geom',
            field=django.contrib.gis.db.models.fields.PointField(blank=True, null=True, srid=4326, verbose_name='杆塔位置'),
        ),
        migrations.AlterField(
            model_name='section',
            name='line',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='sections', to='lines.line', verbose_name='所属线路'),
        ),
        migrations.AlterField(
            model_name='tower',
            name='line',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='towers', to='lines.line', verbose_name='所属线路'),
        ),
        migrations.CreateModel(
            name='ChangeHistory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('content_type', models.CharField(choices=[('line', '线路'), ('tower', '杆塔'), ('section', '区段')], max_length=20, verbose_name='对象类型')),
                ('object_id', models.IntegerField(blank=True, null=True, verbose_name='对象ID')),
                ('object_name', models.CharField(blank=True, max_length=200, verbose_name='对象名称')),
                ('action', models.CharField(choices=[('create', '创建'), ('update', '更新'), ('delete', '删除'), ('import', '导入')], max_length=20, verbose_name='操作类型')),
                ('changes', models.JSONField(blank=True, null=True, verbose_name='变更内容')),
                ('note', models.CharField(blank=True, max_length=500, verbose_name='备注')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='创建时间')),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL, verbose_name='操作人')),
            ],
            options={
                'verbose_name': '修改历史',
                'verbose_name_plural': '修改历史',
                'db_table': 'lines_change_history',
                'ordering': ['-created_at'],
            },
        ),
    ]
