from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    MqttConfigViewSet, DroneMqttViewSet,
    DroneTelemetryViewSet, DroneEventViewSet,
    DroneMediaReportViewSet, DroneTaskSummaryViewSet,
    TaskPushViewSet,
)

router = DefaultRouter()
router.register(r'config', MqttConfigViewSet, basename='mqtt-config')
router.register(r'drones', DroneMqttViewSet, basename='mqtt-drone')
router.register(r'telemetries', DroneTelemetryViewSet, basename='mqtt-telemetry')
router.register(r'events', DroneEventViewSet, basename='mqtt-event')
router.register(r'media-reports', DroneMediaReportViewSet, basename='mqtt-media')
router.register(r'task-summaries', DroneTaskSummaryViewSet, basename='mqtt-task-summary')
router.register(r'task-push', TaskPushViewSet, basename='mqtt-task-push')

urlpatterns = [
    path('', include(router.urls)),
]
