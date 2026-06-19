from celery import shared_task
from django.utils import timezone
from .models import InspectionMedia, Defect, Alert
import random
import logging

logger = logging.getLogger(__name__)


@shared_task
def process_inspection_media_task(media_id):
    """
    模拟 AI 缺陷识别处理
    真实环境中这里会调用 CV 模型推理
    """
    try:
        media = InspectionMedia.objects.get(id=media_id)
        logger.info(f'Starting defect detection for media {media_id}')

        defect_types = ['insulator', 'tower', 'hardware', 'conductor']
        subtypes_map = {
            'insulator': ['breakage', 'tilt', 'pollution', 'missing'],
            'tower': ['rust', 'bolt_missing', 'deformation', 'crack'],
            'hardware': ['loose', 'rust', 'damage'],
            'conductor': ['broken_strand', 'discharge', 'foreign_matter'],
        }
        severities = ['critical', 'major', 'minor', 'minor', 'minor']

        has_defect = random.random() < 0.35
        defect_count = 0

        if has_defect and media.tower:
            num_defects = random.randint(1, 3)
            for i in range(num_defects):
                defect_type = random.choice(defect_types)
                subtype = random.choice(subtypes_map[defect_type])
                severity = random.choice(severities)
                confidence = round(random.uniform(0.6, 0.99), 2)

                bbox = {
                    'x': random.randint(100, 400),
                    'y': random.randint(100, 300),
                    'width': random.randint(50, 150),
                    'height': random.randint(50, 150),
                }

                Defect.objects.create(
                    media=media,
                    tower=media.tower,
                    task=media.task,
                    defect_type=defect_type,
                    subtype=subtype,
                    severity=severity,
                    status='pending',
                    bbox=bbox,
                    confidence=confidence,
                    description=f'AI 自动识别：{defect_type}-{subtype}',
                )
                defect_count += 1

        media.has_defect = defect_count > 0
        media.defect_count = defect_count
        media.save()

        if media.task:
            media.task.defect_count += defect_count
            media.task.save()

        logger.info(f'Completed defect detection for media {media_id}, found {defect_count} defects')
        return {'media_id': media_id, 'defect_count': defect_count}

    except InspectionMedia.DoesNotExist:
        logger.error(f'Media {media_id} not found')
        return {'error': 'Media not found'}


@shared_task
def create_alert_and_workorder(defect_id):
    """审核确认缺陷后，自动创建告警和工单"""
    try:
        from ops.models import WorkOrder

        defect = Defect.objects.get(id=defect_id)
        tower = defect.tower

        alert = Alert.objects.create(
            defect=defect,
            tower=tower,
            category='defect',
            level=defect.severity,
            title=f'{tower.code} {defect.get_defect_type_display()}缺陷',
            content=f'{tower.line.name} {tower.code} 发现{defect.get_severity_display()}{defect.get_subtype_display()}缺陷，AI置信度{defect.confidence}',
            status='open',
        )

        WorkOrder.objects.create(
            defect=defect,
            tower=tower,
            title=f'{tower.code} {defect.get_defect_type_display()}消缺',
            description=defect.description or f'{defect.get_severity_display()}{defect.get_subtype_display()}缺陷',
            severity=defect.severity,
            status='created',
        )

        return {'alert_id': alert.id, 'defect_id': defect_id}

    except Defect.DoesNotExist:
        return {'error': 'Defect not found'}


@shared_task
def generate_daily_report():
    """生成每日巡检报告（定时任务）"""
    from django.db.models import Count
    from datetime import timedelta

    today = timezone.now().date()
    yesterday = today - timedelta(days=1)

    task_count = Defect.objects.filter(created_at__date=yesterday).count()
    defects_by_severity = Defect.objects.filter(created_at__date=yesterday).values('severity').annotate(count=Count('id'))

    report = {
        'date': yesterday.isoformat(),
        'total_defects': task_count,
        'by_severity': {item['severity']: item['count'] for item in defects_by_severity},
    }

    logger.info(f'Daily report for {yesterday}: {report}')
    return report
