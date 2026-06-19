from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    ROLE_ADMIN = 'admin'
    ROLE_PILOT = 'pilot'
    ROLE_REVIEWER = 'reviewer'
    ROLE_CREW = 'crew'

    ROLE_CHOICES = [
        (ROLE_ADMIN, '调度管理员'),
        (ROLE_PILOT, '无人机飞手'),
        (ROLE_REVIEWER, '缺陷审核员'),
        (ROLE_CREW, '检修班组'),
    ]

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_PILOT)
    name = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=20, blank=True)

    class Meta:
        db_table = 'accounts_user'

    def __str__(self):
        return f'{self.username}({self.get_role_display()})'
