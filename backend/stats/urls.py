from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import StatsViewSet

router = DefaultRouter()
router.register(r'', StatsViewSet, basename='stats')

urlpatterns = [
    path('', include(router.urls)),
]
