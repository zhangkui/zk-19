from django.db import models
from lines.models import Tower
from accounts.models import User
from inspection.models import Defect


class WorkOrder(models.Model):
    STATUS_CHOICES = [
        ('created', '已创建'),
        ('assigned', '已派发'),
        ('processing', '处理中'),
        ('review', '待复核'),
        ('closed', '已闭环'),
        ('cancelled', '已取消'),
    ]

    PRIORITY_CHOICES = [
        ('urgent', '紧急'),
        ('high', '高'),
        ('normal', '普通'),
        ('low', '低'),
    ]

    SEVERITY_CHOICES = [
        ('critical', '危急'),
        ('major', '重大'),
        ('minor', '一般'),
    ]

    code = models.CharField(max_length=60, unique=True, verbose_name='工单编号')
    title = models.CharField(max_length=200, verbose_name='工单标题')
    description = models.TextField(verbose_name='工单描述')
    defect = models.ForeignKey(Defect, on_delete=models.SET_NULL, null=True, blank=True, related_name='work_orders', verbose_name='关联缺陷')
    tower = models.ForeignKey(Tower, on_delete=models.CASCADE, related_name='work_orders', verbose_name='杆塔')
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default='minor', verbose_name='严重程度')
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='normal', verbose_name='优先级')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='created', verbose_name='状态')
    assignee = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_work_orders', verbose_name='责任人')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_work_orders', verbose_name='创建人')
    reviewer = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_work_orders', verbose_name='复核人')
    planned_start = models.DateTimeField(null=True, blank=True, verbose_name='计划开始')
    planned_end = models.DateTimeField(null=True, blank=True, verbose_name='计划完成')
    actual_start = models.DateTimeField(null=True, blank=True, verbose_name='实际开始')
    actual_end = models.DateTimeField(null=True, blank=True, verbose_name='实际完成')
    closed_at = models.DateTimeField(null=True, blank=True, verbose_name='闭环时间')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'ops_workorder'
        verbose_name = '消缺工单'
        verbose_name_plural = '消缺工单'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.code} - {self.title}'

    @property
    def status_display(self):
        return self.get_status_display()


class WorkOrderLog(models.Model):
    ACTION_CHOICES = [
        ('create', '创建'),
        ('assign', '派发'),
        ('start', '开始处理'),
        ('progress', '进度更新'),
        ('submit_review', '提交复核'),
        ('review_pass', '复核通过'),
        ('review_fail', '复核驳回'),
        ('close', '闭环'),
        ('cancel', '取消'),
        ('note', '备注'),
    ]

    work_order = models.ForeignKey(WorkOrder, on_delete=models.CASCADE, related_name='logs', verbose_name='工单')
    action = models.CharField(max_length=20, choices=ACTION_CHOICES, verbose_name='动作')
    operator = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, verbose_name='操作人')
    note = models.TextField(blank=True, verbose_name='说明')
    from_status = models.CharField(max_length=20, blank=True, verbose_name='原状态')
    to_status = models.CharField(max_length=20, blank=True, verbose_name='目标状态')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'ops_workorder_log'
        verbose_name = '工单日志'
        verbose_name_plural = '工单日志'
        ordering = ['created_at']

    def __str__(self):
        return f'{self.work_order.code} - {self.get_action_display()}'
