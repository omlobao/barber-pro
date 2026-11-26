import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Package,
  Plus,
  Scissors,
  Ticket,
  Trash2,
  X,
} from 'lucide-react';
import api from '@/api/client';
import { SlideDrawer } from '@/components/ui/SlideDrawer';
import { SpellBadge } from '@/components/spell/SpellBadge';
import {
  PAYMENT_METHOD_LABELS,
  extractErrorMessage,
  formatCurrency,
} from '@/utils/formatters';

const PAYMENT_OPTIONS = [
  { value: 'PIX', label: 'Pix' },
  { value: 'CREDIT_CARD', label: 'Cartão Crédito' },
  { value: 'DEBIT_CARD', label: 'Cartão Débito' },
  { value: 'CASH', label: 'Dinheiro' },
  { value: 'MIXED', label: 'Misto' },
];

export function OrderDrawer({ orderId, open, onClose, onOrderUpdated }) {
  const [order, setOrder] = useState(null);
  const [services, setServices] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [itemTab, setItemTab] = useState('PRODUCT');
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [addingItem, setAddingItem] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState('PIX');
  const [discount, setDiscount] = useState('0.00');
  const [tip, setTip] = useState('0.00');
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!open || !orderId) return;
    let active = true;
    setLoading(true);
    setError('');

    Promise.all([
      api.get(`/api/admin/orders/${orderId}/`),
      api.get('/api/admin/services/'),
      api.get('/api/admin/products/'),
    ])
      .then(([ordRes, srvRes, prodRes]) => {
        if (!active) return;
        setOrder(ordRes.data);
        setDiscount(String(ordRes.data.discount_total || '0.00'));
        setTip(String(ordRes.data.tip || '0.00'));
        setCouponCodeInput(ordRes.data.coupon_code || '');
        setPaymentMethod(ordRes.data.payment_method || 'PIX');

        const srvList = (srvRes.data || []).filter((s) => s.is_active);
        const prodList = (prodRes.data || []).filter((p) => p.is_active);
        setServices(srvList);
        setProducts(prodList);
        if (prodList.length > 0) setSelectedTargetId(prodList[0].id);
      })
      .catch((err) => {
        if (active) setError(extractErrorMessage(err, 'Erro ao carregar comanda.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, orderId]);

  useEffect(() => {
    if (itemTab === 'SERVICE') {
      setSelectedTargetId(services[0]?.id || '');
    } else {
      setSelectedTargetId(products[0]?.id || '');
    }
  }, [itemTab, services, products]);

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!order || !selectedTargetId) return;
    setAddingItem(true);
    setError('');
    try {
      const payload = {
        item_type: itemTab,
        quantity: Number(quantity) || 1,
      };
      if (itemTab === 'SERVICE') {
        payload.service = selectedTargetId;
      } else {
        payload.product = selectedTargetId;
      }

      const { data } = await api.post(
        `/api/admin/orders/${order.id}/add-item/`,
        payload
      );
      setOrder(data);
      onOrderUpdated?.(data);
      setQuantity(1);
    } catch (err) {
      setError(extractErrorMessage(err, 'Erro ao adicionar item.'));
    } finally {
      setAddingItem(false);
    }
  };

  const handleRemoveItem = async (itemId) => {
    if (!order) return;
    setError('');
    try {
      const { data } = await api.delete(
        `/api/admin/orders/${order.id}/remove-item/${itemId}/`
      );
      setOrder(data);
      onOrderUpdated?.(data);
    } catch (err) {
      setError(extractErrorMessage(err, 'Erro ao remover item.'));
    }
  };

  const handleApplyOrderCoupon = async (codeToApply) => {
    if (!order) return;
    setApplyingCoupon(true);
    setError('');
    try {
      const { data } = await api.post(
        `/api/admin/orders/${order.id}/apply-coupon/`,
        { code: codeToApply }
      );
      setOrder(data);
      setDiscount(String(data.discount_total || '0.00'));
      setCouponCodeInput(data.coupon_code || '');
      onOrderUpdated?.(data);
    } catch (err) {
      setError(extractErrorMessage(err, 'Cupom inválido para esta comanda.'));
    } finally {
      setApplyingCoupon(false);
    }
  };

  const handleCloseOrder = async (e) => {
    e.preventDefault();
    if (!order) return;
    setClosing(true);
    setError('');
    try {
      const { data } = await api.post(`/api/admin/orders/${order.id}/close/`, {
        payment_method: paymentMethod,
        discount_total: Number(discount || 0).toFixed(2),
        tip: Number(tip || 0).toFixed(2),
      });
      setOrder(data);
      onOrderUpdated?.(data);
    } catch (err) {
      setError(extractErrorMessage(err, 'Não foi possível fechar a comanda.'));
    } finally {
      setClosing(false);
    }
  };

  const isOpen = order?.status === 'OPEN';
  const previewSubtotal = Number(order?.subtotal || 0);
  const previewDiscount = Number(discount || 0);
  const previewTip = Number(tip || 0);
  const previewTotal = isOpen
    ? Math.max(0, previewSubtotal - previewDiscount) + previewTip
    : Number(order?.total_amount || 0);

  return (
    <SlideDrawer
      open={open}
      onClose={onClose}
      title={
        order ? `Comanda #${String(order.id).slice(0, 8)}` : 'Carregando Comanda'
      }
      subtitle={
        order
          ? `${order.client_name || 'Cliente Balcão'} • Barbeiro: ${
              order.professional_name
            }`
          : ''
      }
      widthClass="max-w-xl"
    >
      {loading ? (
        <p className="text-sm text-[#94A3B8]">Carregando itens da comanda...</p>
      ) : order ? (
        <div className="space-y-6">
          {error ? (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs font-medium text-rose-300">
              {error}
            </div>
          ) : null}

          <div className="flex items-center justify-between rounded-2xl border border-[#232730] bg-[#0B0D10] p-4">
            <div>
              <span className="text-xs text-[#94A3B8]">Status da Comanda</span>
              <div className="mt-1">
                <SpellBadge
                  variant={
                    order.status === 'PAID'
                      ? 'emerald'
                      : order.status === 'OPEN'
                      ? 'amber'
                      : 'rose'
                  }
                >
                  {order.status === 'PAID'
                    ? `PAGA (${PAYMENT_METHOD_LABELS[order.payment_method] || order.payment_method})`
                    : order.status === 'OPEN'
                    ? 'ABERTA NO CAIXA'
                    : 'CANCELADA'}
                </SpellBadge>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-[#94A3B8]">Total Calculado</span>
              <p className="text-2xl font-extrabold text-[#F59E0B]">
                {formatCurrency(previewTotal)}
              </p>
            </div>
          </div>

          {/* Lista de Itens */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
              Itens Consumidos ({(order.items || []).length})
            </h3>
            <div className="mt-2.5 space-y-2">
              {(order.items || []).length === 0 ? (
                <p className="rounded-xl border border-[#232730] bg-[#0B0D10] p-4 text-center text-xs text-[#94A3B8]">
                  Nenhum item adicionado ainda.
                </p>
              ) : (
                (order.items || []).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[#232730] bg-[#0B0D10] px-4 py-3 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      {item.item_type === 'SERVICE' ? (
                        <Scissors className="h-4 w-4 text-[#D97706]" />
                      ) : (
                        <Package className="h-4 w-4 text-sky-400" />
                      )}
                      <div>
                        <p className="font-semibold text-[#F8FAFC]">
                          {item.quantity}x {item.item_name}
                        </p>
                        <p className="text-xs text-[#94A3B8]">
                          Unit.: {formatCurrency(item.unit_price)} • Comissão:{' '}
                          {formatCurrency(item.comission_amount)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-bold text-[#F8FAFC]">
                        {formatCurrency(item.total_price)}
                      </span>
                      {isOpen ? (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          aria-label="Remover item"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Adicionar Serviço Extra ou Produto do Frigobar/Revenda */}
          {isOpen ? (
            <form
              onSubmit={handleAddItem}
              className="rounded-2xl border border-[#232730] bg-[#0B0D10] p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#F8FAFC]">
                  Adicionar Item Rápido
                </span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setItemTab('PRODUCT')}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                      itemTab === 'PRODUCT'
                        ? 'bg-[#D97706] text-[#0B0D10]'
                        : 'bg-[#14171D] text-[#94A3B8]'
                    }`}
                  >
                    Produto / Bebida
                  </button>
                  <button
                    type="button"
                    onClick={() => setItemTab('SERVICE')}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                      itemTab === 'SERVICE'
                        ? 'bg-[#D97706] text-[#0B0D10]'
                        : 'bg-[#14171D] text-[#94A3B8]'
                    }`}
                  >
                    Serviço Extra
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2.5 sm:flex-row">
                <select
                  value={selectedTargetId}
                  onChange={(e) => setSelectedTargetId(e.target.value)}
                  aria-label="Selecionar item"
                  className="h-11 flex-1 rounded-xl border border-[#232730] bg-[#14171D] px-3 text-sm text-[#F8FAFC] focus:border-[#D97706] focus:outline-none"
                >
                  {itemTab === 'PRODUCT'
                    ? products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {formatCurrency(p.sale_price)} (Est:{' '}
                          {p.stock_quantity})
                        </option>
                      ))
                    : services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} — {formatCurrency(s.effective_price)}
                        </option>
                      ))}
                </select>

                <input
                  type="number"
                  min={1}
                  max={50}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  aria-label="Quantidade"
                  className="h-11 w-20 rounded-xl border border-[#232730] bg-[#14171D] px-3 text-center text-sm text-[#F8FAFC]"
                />

                <button
                  type="submit"
                  disabled={addingItem || !selectedTargetId}
                  className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-[#D97706] px-4 text-xs font-bold text-[#0B0D10] hover:bg-[#F59E0B] disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  Incluir
                </button>
              </div>
            </form>
          ) : null}

          {/* Cupom Promocional na Comanda */}
          {isOpen ? (
            <div className="rounded-2xl border border-[#232730] bg-[#0B0D10] p-4">
              <label
                htmlFor="pos-coupon-code"
                className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#F59E0B]"
              >
                <Ticket className="h-3.5 w-3.5" />
                Cupom Promocional
              </label>

              {order.coupon_code ? (
                <div
                  role="status"
                  className="mt-2.5 flex items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2.5 text-xs"
                >
                  <span className="font-bold text-emerald-400">
                    Cupom {order.coupon_code} aplicado (-
                    {formatCurrency(order.discount_total)})
                  </span>
                  <button
                    type="button"
                    disabled={applyingCoupon}
                    onClick={() => handleApplyOrderCoupon('')}
                    aria-label="Remover cupom da comanda"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#232730] bg-[#0B0D10] text-[#94A3B8] hover:text-[#F8FAFC]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="mt-2.5 flex gap-2">
                  <input
                    id="pos-coupon-code"
                    type="text"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="Código do cupom (ex.: BARBA10)"
                    value={couponCodeInput}
                    onChange={(e) =>
                      setCouponCodeInput(e.target.value.toUpperCase())
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        handleApplyOrderCoupon(couponCodeInput);
                      }
                    }}
                    className="h-11 flex-1 rounded-xl border border-[#232730] bg-[#14171D] px-3 font-mono text-xs uppercase text-[#F8FAFC]"
                  />
                  <button
                    type="button"
                    disabled={applyingCoupon || !couponCodeInput.trim()}
                    onClick={() => handleApplyOrderCoupon(couponCodeInput)}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-[#D97706]/50 bg-[#D97706]/15 px-4 text-xs font-bold text-[#F59E0B] hover:bg-[#D97706] hover:text-[#0B0D10] disabled:opacity-40"
                  >
                    {applyingCoupon ? 'Aplicando...' : 'Aplicar'}
                  </button>
                </div>
              )}
            </div>
          ) : order.coupon_code ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-bold text-emerald-400">
              Cupom utilizado nesta venda: {order.coupon_code} (-
              {formatCurrency(order.discount_total)})
            </div>
          ) : null}

          {/* Fechamento de Caixa */}
          {isOpen ? (
            <form
              onSubmit={handleCloseOrder}
              className="rounded-2xl border border-[#D97706]/35 bg-[#0B0D10] p-5 space-y-4"
            >
              <h3 className="text-sm font-bold text-[#F59E0B]">
                Fechamento & Recebimento
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="order-discount"
                    className="mb-1 block text-xs text-[#94A3B8]"
                  >
                    Desconto (R$)
                  </label>
                  <input
                    id="order-discount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="h-11 w-full rounded-xl border border-[#232730] bg-[#14171D] px-3 text-sm text-[#F8FAFC]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="order-tip"
                    className="mb-1 block text-xs text-[#94A3B8]"
                  >
                    Gorjeta / Caixinha (R$)
                  </label>
                  <input
                    id="order-tip"
                    type="number"
                    step="0.01"
                    min="0"
                    value={tip}
                    onChange={(e) => setTip(e.target.value)}
                    className="h-11 w-full rounded-xl border border-[#232730] bg-[#14171D] px-3 text-sm text-[#F8FAFC]"
                  />
                </div>
              </div>

              <div>
                <span className="mb-2 block text-xs text-[#94A3B8]">
                  Forma de Pagamento
                </span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {PAYMENT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPaymentMethod(opt.value)}
                      className={`min-h-[42px] rounded-xl border px-3 text-xs font-bold transition ${
                        paymentMethod === opt.value
                          ? 'border-[#D97706] bg-[#D97706] text-[#0B0D10]'
                          : 'border-[#232730] bg-[#14171D] text-[#94A3B8] hover:text-[#F8FAFC]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={closing || (order.items || []).length === 0}
                className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 text-sm font-extrabold text-[#0B0D10] transition hover:bg-emerald-400 disabled:opacity-40"
              >
                <CheckCircle2 className="h-5 w-5" />
                {closing
                  ? 'Liquidando comanda...'
                  : `Confirmar Recebimento (${formatCurrency(previewTotal)})`}
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </SlideDrawer>
  );
}
