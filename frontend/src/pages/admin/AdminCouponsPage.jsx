import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Edit3,
  PauseCircle,
  PlayCircle,
  Plus,
  Search,
  Sparkles,
  Ticket,
  Trash2,
} from 'lucide-react';
import api from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { ModalDialog } from '@/components/ui/ModalDialog';
import { SpellBadge } from '@/components/spell/SpellBadge';
import {
  extractErrorMessage,
  formatCurrency,
  formatDateBR,
} from '@/utils/formatters';

const EMPTY_FORM = {
  code: '',
  description: '',
  discount_type: 'PERCENTAGE',
  discount_value: '15.00',
  min_order_amount: '0.00',
  valid_from: '',
  valid_until: '',
  max_uses: '',
  only_first_visit: false,
  is_active: true,
};

export default function AdminCouponsPage() {
  const { isAdmin } = useAuth();
  const [coupons, setCoupons] = useState([]);
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadCoupons = useCallback(async () => {
    try {
      const { data } = await api.get('/api/admin/coupons/');
      setCoupons(Array.isArray(data) ? data : []);
    } catch (err) {
      setFeedback(extractErrorMessage(err, 'Erro ao carregar cupons.'));
    }
  }, []);

  useEffect(() => {
    loadCoupons();
  }, [loadCoupons]);

  const filteredCoupons = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return coupons;
    return coupons.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q)
    );
  }, [coupons, search]);

  const totalUses = useMemo(
    () => coupons.reduce((acc, c) => acc + Number(c.used_count || 0), 0),
    [coupons]
  );

  const activeCount = useMemo(
    () => coupons.filter((c) => c.is_active).length,
    [coupons]
  );

  const openCreateModal = () => {
    setEditingCoupon(null);
    setForm(EMPTY_FORM);
    setFeedback('');
    setModalOpen(true);
  };

  const openEditModal = (cp) => {
    setEditingCoupon(cp);
    setForm({
      code: cp.code || '',
      description: cp.description || '',
      discount_type: cp.discount_type || 'PERCENTAGE',
      discount_value: String(cp.discount_value || '10.00'),
      min_order_amount: String(cp.min_order_amount || '0.00'),
      valid_from: cp.valid_from || '',
      valid_until: cp.valid_until || '',
      max_uses:
        cp.max_uses !== null && cp.max_uses !== undefined
          ? String(cp.max_uses)
          : '',
      only_first_visit: Boolean(cp.only_first_visit),
      is_active: Boolean(cp.is_active),
    });
    setFeedback('');
    setModalOpen(true);
  };

  const handleSaveCoupon = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFeedback('');

    const payload = {
      code: form.code.trim().toUpperCase(),
      description: form.description.trim(),
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value || 0).toFixed(2),
      min_order_amount: Number(form.min_order_amount || 0).toFixed(2),
      valid_from: form.valid_from || null,
      valid_until: form.valid_until || null,
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      only_first_visit: Boolean(form.only_first_visit),
      is_active: Boolean(form.is_active),
    };

    try {
      if (editingCoupon) {
        await api.put(`/api/admin/coupons/${editingCoupon.id}/`, payload);
      } else {
        await api.post('/api/admin/coupons/', payload);
      }
      setModalOpen(false);
      await loadCoupons();
    } catch (err) {
      setFeedback(extractErrorMessage(err, 'Erro ao salvar cupom.'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (cp) => {
    setFeedback('');
    try {
      await api.patch(`/api/admin/coupons/${cp.id}/`, {
        is_active: !cp.is_active,
      });
      await loadCoupons();
    } catch (err) {
      setFeedback(
        extractErrorMessage(err, 'Não foi possível alterar o status do cupom.')
      );
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setFeedback('');
    try {
      await api.delete(`/api/admin/coupons/${deleteTarget.id}/`);
      setDeleteTarget(null);
      await loadCoupons();
    } catch (err) {
      setDeleteTarget(null);
      setFeedback(
        extractErrorMessage(err, 'Não foi possível excluir este cupom.')
      );
    }
  };

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#F8FAFC] sm:text-3xl">
            Cupons & Promoções
          </h1>
          <p className="mt-1 text-sm text-[#94A3B8]">
            Crie códigos de desconto exclusivos para fidelizar clientes no
            agendamento online e na frente de caixa.
          </p>
        </div>

        {isAdmin ? (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex min-h-[46px] items-center gap-2 rounded-xl bg-[#D97706] px-4 text-xs font-bold text-[#0B0D10] shadow-lg shadow-[#D97706]/20 transition hover:bg-[#F59E0B]"
          >
            <Plus className="h-4 w-4" />
            Novo Cupom Promocional
          </button>
        ) : null}
      </div>

      {/* KPIs de Promoções */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#232730] bg-[#14171D] p-5">
          <span className="text-xs font-semibold text-[#94A3B8]">
            Cupons Cadastrados
          </span>
          <p className="mt-1 text-2xl font-extrabold text-[#F8FAFC]">
            {coupons.length}
          </p>
        </div>
        <div className="rounded-2xl border border-[#232730] bg-[#14171D] p-5">
          <span className="text-xs font-semibold text-[#94A3B8]">
            Campanhas Ativas Agora
          </span>
          <p className="mt-1 text-2xl font-extrabold text-emerald-400">
            {activeCount}
          </p>
        </div>
        <div className="rounded-2xl border border-[#232730] bg-[#14171D] p-5">
          <span className="text-xs font-semibold text-[#94A3B8]">
            Resgates Realizados
          </span>
          <p className="mt-1 text-2xl font-extrabold text-[#F59E0B]">
            {totalUses}
          </p>
        </div>
      </div>

      {feedback ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs font-medium text-rose-300"
        >
          {feedback}
        </div>
      ) : null}

      <search className="mt-6 block">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
          <input
            type="search"
            aria-label="Buscar cupons por código ou descrição"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="Buscar por código (ex.: BEMVINDO15) ou descrição..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-h-[46px] w-full rounded-xl border border-[#232730] bg-[#14171D] pr-4 pl-10 text-sm text-[#F8FAFC] placeholder-[#94A3B8]/50 focus:border-[#D97706] focus:outline-none"
          />
        </div>
      </search>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredCoupons.map((cp) => {
          const isPct = cp.discount_type === 'PERCENTAGE';
          const valueLabel = isPct
            ? `${Number(cp.discount_value)}% OFF`
            : `${formatCurrency(cp.discount_value)} OFF`;

          return (
            <div
              key={cp.id}
              className="flex flex-col justify-between rounded-2xl border border-[#232730] bg-[#14171D] p-5"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#D97706]/40 bg-[#0B0D10] px-3 py-1 font-mono text-sm font-extrabold text-[#F59E0B]">
                    <Ticket className="h-3.5 w-3.5" />
                    {cp.code}
                  </span>
                  <SpellBadge
                    variant={cp.is_active ? 'emerald' : 'slate'}
                    size="sm"
                  >
                    {cp.is_active ? 'ATIVO' : 'PAUSADO'}
                  </SpellBadge>
                </div>

                <p className="mt-3 text-xl font-extrabold text-[#F8FAFC]">
                  {valueLabel}
                </p>

                <p className="mt-1 text-xs text-[#94A3B8]">
                  {cp.description || 'Sem descrição adicional.'}
                </p>

                <div className="mt-4 space-y-1.5 rounded-xl border border-[#232730] bg-[#0B0D10] p-3 text-xs text-[#94A3B8]">
                  <div className="flex justify-between">
                    <span>Pedido mínimo:</span>
                    <strong className="text-[#F8FAFC]">
                      {Number(cp.min_order_amount) > 0
                        ? formatCurrency(cp.min_order_amount)
                        : 'Sem mínimo'}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Utilizações:</span>
                    <strong className="text-[#F59E0B]">
                      {cp.used_count}
                      {cp.max_uses ? ` / ${cp.max_uses}` : ' (ilimitado)'}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Validade:</span>
                    <strong className="text-[#F8FAFC]">
                      {cp.valid_until
                        ? `Até ${formatDateBR(cp.valid_until)}`
                        : 'Contínuo'}
                    </strong>
                  </div>
                  {cp.only_first_visit ? (
                    <div className="pt-1 text-[#F59E0B] font-semibold flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      Exclusivo para 1ª visita
                    </div>
                  ) : null}
                </div>
              </div>

              {isAdmin ? (
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#232730] pt-3.5">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(cp)}
                    className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-xs font-bold text-[#F8FAFC] hover:border-[#D97706]/40"
                  >
                    {cp.is_active ? (
                      <>
                        <PauseCircle className="h-3.5 w-3.5 text-amber-400" />
                        Pausar
                      </>
                    ) : (
                      <>
                        <PlayCircle className="h-3.5 w-3.5 text-emerald-400" />
                        Ativar
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => openEditModal(cp)}
                    aria-label={`Editar cupom ${cp.code}`}
                    className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-xl border border-[#232730] bg-[#0B0D10] text-[#94A3B8] hover:text-[#F8FAFC]"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeleteTarget(cp)}
                    aria-label={`Excluir cupom ${cp.code}`}
                    className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Modal de Criar / Editar Cupom */}
      <ModalDialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingCoupon ? `Editar Cupom ${editingCoupon.code}` : 'Novo Cupom Promocional'}
      >
        <form onSubmit={handleSaveCoupon} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="cp-code"
                className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
              >
                Código do Cupom *
              </label>
              <input
                id="cp-code"
                name="code"
                required
                minLength={3}
                maxLength={30}
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="Ex.: BEMVINDO15"
                value={form.code}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    code: e.target.value.toUpperCase().replace(/\s+/g, ''),
                  }))
                }
                className="min-h-[46px] w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 font-mono text-sm uppercase text-[#F8FAFC]"
              />
            </div>

            <div>
              <label
                htmlFor="cp-min"
                className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
              >
                Pedido Mínimo (R$)
              </label>
              <input
                id="cp-min"
                name="min_order_amount"
                type="number"
                step="0.01"
                min="0"
                value={form.min_order_amount}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    min_order_amount: e.target.value,
                  }))
                }
                className="min-h-[46px] w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="cp-desc"
              className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
            >
              Descrição para o Cliente
            </label>
            <input
              id="cp-desc"
              name="description"
              type="text"
              placeholder="Ex.: 15% OFF no seu primeiro corte online"
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
              className="min-h-[46px] w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <fieldset className="rounded-xl border border-[#232730] bg-[#0B0D10] p-3">
              <legend className="px-1 text-xs font-semibold text-[#F8FAFC]">
                Tipo de Desconto *
              </legend>
              <div className="mt-1 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <input
                    id="cp-type-pct"
                    type="radio"
                    name="discount_type"
                    value="PERCENTAGE"
                    checked={form.discount_type === 'PERCENTAGE'}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        discount_type: e.target.value,
                      }))
                    }
                    className="h-4 w-4 accent-[#D97706]"
                  />
                  <label htmlFor="cp-type-pct" className="text-xs text-[#F8FAFC]">
                    Percentual (%)
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="cp-type-fixed"
                    type="radio"
                    name="discount_type"
                    value="FIXED"
                    checked={form.discount_type === 'FIXED'}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        discount_type: e.target.value,
                      }))
                    }
                    className="h-4 w-4 accent-[#D97706]"
                  />
                  <label
                    htmlFor="cp-type-fixed"
                    className="text-xs text-[#F8FAFC]"
                  >
                    Valor Fixo (R$)
                  </label>
                </div>
              </div>
            </fieldset>

            <div>
              <label
                htmlFor="cp-val"
                className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
              >
                {form.discount_type === 'PERCENTAGE'
                  ? 'Percentual de Desconto (%) *'
                  : 'Valor do Desconto (R$) *'}
              </label>
              <input
                id="cp-val"
                name="discount_value"
                type="number"
                step="0.01"
                min="0.01"
                max={form.discount_type === 'PERCENTAGE' ? '100' : undefined}
                required
                value={form.discount_value}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    discount_value: e.target.value,
                  }))
                }
                className="min-h-[46px] w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
              />

              <label
                htmlFor="cp-max"
                className="mt-3 mb-1 block text-xs font-semibold text-[#F8FAFC]"
              >
                Limite Total de Usos (opcional)
              </label>
              <input
                id="cp-max"
                name="max_uses"
                type="number"
                min="1"
                placeholder="Ilimitado"
                value={form.max_uses}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, max_uses: e.target.value }))
                }
                className="min-h-[46px] w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="cp-from"
                className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
              >
                Válido a partir de
              </label>
              <input
                id="cp-from"
                name="valid_from"
                type="date"
                value={form.valid_from}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, valid_from: e.target.value }))
                }
                className="min-h-[46px] w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
              />
            </div>
            <div>
              <label
                htmlFor="cp-until"
                className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
              >
                Válido até
              </label>
              <input
                id="cp-until"
                name="valid_until"
                type="date"
                value={form.valid_until}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, valid_until: e.target.value }))
                }
                className="min-h-[46px] w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
              />
            </div>
          </div>

          <div className="space-y-2.5 rounded-xl border border-[#232730] bg-[#0B0D10] p-3.5">
            <div className="flex items-center gap-2.5">
              <input
                id="cp-first-visit"
                type="checkbox"
                checked={form.only_first_visit}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    only_first_visit: e.target.checked,
                  }))
                }
                className="h-4 w-4 accent-[#D97706]"
              />
              <label
                htmlFor="cp-first-visit"
                className="text-xs font-semibold text-[#F8FAFC]"
              >
                Exclusivo para a 1ª visita do cliente (0 atendimentos anteriores)
              </label>
            </div>

            <div className="flex items-center gap-2.5">
              <input
                id="cp-active"
                type="checkbox"
                checked={form.is_active}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    is_active: e.target.checked,
                  }))
                }
                className="h-4 w-4 accent-[#D97706]"
              />
              <label
                htmlFor="cp-active"
                className="text-xs font-semibold text-[#F8FAFC]"
              >
                Deixar cupom ativo imediatamente para os clientes
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="min-h-[44px] rounded-xl border border-[#232730] px-4 text-xs font-semibold text-[#94A3B8]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] rounded-xl bg-[#D97706] px-5 text-xs font-bold text-[#0B0D10]"
            >
              {saving ? 'Salvando...' : 'Salvar Cupom'}
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* Modal de Confirmação de Exclusão */}
      <ModalDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Excluir cupom promocional?"
      >
        <p className="text-sm text-[#94A3B8]">
          Tem certeza que deseja excluir o cupom{' '}
          <strong className="text-[#F8FAFC]">{deleteTarget?.code}</strong>?
        </p>
        <div className="mt-6 flex justify-end gap-2.5">
          <button
            type="button"
            autoFocus
            onClick={() => setDeleteTarget(null)}
            className="min-h-[44px] rounded-xl border border-[#232730] px-4 text-xs font-semibold text-[#F8FAFC]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirmDelete}
            className="min-h-[44px] rounded-xl bg-rose-600 px-5 text-xs font-bold text-white"
          >
            Excluir Cupom
          </button>
        </div>
      </ModalDialog>
    </div>
  );
}
