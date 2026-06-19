from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['username', 'name', 'role', 'email', 'is_staff']
    list_filter = ['role', 'is_staff', 'is_superuser']
    fieldsets = BaseUserAdmin.fieldsets + (
        ('角色信息', {'fields': ('role', 'name', 'phone')}),
    )
    search_fields = ['username', 'name', 'email']
