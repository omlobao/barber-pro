from rest_framework.permissions import BasePermission


class IsBarberShopStaff(BasePermission):
    """Permite o acesso a administradores ou profissionais ativos."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_staff:
            return True
        profile = getattr(user, 'professional_profile', None)
        return bool(profile and profile.is_active)


# Alias para compatibilidade de grafia
IsBarbershopStaff = IsBarberShopStaff


class IsOwnerOrReadOnly(BasePermission):
    """Apenas o dono pode criar/editar; barbeiros apenas visualizam."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True
        return request.user.is_staff


class IsAuthenticatedClient(BasePermission):
    """Permite acesso a clientes autenticados com perfil vinculado."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return getattr(user, 'client_profile', None) is not None
