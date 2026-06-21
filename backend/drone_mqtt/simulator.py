import json
import time
import random
import logging
import threading
from datetime import datetime, timezone as dt_timezone
from copy import deepcopy

logger = logging.getLogger('drone_simulator')


class SimulatedDrone:
    def __init__(self, drone_config: dict, mqtt_client=None):
        self.drone_id = drone_config['id']
        self.device_id = drone_config.get('serial_number') or str(drone_config['id'])
        self.name = drone_config.get('name', f'Drone-{self.drone_id}')
        self.model = drone_config.get('model', 'DJI-Matrice-300')
        self.firmware_version = drone_config.get('firmware_version', 'v1.0.0')
        self.token = drone_config.get('mqtt_token', '')
        self.client = mqtt_client

        self._lat = drone_config.get('latitude', 30.6598)
        self._lon = drone_config.get('longitude', 104.0657)
        self._base_lat = self._lat
        self._base_lon = self._lon
        self._alt = 0.0
        self._speed = 0.0
        self._heading = 0.0
        self._battery = 100
        self._signal = 100
        self._satellites = 12
        self._temperature = 25.0

        self._task = None
        self._waypoints = []
        self._current_wp = 0
        self._start_time = None
        self._photos = 0
        self._videos = 0
        self._flight_status = 'idle'
        self._elapsed = 0

        self._heartbeat_interval = 10
        self._telemetry_interval = 2
        self._summary_interval = 5
        self._media_interval = 8

        self._running = False
        self._threads = []

    def connect(self, broker, port=1883, username=None, password=None):
        import paho.mqtt.client as mqtt
        if self.client:
            return
        client_id = f'sim-{self.device_id}-{int(time.time())}'
        self.client = mqtt.Client(client_id=client_id, clean_session=True)
        if username and password:
            self.client.username_pw_set(username, password)
        self.client.on_connect = self._on_connect
        self.client.on_message = self._on_message
        self.client.on_disconnect = self._on_disconnect
        self.client.connect(broker, port=port, keepalive=60)
        self.client.loop_start()

    def _on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            logger.info(f'[{self.name}] MQTT已连接')
            client.subscribe(f'drone/{self.device_id}/cmd')
            client.subscribe(f'drone/{self.device_id}/task_bind')
            client.subscribe(f'drone/{self.device_id}/task_control')
            client.subscribe('drone/broadcast/cmd')
        else:
            logger.error(f'[{self.name}] MQTT连接失败 rc={rc}')

    def _on_disconnect(self, client, userdata, rc):
        if rc != 0:
            logger.warning(f'[{self.name}] MQTT断开 rc={rc}')

    def _on_message(self, client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode())
            parts = msg.topic.split('/')
            cmd_type = parts[2] if len(parts) >= 3 else ''
            command = payload.get('command', '')
            data = payload.get('data', {})

            logger.info(f'[{self.name}] 收到指令 {cmd_type}/{command}')

            if cmd_type == 'task_bind':
                self._handle_task_bind(data)
            elif cmd_type == 'task_control':
                self._handle_task_control(command, data)
            elif cmd_type == 'cmd':
                self._handle_cmd(command, data)
        except Exception as e:
            logger.error(f'[{self.name}] 处理消息失败: {e}', exc_info=True)

    def _handle_task_bind(self, data: dict):
        self._task = {
            'task_id': data.get('task_id'),
            'task_code': data.get('task_code'),
            'route_id': data.get('route_id'),
            'line_id': data.get('line_id'),
            'altitude': data.get('altitude', 50),
            'speed': data.get('speed', 8),
        }
        wps = data.get('waypoints_geom') or data.get('waypoints') or []
        if wps:
            self._waypoints = [list(wp[:2]) if isinstance(wp, (list, tuple)) else [wp['lon'], wp['lat']] for wp in wps]
        if not self._waypoints:
            self._waypoints = [
                [self._base_lon + 0.001 * i, self._base_lat + 0.0008 * i]
                for i in range(10)
            ]
        logger.info(f'[{self.name}] 任务绑定成功: {self._task["task_code"]} 航点数={len(self._waypoints)}')
        self._send_response('task_bind', True, f'绑定{self._task["task_code"]}成功')

    def _handle_task_control(self, command: str, data: dict):
        if command == 'start':
            self._flight_status = 'takeoff'
            self._start_time = time.time()
            self._current_wp = 0
            self._photos = 0
            self._videos = 0
            self._elapsed = 0
            logger.info(f'[{self.name}] 任务开始执行')
            self._send_response('task_start', True, '任务已启动')
        elif command == 'pause':
            self._flight_status = 'paused'
            self._send_response('task_pause', True, '任务已暂停')
        elif command == 'resume':
            self._flight_status = 'cruising'
            self._send_response('task_resume', True, '任务已恢复')
        elif command == 'stop' or command == 'return_home':
            self._flight_status = 'returning'
            self._send_response(command, True, '正在返航')
        else:
            self._send_response(command, False, f'未知指令: {command}')

    def _handle_cmd(self, command: str, data: dict):
        if command == 'reboot':
            logger.info(f'[{self.name}] 正在重启')
            self._send_response('reboot', True, '重启中')
        elif command == 'status':
            self._send_response('status', True, 'OK', {
                'status': self._flight_status,
                'battery': self._battery,
                'latitude': self._lat,
                'longitude': self._lon,
            })
        else:
            self._send_response(command, True, f'收到{command}')

    def _publish(self, topic: str, payload: dict, qos: int = 1):
        if not self.client:
            return
        try:
            msg = json.dumps(payload, ensure_ascii=False, default=str)
            self.client.publish(topic, msg, qos=qos)
        except Exception as e:
            logger.error(f'[{self.name}] 发布失败 topic={topic}: {e}')

    def _send_response(self, command: str, success: bool, message: str, data: dict = None):
        payload = {
            'report_time': datetime.now(dt_timezone.utc).isoformat(),
            'command': command,
            'success': success,
            'message': message,
            'data': data or {},
        }
        self._publish(f'drone/{self.device_id}/response', payload, qos=1)

    def _report_heartbeat(self):
        payload = {
            'device_id': self.device_id,
            'drone_id': self.drone_id,
            'report_time': datetime.now(dt_timezone.utc).isoformat(),
            'report_type': 'heartbeat',
            'serial_number': self.device_id,
            'model': self.model,
            'firmware_version': self.firmware_version,
            'battery': self._battery,
            'signal_strength': self._signal,
            'latitude': self._lat,
            'longitude': self._lon,
            'altitude': self._alt,
            'speed': self._speed,
            'heading': self._heading,
            'status': self._flight_status,
            'current_task_id': self._task['task_id'] if self._task else None,
        }
        self._publish(f'drone/{self.device_id}/heartbeat', payload)

    def _report_telemetry(self):
        payload = {
            'device_id': self.device_id,
            'drone_id': self.drone_id,
            'report_time': datetime.now(dt_timezone.utc).isoformat(),
            'report_type': 'telemetry',
            'latitude': self._lat,
            'longitude': self._lon,
            'altitude': self._alt,
            'speed': self._speed,
            'heading': self._heading,
            'battery': self._battery,
            'signal_strength': self._signal,
            'satellites': self._satellites,
            'temperature': self._temperature,
            'wind_speed': round(random.uniform(0, 5), 1),
            'task_id': self._task['task_id'] if self._task else None,
        }
        self._publish(f'drone/{self.device_id}/telemetry', payload)

    def _report_task_summary(self):
        if not self._task:
            return
        total = len(self._waypoints)
        progress = min(100.0, (self._current_wp / max(total, 1)) * 100)
        distance = progress * 0.01 * 5000
        payload = {
            'device_id': self.device_id,
            'drone_id': self.drone_id,
            'report_time': datetime.now(dt_timezone.utc).isoformat(),
            'report_type': 'task_summary',
            'task_id': self._task['task_id'],
            'route_id': self._task['route_id'],
            'line_id': self._task['line_id'],
            'task_status': self._flight_status,
            'flight_phase': {
                'idle': '待飞',
                'takeoff': '起飞',
                'climbing': '爬升中',
                'cruising': '巡航中',
                'turning': '转弯中',
                'descending': '下降中',
                'landing': '降落中',
                'paused': '暂停',
                'returning': '返航中',
                'completed': '任务完成',
            }.get(self._flight_status, self._flight_status),
            'current_waypoint_index': self._current_wp,
            'total_waypoints': total,
            'progress': round(progress, 2),
            'flight_distance': round(distance, 2),
            'remaining_distance': round(max(0, 5000 - distance), 2),
            'elapsed_time': int(self._elapsed),
            'remaining_time': int(max(0, (5000 - distance) / max(self._task['speed'], 1))),
            'photos_taken': self._photos,
            'videos_recorded': self._videos,
            'battery_used': 100 - self._battery,
            'latitude': self._lat,
            'longitude': self._lon,
            'altitude': self._alt,
            'speed': self._speed,
            'heading': self._heading,
            'battery': self._battery,
        }
        self._publish(f'drone/{self.device_id}/task_summary', payload)

    def _report_media(self):
        if not self._task:
            return
        is_video = random.random() < 0.15
        media_type = 'video' if is_video else 'image'
        ext = 'mp4' if is_video else 'jpg'
        idx = self._videos + 1 if is_video else self._photos + 1
        file_name = f'{self._task.get("task_code", "TASK")}_{idx:04d}.{ext}'
        url = f'https://oss.example.com/drone-media/{self.device_id}/{datetime.now().strftime("%Y%m%d")}/{file_name}'
        payload = {
            'device_id': self.device_id,
            'drone_id': self.drone_id,
            'report_time': datetime.now(dt_timezone.utc).isoformat(),
            'report_type': 'media',
            'task_id': self._task['task_id'],
            'media_type': media_type,
            'file_name': file_name,
            'file_url': url,
            'thumbnail_url': url + '?x-oss-process=image/resize,w_400' if media_type == 'image' else '',
            'file_size': random.randint(2_000_000, 15_000_000),
            'duration': random.randint(10, 60) if is_video else 0,
            'latitude': self._lat,
            'longitude': self._lon,
            'altitude': self._alt,
            'heading': self._heading,
        }
        self._publish(f'drone/{self.device_id}/media', payload)
        if is_video:
            self._videos += 1
        else:
            self._photos += 1

    def _report_event(self):
        if random.random() > 0.08:
            return
        levels = ['info', 'warning', 'error']
        categories = {
            'battery': [('warning', '电量低于50%'), ('error', '电量低于20%')],
            'signal': [('warning', '信号较弱'), ('info', '信号恢复')],
            'weather': [('info', '风速5m/s'), ('warning', '风速超过8m/s')],
            'device': [('info', '相机温度45℃'), ('warning', 'IMU漂移告警')],
            'obstacle': [('warning', '前方检测障碍物')],
            'other': [('info', '已到达航点')],
        }
        cat = random.choice(list(categories.keys()))
        level, title = random.choice(categories[cat])
        payload = {
            'device_id': self.device_id,
            'drone_id': self.drone_id,
            'report_time': datetime.now(dt_timezone.utc).isoformat(),
            'report_type': 'event',
            'event_level': level,
            'event_category': cat,
            'event_code': f'{cat.upper()}_{random.randint(100,999)}',
            'title': title,
            'description': f'自动模拟事件 - {title}',
            'latitude': self._lat,
            'longitude': self._lon,
            'altitude': self._alt,
        }
        self._publish(f'drone/{self.device_id}/event', payload)
        if level == 'error' and cat == 'battery' and self._battery < 30:
            self._flight_status = 'returning'
            logger.info(f'[{self.name}] 电量告警，自动返航')

    def _update_flight_state(self):
        if self._flight_status == 'idle':
            self._alt = max(0, self._alt - 0.5)
            self._speed = 0
            return

        if self._flight_status == 'takeoff':
            self._alt = min(self._task['altitude'], self._alt + 1.5)
            self._speed = 0
            if self._alt >= self._task['altitude'] * 0.9:
                self._flight_status = 'climbing'
            return

        if self._flight_status == 'climbing':
            self._alt = min(self._task['altitude'], self._alt + 1)
            self._speed = min(self._task['speed'], self._speed + 0.5)
            if self._alt >= self._task['altitude'] - 0.5 and self._waypoints:
                self._flight_status = 'cruising'
            return

        if self._flight_status == 'cruising' and self._waypoints:
            self._alt = self._task['altitude'] + random.uniform(-0.5, 0.5)
            self._speed = self._task['speed'] + random.uniform(-0.5, 0.5)

            if self._current_wp < len(self._waypoints):
                target_lon, target_lat = self._waypoints[self._current_wp]
                d_lat = target_lat - self._lat
                d_lon = target_lon - self._lon
                dist = (d_lat ** 2 + d_lon ** 2) ** 0.5
                step = 0.00005 * (self._speed / 8)
                if dist < step:
                    self._lat = target_lat
                    self._lon = target_lon
                    self._current_wp += 1
                    logger.info(f'[{self.name}] 到达航点 {self._current_wp}/{len(self._waypoints)}')
                    if self._current_wp >= len(self._waypoints):
                        self._flight_status = 'returning'
                else:
                    self._heading = (math.atan2(d_lat, d_lon) * 180 / math.pi) % 360
                    ratio = step / dist
                    self._lat += d_lat * ratio
                    self._lon += d_lon * ratio
            return

        if self._flight_status == 'returning':
            self._alt = max(5, self._alt - 0.8)
            d_lat = self._base_lat - self._lat
            d_lon = self._base_lon - self._lon
            dist = (d_lat ** 2 + d_lon ** 2) ** 0.5
            step = 0.00004
            if dist < step and self._alt <= 5:
                self._flight_status = 'landing'
            else:
                self._heading = (math.atan2(d_lat, d_lon) * 180 / math.pi) % 360
                ratio = step / max(dist, 0.000001)
                self._lat += d_lat * ratio
                self._lon += d_lon * ratio
                self._speed = max(2, self._speed - 0.05)
            return

        if self._flight_status == 'landing':
            self._alt = max(0, self._alt - 0.3)
            self._speed = max(0, self._speed - 0.1)
            if self._alt <= 0.1:
                self._alt = 0
                self._flight_status = 'completed'
                self._task = None
                self._speed = 0
                logger.info(f'[{self.name}] 任务完成，已降落')
                self._send_response('task_complete', True, '任务完成')
            return

        if self._flight_status == 'paused':
            self._speed = 0
            return

    def _consume_battery(self):
        if self._flight_status == 'idle':
            drain = 0.02
        elif self._flight_status in ['takeoff', 'climbing']:
            drain = 0.3
        elif self._flight_status in ['landing', 'descending']:
            drain = 0.15
        elif self._flight_status in ['returning']:
            drain = 0.2
        else:
            drain = 0.18
        self._battery = max(0, self._battery - drain)

        self._signal = max(60, min(100, self._signal + random.uniform(-3, 2)))
        self._temperature = 25 + 10 * (1 - self._battery / 100) + random.uniform(-1, 1)

        if self._start_time:
            self._elapsed = time.time() - self._start_time

    def _heartbeat_loop(self):
        while self._running:
            try:
                self._report_heartbeat()
            except Exception as e:
                logger.error(f'[{self.name}] 心跳异常: {e}')
            time.sleep(self._heartbeat_interval)

    def _telemetry_loop(self):
        while self._running:
            try:
                self._update_flight_state()
                self._consume_battery()
                self._report_telemetry()
                self._report_event()
            except Exception as e:
                logger.error(f'[{self.name}] 遥测异常: {e}')
            time.sleep(self._telemetry_interval)

    def _summary_loop(self):
        while self._running:
            try:
                self._report_task_summary()
            except Exception as e:
                logger.error(f'[{self.name}] 汇总异常: {e}')
            time.sleep(self._summary_interval)

    def _media_loop(self):
        while self._running:
            try:
                if self._flight_status in ['cruising', 'climbing']:
                    self._report_media()
            except Exception as e:
                logger.error(f'[{self.name}] 媒体异常: {e}')
            time.sleep(self._media_interval)

    def start(self):
        if self._running:
            return
        self._running = True
        self._threads = [
            threading.Thread(target=self._heartbeat_loop, daemon=True, name=f'{self.name}-hb'),
            threading.Thread(target=self._telemetry_loop, daemon=True, name=f'{self.name}-tel'),
            threading.Thread(target=self._summary_loop, daemon=True, name=f'{self.name}-sum'),
            threading.Thread(target=self._media_loop, daemon=True, name=f'{self.name}-med'),
        ]
        for t in self._threads:
            t.start()
        logger.info(f'[{self.name}] 模拟器已启动')

    def stop(self):
        self._running = False
        for t in self._threads:
            t.join(timeout=2)
        if self.client:
            self.client.loop_stop()
            self.client.disconnect()
        logger.info(f'[{self.name}] 模拟器已停止')

    def start_task(self, task_data: dict = None):
        if not task_data:
            task_data = {
                'task_id': self.drone_id * 100 + random.randint(1, 99),
                'task_code': f'SIM{self.drone_id}{datetime.now().strftime("%m%d%H%M")}',
                'route_id': self.drone_id,
                'line_id': self.drone_id,
                'altitude': 50,
                'speed': 8,
                'waypoints_geom': [[self._base_lon + 0.001 * i, self._base_lat + 0.0008 * i] for i in range(15)],
            }
        self._handle_task_bind(task_data)
        self._handle_task_control('start', {})


import math


class DroneSimulator:
    def __init__(self, broker='localhost', port=1883, username=None, password=None):
        self.broker = broker
        self.port = port
        self.username = username
        self.password = password
        self.drones: dict[int, SimulatedDrone] = {}

    def add_drone(self, drone_config: dict) -> SimulatedDrone:
        drone = SimulatedDrone(drone_config)
        drone.connect(self.broker, self.port, self.username, self.password)
        drone.start()
        self.drones[drone.drone_id] = drone
        return drone

    def load_from_api(self, api_base: str, token: str):
        import requests
        try:
            resp = requests.get(
                f'{api_base}/api/mqtt/drones/',
                headers={'Authorization': f'Bearer {token}'},
                timeout=10,
            )
            if resp.status_code != 200:
                logger.error(f'获取无人机列表失败: {resp.status_code}')
                return 0
            data = resp.json()
            items = data.get('results', data if isinstance(data, list) else [])
            for item in items:
                self.add_drone(item)
            logger.info(f'从API加载 {len(items)} 架无人机')
            return len(items)
        except Exception as e:
            logger.error(f'加载无人机失败: {e}')
            return 0

    def start_all_tasks(self):
        for d in self.drones.values():
            d.start_task()

    def stop_all(self):
        for d in list(self.drones.values()):
            d.stop()
        self.drones.clear()

    def create_demo_drones(self, count=3, base_lat=30.6598, base_lon=104.0657):
        models = ['DJI-Matrice-300', 'DJI-M300-RTK', 'DJI-Mavic-3-Enterprise', 'Autel-EVO-II']
        for i in range(count):
            cfg = {
                'id': i + 1,
                'serial_number': f'SIM-DRONE-{i + 1:04d}',
                'name': f'模拟无人机-{i + 1}',
                'model': models[i % len(models)],
                'firmware_version': f'v1.{random.randint(0,3)}.{random.randint(0,9)}',
                'latitude': base_lat + 0.001 * i,
                'longitude': base_lon + 0.0012 * i,
                'mqtt_token': f'token-sim-{i + 1}',
            }
            self.add_drone(cfg)
        return len(self.drones)
