from django.db import migrations
from django.contrib.postgres.fields import JSONField


class Migration(migrations.Migration):

    dependencies = [
        ('inspection', '0003_drone_mqtt_models'),
    ]

    operations = [
        migrations.AddField(
            model_name='inspectionmedia',
            name='extra_data',
            field=JSONField(blank=True, default=dict, verbose_name='扩展数据'),
        ),
    ]
