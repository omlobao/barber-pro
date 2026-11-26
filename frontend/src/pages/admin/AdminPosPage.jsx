import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Receipt } from 'lucide-react';
import api from '@/api/client';
import { OrderDrawer } from '@/components/admin/OrderDrawer';
import { ModalDialog } from '@/components/ui/ModalDialog';
import { SpellBadge } from '@/components/spell/SpellBadge';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  PAYMENT_METHOD_LABELS,
  extractErrorMessage,
  formatCurrency,
} from '@/utils/formatters';

export default function AdminPosPage() {
  const [orders, setOrders] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [activeOrderId, setActiveOrderId] = useState(null);

  const [newModalOpen, setNewModalOpen] = useState(false);
  const [newProfId, setNewProfId] = useState('');
  const [newClientId, setNewClientId] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/admin/orders/');
      setOrders(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
    Promise.all([
      api.get('/api/admin/professionals/'),
      api.get('/api/admin/clients/'),
    ])
      .then(([profRes, cliRes]) => {
        const pList = (profRes.data || []).filter((p) => p.is_active);
        setProfessionals(pList);
        setClients(cliRes.data || []);
        if (pList[0]) setNewProfId(pList[0].id);
      })
      .catch(() => {});
  }, [loadOrders]);

  const handleCreateWalkInOrder = async (e) => {
    e.preventDefault();
    if (!newProfId) return;
    setCreating(true);
    setError('');
    try {
      const { data } = await api.post('/api/admin/orders/', {
        professional: newProfId,
        client: newClientId || null,
      });
      setNewModalOpen(false);
      setNewClientId('');
      await loadOrders();
      setActiveOrderId(data.id);
    } catch (err) {
      setError(extractErrorMessage(err, 'Erro ao abrir comanda de balcão.'));
    } finally {
      setCreating(false);
    }
  };

  const filtered =
    statusFilter === 'ALL'
      ? orders
      : orders.filter((o) => o.status === statusFilter);

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#F8FAFC] sm:text-3xl">
            Frente de Caixa / Comandas
          </h1>
          <p className="mt-1 text-sm text-[#94A3B8]">
            Gerencie comandas abertas, adicione bebidas/produtos e liquide vendas.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setNewModalOpen(true)}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#D97706] px-5 text-sm font-bold text-[#0B0D10] shadow-lg shadow-[#D97706]/20 hover:bg-[#F59E0B]"
        >
          <Plus className="h-4 w-4" />
          Nova Comanda Avulsa
        </button>
      </div>

      <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
        {[
          { key: 'ALL', label: 'Todas' },
          { key: 'OPEN', label: 'Abertas' },
          { key: 'PAID', label: 'Pagas / Concluídas' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStatusFilter(tab.key)}
            className={`min-h-[42px] rounded-xl px-4 text-xs font-bold transition ${
              statusFilter === tab.key
                ? 'bg-[#D97706] text-[#0B0D10]'
                : 'border border-[#232730] bg-[#14171D] text-[#94A3B8] hover:text-[#F8FAFC]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-44 w-full rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-[#232730] bg-[#14171D] p-12 text-center">
          <Receipt className="mx-auto h-10 w-10 text-[#94A3B8]" />
          <p className="mt-3 text-base font-bold text-[#F8FAFC]">
            Nenhuma comanda encontrada
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((ord) => (
            <button
              key={ord.id}
              type="button"
              onClick={() => setActiveOrderId(ord.id)}
              className="flex flex-col justify-between rounded-2xl border border-[#232730] bg-[#14171D] p-5 text-left transition hover:border-[#D97706]/50"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[#94A3B8]">
                    #{String(ord.id).slice(0, 8)}
                  </span>
                  <SpellBadge
                    variant={
                      ord.status === 'PAID'
                        ? 'emerald'
                        : ord.status === 'OPEN'
                        ? 'amber'
                        : 'rose'
                    }
                    size="sm"
                  >
                    {ord.status === 'PAID'
                      ? PAYMENT_METHOD_LABELS[ord.payment_method] || 'PAGA'
                      : ord.status === 'OPEN'
                      ? 'ABERTA'
                      : 'CANCELADA'}
                  </SpellBadge>
                </div>

                <h3 className="mt-3 text-base font-bold text-[#F8FAFC]">
                  {ord.client_name || 'Cliente Balcão'}
                </h3>
                <p className="mt-0.5 text-xs text-[#94A3B8]">
                  Profissional: {ord.professional_name}
                </p>
                <p className="mt-2 text-xs text-[#94A3B8]">
                  {(ord.items || []).length} item(ns) na comanda
                </p>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-[#232730] pt-3">
                <span className="text-xs font-semibold text-[#D97706]">
                  Gerenciar Comanda →
                </span>
                <span className="text-lg font-extrabold text-[#F59E0B]">
                  {formatCurrency(ord.total_amount)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      <ModalDialog
        open={newModalOpen}
        onClose={() => setNewModalOpen(false)}
        title="Abrir Comanda Avulsa (Balcão)"
        subtitle="Crie uma comanda rápida sem necessidade de agendamento prévio."
      >
        <form onSubmit={handleCreateWalkInOrder} className="space-y-4">
          {error ? (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
              {error}
            </div>
          ) : null}

          <div>
            <label
              htmlFor="walkin-prof"
              className="mb-1.5 block text-xs font-semibold text-[#F8FAFC]"
            >
              Profissional Responsável *
            </label>
            <select
              id="walkin-prof"
              required
              value={newProfId}
              onChange={(e) => setNewProfId(e.target.value)}
              className="h-12 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
            >
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="walkin-client"
              className="mb-1.5 block text-xs font-semibold text-[#F8FAFC]"
            >
              Cliente (Opcional)
            </label>
            <select
              id="walkin-client"
              value={newClientId}
              onChange={(e) => setNewClientId(e.target.value)}
              className="h-12 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
            >
              <option value="">Venda Avulsa / Cliente Balcão</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.phone_number})
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setNewModalOpen(false)}
              className="min-h-[46px] rounded-xl border border-[#232730] bg-[#0B0D10] px-4 text-xs font-semibold text-[#94A3B8]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={creating}
              className="min-h-[46px] rounded-xl bg-[#D97706] px-5 text-xs font-bold text-[#0B0D10] hover:bg-[#F59E0B]"
            >
              {creating ? 'Abrindo...' : 'Abrir Comanda'}
            </button>
          </div>
        </form>
      </ModalDialog>

      <OrderDrawer
        orderId={activeOrderId}
        open={Boolean(activeOrderId)}
        onClose={() => setActiveOrderId(null)}
        onOrderUpdated={() => loadOrders()}
      />
    </div>
  );
}
