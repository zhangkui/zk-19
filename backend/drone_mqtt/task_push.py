import logging
from django.utils import timezone

logger = logging.getLogger('drone_mqtt')


class TaskPushService:
    @staticmethod
    def build_task_bind_data(task) -> dict:
        task_data = {
            'task_id': task.id,
            'task_code': task.code,
            'task_name': task.name,
            'route_id': task.route.id if task.route else None,
            'route_name': task.route.name if task.route else None,
            'line_id': task.route.line.id if task.route and task.route.line else None,
            'line_name': task.route.line.name if task.route and task.route.line else None,
            'pilot_id': task.pilot.id if task.pilot else None,
            'pilot_name': task.pilot.name if task.pilot else None,
            'planned_date': task.planned_date.isoformat() if task.planned_date else None,
            'altitude': task.route.altitude if task.route else 50,
            'speed': task.route.speed if task.route else 8,
            'waypoints': task.route.waypoints_data if task.route else [],
            'waypoints_geom': [
                list(coord) for coord in task.route.waypoints.coords
            ] if task.route and task.route.waypoints else [],
            'total_distance': task.route.distance if task.route else 0,
            'estimated_duration': task.route.estimated_duration if task.route else 0,
            'issued_at': timezone.now().isoformat(),
            'token': task.drone.mqtt_token if task.drone else '',
        }
        return task_data

    @staticmethod
    def push_task_bind(task_id: int) -> dict:
        from inspection.models import InspectionTask
        from .mqtt_service import publisher
        from .topics import get_topic, TOPIC_TASK_BIND

        try:
            task = InspectionTask.objects.select_related('drone', 'route', 'route__line', 'pilot').get(id=task_id)
        except InspectionTask.DoesNotExist:
            return {'success': False, 'message': '任务不存在'}

        if not task.drone:
            return {'success': False, 'message': '任务未绑定无人机'}

        device_id = task.drone.serial_number or str(task.drone.id)
        task_data = TaskPushService.build_task_bind_data(task)

        payload = {
            'command': 'task_bind',
            'timestamp': int(timezone.now().timestamp() * 1000),
            'data': task_data,
        }

        topic = get_topic(TOPIC_TASK_BIND, device_id)
        result = publisher.publish(topic, payload, qos=2)

        from inspection.models import SystemLog
        log_level = 'info' if result else 'error'
        SystemLog.log_push(
            drone=task.drone,
            task=task,
            category='task_bind',
            title=f'任务绑定推送: {task.code}',
            content=f'推送任务「{task.name}」到无人机「{task.drone.name}」' + ('' if result else f'，失败: {result.get("message", "未知错误")}'),
            raw_data=payload,
            log_level=log_level
        )

        if result:
            logger.info(f'任务绑定推送成功: task={task.code} drone={task.drone.name} topic={topic}')
            return {
                'success': True,
                'message': '任务推送成功',
                'topic': topic,
                'device_id': device_id,
                'data': task_data,
            }
        else:
            logger.error(f'任务绑定推送失败: task={task.code} drone={task.drone.name}')
            return {'success': False, 'message': 'MQTT推送失败', 'topic': topic}

    @staticmethod
    def push_task_unbind(task_id: int) -> dict:
        from inspection.models import InspectionTask
        from .mqtt_service import publisher
        from .topics import get_topic, TOPIC_TASK_CONTROL

        try:
            task = InspectionTask.objects.select_related('drone').get(id=task_id)
        except InspectionTask.DoesNotExist:
            return {'success': False, 'message': '任务不存在'}

        if not task.drone:
            return {'success': False, 'message': '任务未绑定无人机'}

        device_id = task.drone.serial_number or str(task.drone.id)
        payload = {
            'command': 'task_unbind',
            'timestamp': int(timezone.now().timestamp() * 1000),
            'data': {'task_id': task.id},
        }

        topic = get_topic(TOPIC_TASK_CONTROL, device_id)
        result = publisher.publish(topic, payload, qos=2)

        from inspection.models import SystemLog
        log_level = 'info' if result else 'warning'
        SystemLog.log_push(
            drone=task.drone,
            task=task,
            category='task_unbind',
            title=f'任务解绑推送: {task.code}',
            content=f'解绑无人机「{task.drone.name}」与任务「{task.name}」',
            raw_data=payload,
            log_level=log_level
        )

        if result:
            logger.info(f'任务解绑推送成功: task={task.code} drone={task.drone.name}')
        else:
            logger.warning(f'任务解绑推送失败: task={task.code} drone={task.drone.name}')
        return {'success': result, 'topic': topic}

    @staticmethod
    def push_task_control(task_id: int, action: str, params: dict = None) -> dict:
        from inspection.models import InspectionTask
        from .mqtt_service import publisher
        from .topics import get_topic, TOPIC_TASK_CONTROL

        try:
            task = InspectionTask.objects.select_related('drone').get(id=task_id)
        except InspectionTask.DoesNotExist:
            return {'success': False, 'message': '任务不存在'}

        if not task.drone:
            return {'success': False, 'message': '任务未绑定无人机'}

        device_id = task.drone.serial_number or str(task.drone.id)

        payload = {
            'command': action,
            'timestamp': int(timezone.now().timestamp() * 1000),
            'data': params or {},
        }

        topic = get_topic(TOPIC_TASK_CONTROL, device_id)
        result = publisher.publish(topic, payload, qos=2)

        action_map = {
            'start': '开始',
            'pause': '暂停',
            'resume': '恢复',
            'stop': '停止',
            'return_home': '返航',
        }
        action_name = action_map.get(action, action)

        from inspection.models import SystemLog
        category_map = {
            'start': 'task_start',
            'pause': 'task_pause',
            'resume': 'task_resume',
            'stop': 'task_stop',
            'return_home': 'return_home',
        }
        log_category = category_map.get(action, 'command')
        log_level = 'info' if result else 'error'
        SystemLog.log_push(
            drone=task.drone,
            task=task,
            category=log_category,
            title=f'{action_name}指令推送: {task.code}',
            content=f'向无人机「{task.drone.name}」发送{action_name}指令' + ('' if result else '，失败'),
            raw_data=payload,
            log_level=log_level
        )

        if result:
            logger.info(f'任务控制推送成功: task={task.code} action={action_name}')
            return {'success': True, 'message': f'{action_name}指令发送成功'}
        else:
            return {'success': False, 'message': f'{action_name}指令发送失败'}

    @staticmethod
    def push_command(drone_id: int, command: str, params: dict = None) -> dict:
        from inspection.models import Drone
        from .mqtt_service import publisher
        from .topics import get_topic, TOPIC_CMD

        try:
            drone = Drone.objects.get(id=drone_id)
        except Drone.DoesNotExist:
            return {'success': False, 'message': '无人机不存在'}

        device_id = drone.serial_number or str(drone.id)

        payload = {
            'command': command,
            'timestamp': int(timezone.now().timestamp() * 1000),
            'data': params or {},
        }

        topic = get_topic(TOPIC_CMD, device_id)
        result = publisher.publish(topic, payload, qos=1)

        from inspection.models import SystemLog
        log_level = 'info' if result else 'error'
        SystemLog.log_push(
            drone=drone,
            task=None,
            category='command',
            title=f'通用指令推送: {command}',
            content=f'向无人机「{drone.name}」发送指令「{command}」' + ('' if result else '，失败'),
            raw_data=payload,
            log_level=log_level
        )

        if result:
            logger.info(f'指令推送成功: drone={drone.name} command={command}')
            return {'success': True, 'message': '指令发送成功'}
        else:
            return {'success': False, 'message': '指令发送失败'}
