from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.permissions import IsBarberShopStaff
from .models import Client
from .serializers import ClientSerializer


class AdminClientViewSet(viewsets.ModelViewSet):
    """
    CRUD completo de clientes para o painel administrativo e barbeiros.
    Suporta busca por nome/telefone/e-mail (?search=) e filtro (?is_blocked=).
    """

    queryset = Client.objects.all()
    serializer_class = ClientSerializer
    permission_classes = [IsBarberShopStaff]

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get('search', '').strip()
        is_blocked = self.request.query_params.get('is_blocked')

        if search:
            qs = qs.filter(
                Q(name__icontains=search)
                | Q(phone_number__icontains=search)
                | Q(email__icontains=search)
            )

        if is_blocked in ('true', 'false'):
            qs = qs.filter(is_blocked=(is_blocked == 'true'))

        return qs

    @action(detail=True, methods=['post'], url_path='toggle-block')
    def toggle_block(self, request, pk=None):
        """
        Alterna o bloqueio de agendamento online do cliente
        (POST /api/admin/clients/{id}/toggle-block/).
        """
        client = self.get_object()
        client.is_blocked = not client.is_blocked
        client.save(update_fields=['is_blocked', 'updated_at'])
        return Response(
            ClientSerializer(client).data,
            status=status.HTTP_200_OK,
        )
