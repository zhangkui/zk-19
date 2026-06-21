import json
import logging
from datetime import datetime
from django.utils import timezone
from django.contrib.gis.geos import Point

logger = logging.getLogger('drone_mqtt')


class MessageHandler:
    REPORT_TYPE_HEARTBEAT = 'heartbeat'
    REPORT_TYPE_TELEMETRY = 'telemetry'
    REPORT_TYPE_EVENT = 'event'
    REPORT_TYPE_MEDIA = 'media'
    REPORT_TYPE_TASK_SUMMARY = 'task_summary'

    COMMAND_TASK_BIND = 'task_bind'
    COMMAND_TASK_START = 'task_start'
    COMMAND_TASK_PAUSE = 'task_pause'
    COMMAND_TASK_RESUME = 'task_resume'
    COMMAND_TASK_STOP = 'task_stop'
    COMMAND_RETURN_HOME = 'return_home'

    def __init__(self):
        from inspection.models import Drone
        self.Drone = Drone

    def parse_message(self, payload: str) -> dict:
        try:
            return json.loads(payload)
        except (json.JSONDecodeError, TypeError) as e:
            logger.error(f'MQTT消息解析失败: {e}, payload: {payload[:200]}')
            return {}

    def get_drone(self, device_id: str):
        try:
            return self.Drone.objects.filter(
                serial_number=device_id
            ).first() or self.Drone.objects.filter(id=device_id).first()
        except Exception as e:
            logger.error(f'查找无人机失败 device_id={device_id}: {e}')
            return None

    def handle_heartbeat(self, device_id: str, data: dict) -> bool:
        drone = self.get_drone(device_id)
        if not drone:
            logger.warning(f'心跳上报: 未找到无人机 device_id={device_id}')
            return False

        now = self._parse_time(data.get('report_time')) or timezone.now()
        drone.last_heartbeat = now
        drone.last_report_time = now
        drone.last_report_type = self.REPORT_TYPE_HEARTBEAT

        if 'battery' in data:
            drone.battery = int(data['battery'])
        if 'signal_strength' in data:
            drone.signal_strength = int(data['signal_strength'])
        if 'latitude' in data:
            drone.latitude = float(data['latitude'])
        if 'longitude' in data:
            drone.longitude = float(data['longitude'])
        if 'altitude' in data:
            drone.altitude = float(data['altitude'])
        if 'speed' in data:
            drone.speed = float(data['speed'])
        if 'heading' in data:
            drone.heading = float(data['heading'])
        if 'firmware_version' in data:
            drone.firmware_version = str(data['firmware_version'])

        if drone.status == 'offline':
            drone.status = 'idle'

        drone.save(update_fields=[
            'last_heartbeat', 'last_report_time', 'last_report_type',
            'battery', 'signal_strength', 'latitude', 'longitude',
            'altitude', 'speed', 'heading', 'firmware_version', 'status'
        ])
        logger.info(f'心跳上报: {drone.name}({drone.serial_number}) 电量={drone.battery}%')
        return True

    def handle_telemetry(self, device_id: str, data: dict) -> bool:
        drone = self.get_drone(device_id)
        if not drone:
            logger.warning(f'遥测上报: 未找到无人机 device_id={device_id}')
            return False

        required = ['latitude', 'longitude']
        if not all(k in data for k in required):
            logger.error(f'遥测上报: 缺少必填字段 device_id={device_id}')
            return False

        report_time = self._parse_time(data.get('report_time')) or timezone.now()

        from inspection.models import DroneTelemetry
        telemetry = DroneTelemetry.objects.create(
            drone=drone,
            report_time=report_time,
            latitude=float(data['latitude']),
            longitude=float(data['longitude']),
            altitude=float(data.get('altitude', 0)),
            speed=float(data.get('speed', 0)),
            heading=float(data.get('heading', 0)),
            battery=int(data.get('battery', drone.battery)),
            signal_strength=int(data.get('signal_strength', drone.signal_strength)),
            satellites=int(data.get('satellites', 0)),
            temperature=data.get('temperature'),
            wind_speed=data.get('wind_speed'),
            extra_data=data.get('extra_data', {}),
        )

        drone.last_report_time = report_time
        drone.last_report_type = self.REPORT_TYPE_TELEMETRY
        drone.latitude = telemetry.latitude
        drone.longitude = telemetry.longitude
        drone.altitude = telemetry.altitude
        drone.speed = telemetry.speed
        drone.heading = telemetry.heading
        drone.battery = telemetry.battery
        drone.signal_strength = telemetry.signal_strength
        if drone.status == 'offline':
            drone.status = 'idle'
        drone.save(update_fields=[
            'last_report_time', 'last_report_type', 'latitude', 'longitude',
            'altitude', 'speed', 'heading', 'battery', 'signal_strength', 'status'
        ])

        logger.info(f'遥测上报: {drone.name} 位置=({telemetry.latitude:.6f}, {telemetry.longitude:.6f}) 高度={telemetry.altitude}m')
        return True

    def handle_event(self, device_id: str, data: dict) -> bool:
        drone = self.get_drone(device_id)
        if not drone:
            logger.warning(f'事件上报: 未找到无人机 device_id={device_id}')
            return False

        required = ['title', 'event_level', 'event_category']
        if not all(k in data for k in required):
            logger.error(f'事件上报: 缺少必填字段 device_id={device_id}')
            return False

        report_time = self._parse_time(data.get('report_time')) or timezone.now()

        from inspection.models import DroneEvent
        event = DroneEvent.objects.create(
            drone=drone,
            report_time=report_time,
            event_level=data['event_level'],
            event_category=data['event_category'],
            event_code=data.get('event_code', ''),
            title=data['title'],
            description=data.get('description', ''),
            latitude=data.get('latitude'),
            longitude=data.get('longitude'),
            altitude=data.get('altitude'),
            extra_data=data.get('extra_data', {}),
        )

        drone.last_report_time = report_time
        drone.last_report_type = self.REPORT_TYPE_EVENT
        drone.save(update_fields=['last_report_time', 'last_report_type'])

        self._sync_event_to_alert(event)

        logger.info(f'事件上报: {drone.name} [{event.get_event_level_display()}] {event.title}')
        return True

    def handle_media(self, device_id: str, data: dict) -> bool:
        drone = self.get_drone(device_id)
        if not drone:
            logger.warning(f'媒体上报: 未找到无人机 device_id={device_id}')
            return False

        required = ['media_type', 'file_name', 'file_url']
        if not all(k in data for k in required):
            logger.error(f'媒体上报: 缺少必填字段 device_id={device_id}')
            return False

        report_time = self._parse_time(data.get('report_time')) or timezone.now()
        task_id = data.get('task_id') or drone.current_task_id

        from inspection.models import DroneMediaReport, InspectionTask
        task = InspectionTask.objects.filter(id=task_id).first() if task_id else None

        media_report = DroneMediaReport.objects.create(
            drone=drone,
            task=task,
            report_time=report_time,
            media_type=data['media_type'],
            file_name=data['file_name'],
            file_url=data['file_url'],
            thumbnail_url=data.get('thumbnail_url', ''),
            file_size=int(data.get('file_size', 0)),
            duration=int(data.get('duration', 0)),
            latitude=data.get('latitude'),
            longitude=data.get('longitude'),
            altitude=data.get('altitude'),
            heading=data.get('heading'),
            tower_id=data.get('tower_id'),
            extra_data=data.get('extra_data', {}),
        )

        drone.last_report_time = report_time
        drone.last_report_type = self.REPORT_TYPE_MEDIA
        drone.save(update_fields=['last_report_time', 'last_report_type'])

        self._sync_media_to_inspection(media_report, task)

        logger.info(f'媒体上报: {drone.name} {media_report.get_media_type_display()} {media_report.file_name}')
        return True

    def handle_task_summary(self, device_id: str, data: dict) -> bool:
        drone = self.get_drone(device_id)
        if not drone:
            logger.warning(f'任务汇总上报: 未找到无人机 device_id={device_id}')
            return False

        required = ['task_id', 'task_status']
        if not all(k in data for k in required):
            logger.error(f'任务汇总上报: 缺少必填字段 device_id={device_id}')
            return False

        report_time = self._parse_time(data.get('report_time')) or timezone.now()

        from inspection.models import DroneTaskSummary, InspectionTask, FlightRoute
        task = InspectionTask.objects.filter(id=data['task_id']).first()
        if not task:
            logger.error(f'任务汇总上报: 任务不存在 task_id={data["task_id"]}')
            return False

        route_id = data.get('route_id') or (task.route_id if task.route else None)
        route = FlightRoute.objects.filter(id=route_id).first() if route_id else None
        line_id = data.get('line_id') or (route.line_id if route else None)

        summary = DroneTaskSummary.objects.create(
            drone=drone,
            task=task,
            route=route,
            report_time=report_time,
            task_status=data['task_status'],
            flight_phase=data.get('flight_phase', ''),
            current_waypoint_index=int(data.get('current_waypoint_index', 0)),
            total_waypoints=int(data.get('total_waypoints', 0)),
            progress=float(data.get('progress', 0)),
            flight_distance=float(data.get('flight_distance', 0)),
            remaining_distance=float(data.get('remaining_distance', 0)),
            elapsed_time=int(data.get('elapsed_time', 0)),
            remaining_time=int(data.get('remaining_time', 0)),
            photos_taken=int(data.get('photos_taken', 0)),
            videos_recorded=int(data.get('videos_recorded', 0)),
            battery_used=int(data.get('battery_used', 0)),
            latitude=data.get('latitude'),
            longitude=data.get('longitude'),
            altitude=float(data.get('altitude', 0)),
            speed=float(data.get('speed', 0)),
            heading=float(data.get('heading', 0)),
            extra_data=data.get('extra_data', {}),
        )

        drone.current_task_id = task.id
        drone.current_route_id = route.id if route else None
        drone.current_line_id = line_id
        drone.last_report_time = report_time
        drone.last_report_type = self.REPORT_TYPE_TASK_SUMMARY
        if data['task_status'] in ['completed', 'aborted', 'error', 'landing']:
            drone.status = 'idle'
        else:
            drone.status = 'busy'
        if 'latitude' in data:
            drone.latitude = data.get('latitude')
        if 'longitude' in data:
            drone.longitude = data.get('longitude')
        if 'altitude' in data:
            drone.altitude = float(data.get('altitude', 0))
        if 'speed' in data:
            drone.speed = float(data.get('speed', 0))
        if 'heading' in data:
            drone.heading = float(data.get('heading', 0))
        if 'battery' in data:
            drone.battery = int(data.get('battery', drone.battery))
        drone.save(update_fields=[
            'current_task_id', 'current_route_id', 'current_line_id',
            'last_report_time', 'last_report_type', 'status',
            'latitude', 'longitude', 'altitude', 'speed', 'heading', 'battery'
        ])

        self._update_task_progress(summary)

        logger.info(f'任务汇总: {drone.name} {task.code} 进度={summary.progress:.1f}% 状态={summary.get_task_status_display()}')
        return True

    def handle_response(self, device_id: str, data: dict) -> bool:
        drone = self.get_drone(device_id)
        if not drone:
            logger.warning(f'响应消息: 未找到无人机 device_id={device_id}')
            return False
        command = data.get('command', '')
        success = data.get('success', False)
        message = data.get('message', '')
        logger.info(f'无人机响应: {drone.name} cmd={command} success={success} msg={message}')
        return True

    def dispatch(self, topic_info: dict, payload: str) -> bool:
        if topic_info.get('is_broadcast'):
            return False

        device_id = topic_info.get('device_id')
        msg_type = topic_info.get('msg_type')
        if not device_id or not msg_type:
            return False

        data = self.parse_message(payload)
        if not data:
            return False

        handlers = {
            'heartbeat': self.handle_heartbeat,
            'telemetry': self.handle_telemetry,
            'event': self.handle_event,
            'media': self.handle_media,
            'task_summary': self.handle_task_summary,
            'response': self.handle_response,
        }

        handler = handlers.get(msg_type)
        if handler:
            try:
                return handler(device_id, data)
            except Exception as e:
                logger.error(f'MQTT消息处理异常 type={msg_type} device={device_id}: {e}', exc_info=True)
                return False
        else:
            logger.warning(f'未知的MQTT消息类型: {msg_type}')
            return False

    def _parse_time(self, time_str):
        if not time_str:
            return None
        try:
            if isinstance(time_str, (int, float)):
                return timezone.datetime.fromtimestamp(time_str, tz=timezone.utc)
            for fmt in [
                '%Y-%m-%dT%H:%M:%S.%fZ',
                '%Y-%m-%dT%H:%M:%SZ',
                '%Y-%m-%d %H:%M:%S',
                '%Y-%m-%dT%H:%M:%S%z',
            ]:
                try:
                    dt = datetime.strptime(time_str, fmt)
                    if timezone.is_naive(dt):
                        dt = timezone.make_aware(dt)
                    return dt
                except ValueError:
                    continue
        except Exception:
            pass
        return None

    def _sync_event_to_alert(self, event):
        if event.event_level in ['error', 'critical']:
            try:
                from inspection.models import Alert
                from lines.models import Tower
                tower = None
                if event.latitude and event.longitude:
                    from django.contrib.gis.geos import Point
                    from django.contrib.gis.db.models.functions import Distance
                    point = Point(event.longitude, event.latitude, srid=4326)
                    tower = Tower.objects.filter(
                        geom__isnull=False
                    ).annotate(distance=Distance('geom', point)).order_by('distance').first()

                level_map = {'error': 'major', 'critical': 'critical'}
                Alert.objects.create(
                    tower=tower,
                    category='device',
                    level=level_map.get(event.event_level, 'minor'),
                    title=f'[{event.drone.name}] {event.title}',
                    content=event.description or f'{event.get_event_category_display()} - {event.get_event_level_display()}',
                )
            except Exception as e:
                logger.error(f'事件同步告警失败: {e}')

    def _sync_media_to_inspection(self, media_report, task):
        if not task or not media_report.file_url:
            return
        try:
            from inspection.models import InspectionMedia
            geom = None
            if media_report.latitude and media_report.longitude:
                geom = Point(media_report.longitude, media_report.latitude, srid=4326)

            media_type_map = {'image': 'image', 'video': 'video', 'panorama': 'image'}
            inspection_media = InspectionMedia.objects.create(
                task=task,
                tower_id=media_report.tower_id,
                media_type=media_type_map.get(media_report.media_type, 'image'),
                geom=geom,
                captured_at=media_report.report_time,
                altitude=media_report.altitude,
            )
            try:
                from django.core.files.base import ContentFile
                import requests
                resp = requests.get(media_report.file_url, timeout=10)
                if resp.status_code == 200:
                    ext = 'jpg' if media_report.media_type in ['image', 'panorama'] else 'mp4'
                    inspection_media.file.save(
                        f'{media_report.file_name or f"media_{inspection_media.id}"}.{ext}',
                        ContentFile(resp.content),
                        save=True
                    )
            except Exception as e:
                logger.warning(f'媒体文件下载失败，记录URL: {e}')
                inspection_media.extra_data = {'source_url': media_report.file_url}
                inspection_media.save()

            media_report.uploaded = True
            media_report.media_id = inspection_media.id
            media_report.save(update_fields=['uploaded', 'media_id'])

            task.media_count += 1
            task.save(update_fields=['media_count'])

            from inspection.tasks import process_inspection_media_task
            process_inspection_media_task.delay(inspection_media.id)
        except Exception as e:
            logger.error(f'媒体同步巡检影像失败: {e}')

    def _update_task_progress(self, summary):
        task = summary.task
        if not task:
            return
        try:
            status_map = {
                'takeoff': 'running',
                'climbing': 'running',
                'cruising': 'running',
                'turning': 'running',
                'descending': 'running',
                'landing': 'running',
                'paused': 'paused',
                'returning': 'running',
                'completed': 'completed',
                'aborted': 'cancelled',
                'error': 'cancelled',
            }
            new_status = status_map.get(summary.task_status)
            if new_status and task.status != new_status:
                task.status = new_status
                if new_status == 'completed' and not task.ended_at:
                    task.ended_at = summary.report_time
                task.save(update_fields=['status', 'ended_at'])

            progress = summary.progress
            if progress > 0 and hasattr(task, 'progress'):
                task.progress = progress
                task.save(update_fields=['progress'])
        except Exception as e:
            logger.error(f'更新任务进度失败: {e}')


handler = MessageHandler()
