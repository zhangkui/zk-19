from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    DroneViewSet, FlightRouteViewSet, InspectionTaskViewSet,
    InspectionMediaViewSet, DefectViewSet, AlertViewSet,
    SystemLogViewSet, DroneTelemetryViewSet,
)

router = DefaultRouter()
router.register(r'drones', DroneViewSet, basename='drone')
router.register(r'flight-routes', FlightRouteViewSet, basename='flight-route')
router.register(r'tasks', InspectionTaskViewSet, basename='task')
router.register(r'media', InspectionMediaViewSet, basename='media')
router.register(r'defects', DefectViewSet, basename='defect')
router.register(r'alerts', AlertViewSet, basename='alert')
router.register(r'system-logs', SystemLogViewSet, basename='system-log')
router.register(r'drone-telemetries', DroneTelemetryViewSet, basename='drone-telemetry')

urlpatterns = [
    path('', include(router.urls)),
]
