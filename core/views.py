from rest_framework.response import Response
from rest_framework.views import APIView

from .permissions import IsBarberShopStaff


class CurrentUserView(APIView):
    """
    Retorna os dados do usuário autenticado, seu papel no painel
    (ADMIN ou PROFESSIONAL) e o perfil de barbeiro vinculado, se houver.
    GET /api/auth/me/
    """

    permission_classes = [IsBarberShopStaff]

    def get(self, request):
        user = request.user
        profile = getattr(user, 'professional_profile', None)

        professional_data = None
        if profile is not None:
            professional_data = {
                'id': str(profile.id),
                'display_name': profile.display_name,
                'slug': profile.slug,
                'is_active': profile.is_active,
            }

        role = 'ADMIN' if user.is_staff else 'PROFESSIONAL'

        return Response({
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'is_staff': user.is_staff,
            'role': role,
            'professional': professional_data,
        })
