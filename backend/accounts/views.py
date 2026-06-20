from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from rest_framework_simplejwt.views import TokenObtainPairView
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter

from .models import User
from .serializers import UserSerializer, UserListSerializer, CustomTokenObtainPairSerializer


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['role', 'is_active']
    search_fields = ['username', 'name', 'phone', 'email']

    def get_serializer_class(self):
        if self.action == 'list':
            return UserListSerializer
        return UserSerializer

    def _check_superadmin(self):
        if not self.request.user.is_superadmin:
            raise PermissionDenied('只有超级管理员可以管理账号')

    def list(self, request, *args, **kwargs):
        self._check_superadmin()
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        self._check_superadmin()
        return super().create(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        self._check_superadmin()
        return super().retrieve(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        self._check_superadmin()
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        self._check_superadmin()
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        self._check_superadmin()
        instance = self.get_object()
        if instance.id == request.user.id:
            return Response({'error': '不能删除自己的账号'}, status=status.HTTP_400_BAD_REQUEST)
        if instance.is_superadmin:
            return Response({'error': '不能删除超级管理员账号'}, status=status.HTTP_400_BAD_REQUEST)
        instance.is_active = False
        instance.save()
        return Response({'message': '账号已禁用'})

    @action(detail=False, methods=['get'])
    def me(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def options(self, request):
        users = User.objects.filter(is_active=True)
        role = request.query_params.get('role')
        if role:
            users = users.filter(role=role)
        data = [
            {'id': u.id, 'username': u.username, 'name': u.name or u.username, 'role': u.role}
            for u in users
        ]
        return Response(data)

