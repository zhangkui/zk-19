from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = '启动MQTT消费者，监听无人机上报消息'

    def add_arguments(self, parser):
        parser.add_argument(
            '--once',
            action='store_true',
            dest='once',
            default=False,
            help='启动后打印配置信息并退出',
        )

    def handle(self, *args, **options):
        if options['once']:
            from django.conf import settings
            self.stdout.write(self.style.SUCCESS('MQTT 消费者配置检查'))
            self.stdout.write(f'  Broker: {getattr(settings, "MQTT_BROKER_HOST", "localhost")}:{getattr(settings, "MQTT_BROKER_PORT", 1883)}')
            self.stdout.write(f'  Username: {getattr(settings, "MQTT_USERNAME", "(无)")}')
            self.stdout.write(f'  Keepalive: {getattr(settings, "MQTT_KEEPALIVE", 60)}s')
            self.stdout.write(self.style.SUCCESS('配置检查通过'))
            return

        self.stdout.write(self.style.SUCCESS('正在启动 MQTT 消费者...'))
        try:
            from drone_mqtt.consumer import main
            main()
        except ImportError as e:
            self.stderr.write(self.style.ERROR(f'导入失败: {e}'))
            self.stdout.write('请确保已安装 paho-mqtt: pip install paho-mqtt')
            import sys
            sys.exit(1)
        except KeyboardInterrupt:
            self.stdout.write(self.style.WARNING('已停止'))
        except Exception as e:
            self.stderr.write(self.style.ERROR(f'启动失败: {e}'))
            import sys
            sys.exit(1)
