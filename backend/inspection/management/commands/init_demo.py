from django.core.management.base import BaseCommand
from django.contrib.gis.geos import Point, LineString
from django.utils import timezone
from accounts.models import User
from lines.models import Line, Section, Tower
from inspection.models import Drone, FlightRoute, InspectionTask, InspectionMedia, Defect, Alert
from ops.models import WorkOrder, WorkOrderLog
import random
from datetime import timedelta


class Command(BaseCommand):
    help = 'Initialize demo data'

    def handle(self, *args, **options):
        self.stdout.write('Creating demo users...')
        self._create_users()

        self.stdout.write('Creating demo lines and towers...')
        self._create_lines_and_towers()

        self.stdout.write('Creating demo drones and routes...')
        self._create_drones_and_routes()

        self.stdout.write('Creating demo inspection tasks and defects...')
        self._create_tasks_and_defects()

        self.stdout.write('Creating demo work orders...')
        self._create_workorders()

        self.stdout.write(self.style.SUCCESS('Demo data initialized successfully!'))

    def _create_users(self):
        roles = [
            ('admin', 'admin', '调度管理员', User.ROLE_ADMIN),
            ('pilot1', 'pilot123', '张飞手', User.ROLE_PILOT),
            ('pilot2', 'pilot123', '李飞手', User.ROLE_PILOT),
            ('reviewer1', 'reviewer123', '王审核', User.ROLE_REVIEWER),
            ('crew1', 'crew123', '检修一班', User.ROLE_CREW),
            ('crew2', 'crew123', '检修二班', User.ROLE_CREW),
        ]
        for username, password, name, role in roles:
            if not User.objects.filter(username=username).exists():
                user = User.objects.create_user(
                    username=username,
                    password=password,
                    name=name,
                    role=role,
                    email=f'{username}@example.com',
                )
                self.stdout.write(f'  Created user: {username} ({name})')

    def _create_lines_and_towers(self):
        if Line.objects.exists():
            self.stdout.write('  Lines already exist, skipping.')
            return

        base_lon = 116.4
        base_lat = 39.9

        lines_data = [
            {
                'name': '220kV 京山线',
                'voltage': '220kV',
                'towers': 15,
                'start_lon': base_lon,
                'start_lat': base_lat,
                'end_lon': base_lon + 0.15,
                'end_lat': base_lat + 0.08,
            },
            {
                'name': '110kV 滨河线',
                'voltage': '110kV',
                'towers': 12,
                'start_lon': base_lon + 0.05,
                'start_lat': base_lat + 0.02,
                'end_lon': base_lon + 0.20,
                'end_lat': base_lat - 0.05,
            },
            {
                'name': '500kV 丰北线',
                'voltage': '500kV',
                'towers': 20,
                'start_lon': base_lon - 0.05,
                'start_lat': base_lat - 0.03,
                'end_lon': base_lon + 0.10,
                'end_lat': base_lat - 0.12,
            },
        ]

        for line_data in lines_data:
            tower_coords = []
            for i in range(line_data['towers']):
                ratio = i / (line_data['towers'] - 1)
                lon = line_data['start_lon'] + (line_data['end_lon'] - line_data['start_lon']) * ratio
                lat = line_data['start_lat'] + (line_data['end_lat'] - line_data['start_lat']) * ratio
                lon += random.uniform(-0.002, 0.002)
                lat += random.uniform(-0.002, 0.002)
                tower_coords.append((lon, lat))

            line_geom = LineString(tower_coords, srid=4326)
            line = Line.objects.create(
                name=line_data['name'],
                voltage=line_data['voltage'],
                geom=line_geom,
                description=f'{line_data["voltage"]} 山区输电线路，全长约{line_geom.length * 111:.2f}公里',
            )

            num_sections = max(1, line_data['towers'] // 5)
            towers_per_section = line_data['towers'] // num_sections

            for s in range(num_sections):
                section = Section.objects.create(
                    line=line,
                    name=f'第{s+1}区段',
                    start_km=s * towers_per_section * 0.5,
                    end_km=(s + 1) * towers_per_section * 0.5,
                )

                for i in range(towers_per_section):
                    tower_idx = s * towers_per_section + i
                    if tower_idx >= len(tower_coords):
                        break
                    lon, lat = tower_coords[tower_idx]
                    tower_types = ['straight', 'angle', 'tension']
                    Tower.objects.create(
                        line=line,
                        section=section,
                        code=f'{line_data["name"][:2].upper()}{tower_idx + 1:03d}',
                        geom=Point(lon, lat, srid=4326),
                        height=random.choice([25, 30, 35, 40, 45]),
                        tower_type=random.choice(tower_types),
                        sequence=tower_idx + 1,
                    )

            self.stdout.write(f'  Created line: {line.name} with {line_data["towers"]} towers')

    def _create_drones_and_routes(self):
        if Drone.objects.exists():
            self.stdout.write('  Drones already exist, skipping.')
            return

        drones_data = [
            {'name': '大疆 M300-01', 'model': 'DJI Matrice 300 RTK', 'serial': 'DJI-M300-001'},
            {'name': '大疆 M300-02', 'model': 'DJI Matrice 300 RTK', 'serial': 'DJI-M300-002'},
            {'name': '大疆 M3E-01', 'model': 'DJI Mavic 3E', 'serial': 'DJI-M3E-001'},
            {'name': '纵横 CW-15', 'model': 'JOUAV CW-15', 'serial': 'JOUAV-CW15-001'},
        ]
        for d in drones_data:
            drone = Drone.objects.create(
                name=d['name'],
                model=d['model'],
                serial_number=d['serial'],
                status=random.choice(['idle', 'idle', 'busy', 'maintenance']),
                battery=random.randint(50, 100),
                max_flight_time=random.choice([30, 40, 55]),
            )
            self.stdout.write(f'  Created drone: {drone.name}')

        pilot = User.objects.filter(role=User.ROLE_PILOT).first()
        for line in Line.objects.all():
            towers = list(line.towers.order_by('sequence'))
            if len(towers) < 2:
                continue

            waypoints = []
            for t in towers:
                waypoints.append((t.geom.x, t.geom.y + 0.0005))

            route = FlightRoute.objects.create(
                name=f'{line.name} 常规巡检航线',
                line=line,
                waypoints=LineString(waypoints, srid=4326),
                waypoints_data=[{'lon': wp[0], 'lat': wp[1], 'altitude': 50, 'speed': 8} for wp in waypoints],
                altitude=50,
                speed=8,
                estimated_duration=len(towers) * 2,
                status=random.choice(['draft', 'approved', 'approved']),
                description=f'{line.name} 标准巡检航线',
                created_by=pilot,
            )
            self.stdout.write(f'  Created route: {route.name}')

    def _create_tasks_and_defects(self):
        if InspectionTask.objects.exists():
            self.stdout.write('  Tasks already exist, skipping.')
            return

        pilot = User.objects.filter(role=User.ROLE_PILOT).first()
        drones = list(Drone.objects.all())
        routes = list(FlightRoute.objects.filter(status='approved'))

        task_count = 6
        for i in range(task_count):
            route = random.choice(routes)
            drone = random.choice(drones)
            task_date = timezone.now() - timedelta(days=random.randint(0, 10))

            task = InspectionTask.objects.create(
                code=f'TASK{task_date.strftime("%Y%m%d")}{i+1:03d}',
                name=f'{route.line.name} 日常巡检-{i+1}',
                route=route,
                drone=drone,
                pilot=pilot,
                status=random.choice(['completed', 'completed', 'completed', 'running', 'pending']),
                planned_date=task_date.date(),
                started_at=task_date if random.random() > 0.2 else None,
                ended_at=task_date + timedelta(hours=2) if random.random() > 0.3 else None,
                notes=f'第{i+1}次例行巡检任务',
                created_by=pilot,
            )

            if task.status in ['completed', 'running']:
                towers = list(route.line.towers.order_by('sequence'))
                media_count = random.randint(5, min(15, len(towers)))
                selected_towers = random.sample(towers, min(media_count, len(towers)))

                for idx, tower in enumerate(selected_towers):
                    media = InspectionMedia.objects.create(
                        task=task,
                        tower=tower,
                        media_type='image',
                        geom=tower.geom,
                        captured_at=task_date + timedelta(minutes=idx * 3),
                        altitude=50 + random.uniform(-10, 10),
                    )
                    task.media_count += 1
                    task.save()

                    if random.random() < 0.4:
                        num_defects = random.randint(1, 2)
                        for _ in range(num_defects):
                            defect_types = ['insulator', 'tower', 'hardware', 'conductor']
                            subtypes_map = {
                                'insulator': ['breakage', 'tilt', 'pollution', 'missing'],
                                'tower': ['rust', 'bolt_missing', 'deformation', 'crack'],
                                'hardware': ['loose', 'rust', 'damage'],
                                'conductor': ['broken_strand', 'discharge', 'foreign_matter'],
                            }
                            severities = ['critical', 'major', 'minor', 'minor', 'minor']

                            defect_type = random.choice(defect_types)
                            subtype = random.choice(subtypes_map[defect_type])
                            severity = random.choice(severities)

                            defect = Defect.objects.create(
                                media=media,
                                tower=tower,
                                task=task,
                                defect_type=defect_type,
                                subtype=subtype,
                                severity=severity,
                                status=random.choice(['pending', 'confirmed', 'confirmed', 'rejected']),
                                bbox={
                                    'x': random.randint(100, 400),
                                    'y': random.randint(100, 300),
                                    'width': random.randint(50, 150),
                                    'height': random.randint(50, 150),
                                },
                                confidence=round(random.uniform(0.6, 0.99), 2),
                                description=f'AI自动识别：{defect_type}-{subtype}',
                            )

                            if defect.status == 'confirmed':
                                reviewer = User.objects.filter(role=User.ROLE_REVIEWER).first()
                                defect.reviewed_by = reviewer
                                defect.reviewed_at = task_date + timedelta(hours=3)
                                defect.review_note = '审核通过，确认为该缺陷'
                                defect.save()

                                Alert.objects.create(
                                    defect=defect,
                                    tower=tower,
                                    category='defect',
                                    level=severity,
                                    title=f'{tower.code} {defect.get_defect_type_display()}缺陷',
                                    content=f'{tower.line.name} {tower.code} 发现{defect.get_severity_display()}{defect.get_subtype_display()}缺陷',
                                    status=random.choice(['open', 'handled']),
                                    created_at=task_date + timedelta(hours=3),
                                )

                            media.has_defect = True
                            media.defect_count += 1
                            media.save()
                            task.defect_count += 1
                            task.save()

            self.stdout.write(f'  Created task: {task.code} with {task.media_count} media, {task.defect_count} defects')

    def _create_workorders(self):
        if WorkOrder.objects.exists():
            self.stdout.write('  Work orders already exist, skipping.')
            return

        confirmed_defects = Defect.objects.filter(status='confirmed')
        crew1 = User.objects.filter(role=User.ROLE_CREW).first()
        reviewer = User.objects.filter(role=User.ROLE_REVIEWER).first()

        for i, defect in enumerate(confirmed_defects):
            if i >= 8:
                break

            statuses = ['created', 'assigned', 'processing', 'review', 'closed']
            status = random.choice(statuses)

            wo = WorkOrder.objects.create(
                code=f'WO{defect.created_at.strftime("%Y%m%d")}{i+1:03d}',
                title=f'{defect.tower.code} {defect.get_defect_type_display()}消缺',
                description=f'{defect.get_severity_display()}{defect.get_subtype_display()}缺陷，需要及时处理',
                defect=defect,
                tower=defect.tower,
                severity=defect.severity,
                priority=random.choice(['urgent', 'high', 'normal', 'normal']),
                status=status,
                assignee=crew1 if status not in ['created'] else None,
                created_by=reviewer,
                reviewer=reviewer if status in ['review', 'closed'] else None,
                planned_start=defect.created_at + timedelta(days=1),
                planned_end=defect.created_at + timedelta(days=3),
                actual_start=defect.created_at + timedelta(days=1, hours=2) if status in ['processing', 'review', 'closed'] else None,
                actual_end=defect.created_at + timedelta(days=2) if status == 'closed' else None,
                closed_at=defect.created_at + timedelta(days=2, hours=4) if status == 'closed' else None,
            )

            WorkOrderLog.objects.create(
                work_order=wo,
                action='create',
                operator=reviewer,
                note='工单创建',
                to_status='created',
            )

            if status in ['assigned', 'processing', 'review', 'closed']:
                WorkOrderLog.objects.create(
                    work_order=wo,
                    action='assign',
                    operator=reviewer,
                    note=f'派发给{crew1.name}',
                    from_status='created',
                    to_status='assigned',
                )

            if status in ['processing', 'review', 'closed']:
                WorkOrderLog.objects.create(
                    work_order=wo,
                    action='start',
                    operator=crew1,
                    note='开始消缺作业',
                    from_status='assigned',
                    to_status='processing',
                )

            if status in ['review', 'closed']:
                WorkOrderLog.objects.create(
                    work_order=wo,
                    action='submit_review',
                    operator=crew1,
                    note='消缺完成，申请复核',
                    from_status='processing',
                    to_status='review',
                )

            if status == 'closed':
                WorkOrderLog.objects.create(
                    work_order=wo,
                    action='review_pass',
                    operator=reviewer,
                    note='复核通过，缺陷已消除',
                    from_status='review',
                    to_status='closed',
                )

            self.stdout.write(f'  Created work order: {wo.code} ({status})')
