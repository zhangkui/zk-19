from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import LineViewSet, SectionViewSet, TowerViewSet

router = DefaultRouter()
router.register(r'lines', LineViewSet, basename='line')
router.register(r'sections', SectionViewSet, basename='section')
router.register(r'towers', TowerViewSet, basename='tower')

urlpatterns = [
    path('', include(router.urls)),
]
