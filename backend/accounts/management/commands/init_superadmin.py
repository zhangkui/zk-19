from django.core.management.base import BaseCommand
from accounts.models import User


class Command(BaseCommand):
    help = '初始化超级管理员账号'

    def add_arguments(self, parser):
        parser.add_argument('--username', type=str, default='superadmin', help='超级管理员用户名')
        parser.add_argument('--password', type=str, default='Super@123456', help='超级管理员密码')
        parser.add_argument('--name', type=str, default='超级管理员', help='姓名')
        parser.add_argument('--email', type=str, default='superadmin@zk19.com', help='邮箱')

    def handle(self, *args, **options):
        username = options['username']
        password = options['password']
        name = options['name']
        email = options['email']

        if User.objects.filter(username=username).exists():
            user = User.objects.get(username=username)
            if user.role != User.ROLE_SUPERADMIN:
                user.role = User.ROLE_SUPERADMIN
                user.save()
                self.stdout.write(self.style.WARNING(f'用户 {username} 已存在，已升级为超级管理员'))
            else:
                self.stdout.write(self.style.SUCCESS(f'超级管理员 {username} 已存在'))
            return

        User.objects.create_superuser(
            username=username,
            password=password,
            email=email,
            role=User.ROLE_SUPERADMIN,
            name=name,
        )
        self.stdout.write(self.style.SUCCESS(
            f'超级管理员账号创建成功！\n'
            f'用户名: {username}\n'
            f'密码: {password}\n'
            f'姓名: {name}'
        ))
