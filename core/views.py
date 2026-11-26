from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

from .permissions import IsBarberShopStaff

AUTH_TAG = '1. Autenticação & Sessão'


class CurrentUserProfessionalSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    display_name = serializers.CharField()
    slug = serializers.SlugField()
    is_active = serializers.BooleanField()


class CurrentUserResponseSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    username = serializers.CharField()
    email = serializers.EmailField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    is_staff = serializers.BooleanField()
    role = serializers.ChoiceField(choices=['ADMIN', 'PROFESSIONAL'])
    professional = CurrentUserProfessionalSerializer(allow_null=True)


@extend_schema(
    tags=[AUTH_TAG],
    summary='Realizar login (Obter tokens JWT)',
    description=(
        'Autentica um administrador ou barbeiro com `username` e `password` '
        'e retorna o par de tokens JWT (`access` válido por 8h e `refresh` '
        'válido por 7 dias).'
    ),
)
class AuthLoginView(TokenObtainPairView):
    pass


@extend_schema(
    tags=[AUTH_TAG],
    summary='Renovar token de acesso (Refresh JWT)',
    description=(
        'Recebe um token `refresh` válido e retorna um novo token `access` '
        '(e um novo `refresh` rotacionado).'
    ),
)
class AuthRefreshView(TokenRefreshView):
    pass


def serialize_staff_user(user) -> dict:
    """Formata o payload de identificação de administrador ou barbeiro."""
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
    return {
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'is_staff': user.is_staff,
        'role': role,
        'professional': professional_data,
    }


class CurrentUserView(APIView):
    """
    Identifica o usuário autenticado e seu perfil de barbeiro vinculado.
    """

    permission_classes = [IsBarberShopStaff]
    serializer_class = CurrentUserResponseSerializer

    @extend_schema(
        tags=[AUTH_TAG],
        summary='Obter dados do usuário logado (/me)',
        description=(
            'Retorna os dados da conta autenticada, o papel no sistema '
            '(`ADMIN` para gerentes/donos ou `PROFESSIONAL` para barbeiros) '
            'e os dados do perfil de profissional vinculado, se existir.'
        ),
        responses={200: CurrentUserResponseSerializer},
    )
    def get(self, request):
        return Response(serialize_staff_user(request.user))
