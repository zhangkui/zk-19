from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import LineViewSet, SectionViewSet, TowerViewSet, ChangeHistoryViewSet

router = DefaultRouter()
router.register(r'lines', LineViewSet, basename='line')
router.register(r'sections', SectionViewSet, basename='section')
router.register(r'towers', TowerViewSet, basename='tower')
router.register(r'change-history', ChangeHistoryViewSet, basename='changehistory')

urlpatterns = [
    path('', include(router.urls)),
]
