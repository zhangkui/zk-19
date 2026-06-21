import time
import signal
import sys
import logging
from django.core.management.base import BaseCommand

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)


class Command(BaseCommand):
    help = '启动无人机模拟器，模拟心跳、遥测、任务汇总、媒体、事件上报'

    def add_arguments(self, parser):
        parser.add_argument(
            '--count',
            type=int,
            default=3,
            help='模拟无人机数量 (默认: 3)',
        )
        parser.add_argument(
            '--broker',
            type=str,
            default=None,
            help='MQTT Broker地址 (默认读取settings)',
        )
        parser.add_argument(
            '--port',
            type=int,
            default=None,
            help='MQTT Broker端口',
        )
        parser.add_argument(
            '--username',
            type=str,
            default=None,
            help='MQTT用户名',
        )
        parser.add_argument(
            '--password',
            type=str,
            default=None,
            help='MQTT密码',
        )
        parser.add_argument(
            '--start-tasks',
            action='store_true',
            default=False,
            help='启动后自动开始模拟任务飞行',
        )
        parser.add_argument(
            '--api-token',
            type=str,
            default=None,
            help='从API加载真实无人机数据的Token',
        )
        parser.add_argument(
            '--api-base',
            type=str,
            default='http://localhost:8000',
            help='API基础URL',
        )
        parser.add_argument(
            '--base-lat',
            type=float,
            default=30.6598,
            help='基地纬度',
        )
        parser.add_argument(
            '--base-lon',
            type=float,
            default=104.0657,
            help='基地经度',
        )

    def handle(self, *args, **options):
        from django.conf import settings
        from drone_mqtt.simulator import DroneSimulator

        broker = options['broker'] or getattr(settings, 'MQTT_BROKER_HOST', 'localhost')
        port = options['port'] or getattr(settings, 'MQTT_BROKER_PORT', 1883)
        username = options['username'] or getattr(settings, 'MQTT_USERNAME', None)
        password = options['password'] or getattr(settings, 'MQTT_PASSWORD', None)

        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write(self.style.SUCCESS('  无人机模拟器启动'))
        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write(f'  MQTT Broker: {broker}:{port}')
        self.stdout.write(f'  用户名: {username or "(匿名)"}')
        self.stdout.write(f'  模拟数量: {options["count"]}')
        self.stdout.write(f'  基地位置: ({options["base_lat"]}, {options["base_lon"]})')
        self.stdout.write(self.style.SUCCESS('-' * 60))

        sim = DroneSimulator(broker, port, username, password)

        if options['api_token']:
            loaded = sim.load_from_api(options['api_base'], options['api_token'])
            if loaded == 0:
                self.stdout.write(self.style.WARNING('  API加载失败，创建模拟无人机'))
                sim.create_demo_drones(
                    count=options['count'],
                    base_lat=options['base_lat'],
                    base_lon=options['base_lon'],
                )
        else:
            sim.create_demo_drones(
                count=options['count'],
                base_lat=options['base_lat'],
                base_lon=options['base_lon'],
            )

        if options['start_tasks']:
            self.stdout.write(self.style.WARNING('  启动模拟飞行任务...'))
            sim.start_all_tasks()

        self.stdout.write(self.style.SUCCESS(f'  共启动 {len(sim.drones)} 架无人机模拟器'))
        self.stdout.write(self.style.WARNING('  按 Ctrl+C 停止'))
        self.stdout.write('-' * 60)

        running = True

        def _signal_handler(signum, frame):
            nonlocal running
            self.stdout.write('\n' + self.style.WARNING('正在停止模拟器...'))
            running = False

        signal.signal(signal.SIGINT, _signal_handler)
        signal.signal(signal.SIGTERM, _signal_handler)

        try:
            while running:
                status = []
                for d in sim.drones.values():
                    status.append(
                        f'{d.name[:10]}: st={d._flight_status[:3]} '
                        f'batt={int(d._battery)}% alt={d._alt:.0f}m '
                        f'wp={d._current_wp}/{len(d._waypoints)}'
                    )
                self.stdout.write('\r  ' + ' | '.join(status)[:120] + ' ' * 10, ending='')
                self.stdout.flush()
                time.sleep(1)
        except KeyboardInterrupt:
            pass

        self.stdout.write('\n')
        sim.stop_all()
        self.stdout.write(self.style.SUCCESS('模拟器已停止'))
        sys.exit(0)
