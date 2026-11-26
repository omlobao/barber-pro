import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Plus } from 'lucide-react';
import api from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { ModalDialog } from '@/components/ui/ModalDialog';
import { SpellBadge } from '@/components/spell/SpellBadge';
import {
  CATEGORY_LABELS,
  extractErrorMessage,
  formatCurrency,
} from '@/utils/formatters';

export default function AdminCatalogPage() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState('SERVICES');
  const [services, setServices] = useState([]);
  const [products, setProducts] = useState([]);
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [feedback, setFeedback] = useState('');

  const [srvModalOpen, setSrvModalOpen] = useState(false);
  const [srvName, setSrvName] = useState('');
  const [srvCategory, setSrvCategory] = useState('HAIR');
  const [srvPrice, setSrvPrice] = useState('');
  const [srvPromo, setSrvPromo] = useState('');
  const [srvDuration, setSrvDuration] = useState('30');

  const [prodModalOpen, setProdModalOpen] = useState(false);
  const [prodName, setProdName] = useState('');
  const [prodCost, setProdCost] = useState('');
  const [prodSale, setProdSale] = useState('');
  const [prodStock, setProdStock] = useState('10');
  const [prodAlert, setProdAlert] = useState('3');

  const loadCatalog = useCallback(async () => {
    setFeedback('');
    try {
      const prodParams = onlyLowStock ? { is_low_stock: 'true' } : {};
      const [srvRes, prodRes] = await Promise.all([
        api.get('/api/admin/services/'),
        api.get('/api/admin/products/', { params: prodParams }),
      ]);
      setServices(Array.isArray(srvRes.data) ? srvRes.data : []);
      setProducts(Array.isArray(prodRes.data) ? prodRes.data : []);
    } catch (err) {
      setFeedback(extractErrorMessage(err, 'Erro ao carregar catálogo.'));
    }
  }, [onlyLowStock]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const handleCreateService = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/admin/services/', {
        name: srvName.trim(),
        category: srvCategory,
        price: Number(srvPrice).toFixed(2),
        promotion_price: srvPromo ? Number(srvPromo).toFixed(2) : null,
        duration_minutes: Number(srvDuration),
        is_active: true,
      });
      setSrvModalOpen(false);
      setSrvName('');
      setSrvPrice('');
      setSrvPromo('');
      await loadCatalog();
    } catch (err) {
      setFeedback(extractErrorMessage(err, 'Erro ao criar serviço.'));
    }
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/admin/products/', {
        name: prodName.trim(),
        cost_price: Number(prodCost || 0).toFixed(2),
        sale_price: Number(prodSale).toFixed(2),
        stock_quantity: Number(prodStock),
        min_stock_alert: Number(prodAlert),
        is_active: true,
      });
      setProdModalOpen(false);
      setProdName('');
      setProdCost('');
      setProdSale('');
      await loadCatalog();
    } catch (err) {
      setFeedback(extractErrorMessage(err, 'Erro ao criar produto.'));
    }
  };

  const handleQuickStockDelta = async (product, delta) => {
    try {
      await api.patch(`/api/admin/products/${product.id}/`, {
        stock_quantity: Math.max(0, Number(product.stock_quantity) + delta),
      });
      await loadCatalog();
    } catch (err) {
      setFeedback(extractErrorMessage(err, 'Erro ao ajustar estoque.'));
    }
  };

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#F8FAFC] sm:text-3xl">
            Serviços & Estoque
          </h1>
          <p className="mt-1 text-sm text-[#94A3B8]">
            Gerencie preços, promoções e controle o estoque de produtos.
          </p>
        </div>

        <div className="flex gap-2">
          {tab === 'SERVICES' && isAdmin ? (
            <button
              type="button"
              onClick={() => setSrvModalOpen(true)}
              className="inline-flex min-h-[46px] items-center gap-2 rounded-xl bg-[#D97706] px-4 text-xs font-bold text-[#0B0D10]"
            >
              <Plus className="h-4 w-4" />
              Novo Serviço
            </button>
          ) : null}
          {tab === 'PRODUCTS' ? (
            <button
              type="button"
              onClick={() => setProdModalOpen(true)}
              className="inline-flex min-h-[46px] items-center gap-2 rounded-xl bg-[#D97706] px-4 text-xs font-bold text-[#0B0D10]"
            >
              <Plus className="h-4 w-4" />
              Novo Produto
            </button>
          ) : null}
        </div>
      </div>

      {feedback ? (
        <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
          {feedback}
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#232730] pb-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab('SERVICES')}
            className={`min-h-[42px] rounded-xl px-4 text-xs font-bold ${
              tab === 'SERVICES'
                ? 'bg-[#D97706] text-[#0B0D10]'
                : 'bg-[#14171D] text-[#94A3B8]'
            }`}
          >
            Serviços ({services.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('PRODUCTS')}
            className={`min-h-[42px] rounded-xl px-4 text-xs font-bold ${
              tab === 'PRODUCTS'
                ? 'bg-[#D97706] text-[#0B0D10]'
                : 'bg-[#14171D] text-[#94A3B8]'
            }`}
          >
            Produtos ({products.length})
          </button>
        </div>

        {tab === 'PRODUCTS' ? (
          <button
            type="button"
            onClick={() => setOnlyLowStock((prev) => !prev)}
            className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border px-3 text-xs font-bold ${
              onlyLowStock
                ? 'border-amber-500 bg-amber-500/15 text-amber-400'
                : 'border-[#232730] bg-[#14171D] text-[#94A3B8]'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Apenas Estoque Baixo
          </button>
        ) : null}
      </div>

      {tab === 'SERVICES' ? (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <div
              key={s.id}
              className="rounded-2xl border border-[#232730] bg-[#14171D] p-5"
            >
              <div className="flex items-center justify-between">
                <SpellBadge variant="outline" size="sm">
                  {CATEGORY_LABELS[s.category] || s.category}
                </SpellBadge>
                <SpellBadge variant={s.is_active ? 'emerald' : 'rose'} size="sm">
                  {s.is_active ? 'Ativo' : 'Inativo'}
                </SpellBadge>
              </div>
              <h3 className="mt-3 text-base font-bold text-[#F8FAFC]">
                {s.name}
              </h3>
              <p className="mt-1 text-xs text-[#94A3B8]">
                Duração: {s.duration_minutes} min
              </p>
              <div className="mt-4 flex items-baseline gap-2 border-t border-[#232730] pt-3">
                <span className="text-lg font-extrabold text-[#F59E0B]">
                  {formatCurrency(s.effective_price)}
                </span>
                {s.promotion_price ? (
                  <span className="text-xs text-[#94A3B8] line-through">
                    {formatCurrency(s.price)}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <div
              key={p.id}
              className="flex flex-col justify-between rounded-2xl border border-[#232730] bg-[#14171D] p-5"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-[#94A3B8]">
                    SKU: {p.sku}
                  </span>
                  {p.is_low_stock ? (
                    <SpellBadge variant="orange" size="sm">
                      ESTOQUE BAIXO
                    </SpellBadge>
                  ) : (
                    <SpellBadge variant="emerald" size="sm">
                      EM ESTOQUE
                    </SpellBadge>
                  )}
                </div>
                <h3 className="mt-3 text-base font-bold text-[#F8FAFC]">
                  {p.name}
                </h3>
                <p className="mt-1 text-xs text-[#94A3B8]">
                  Custo: {formatCurrency(p.cost_price)} • Venda:{' '}
                  <strong className="text-[#F59E0B]">
                    {formatCurrency(p.sale_price)}
                  </strong>
                </p>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-[#232730] pt-3">
                <span className="text-sm font-bold text-[#F8FAFC]">
                  Qtd: {p.stock_quantity} un
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleQuickStockDelta(p, -1)}
                    className="h-8 w-8 rounded-lg border border-[#232730] bg-[#0B0D10] text-sm font-bold text-[#F8FAFC] hover:border-[#D97706]"
                  >
                    -1
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickStockDelta(p, 1)}
                    className="h-8 w-8 rounded-lg border border-[#232730] bg-[#0B0D10] text-sm font-bold text-[#F59E0B] hover:border-[#D97706]"
                  >
                    +1
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Novo Serviço */}
      <ModalDialog
        open={srvModalOpen}
        onClose={() => setSrvModalOpen(false)}
        title="Cadastrar Novo Serviço"
      >
        <form onSubmit={handleCreateService} className="space-y-4">
          <div>
            <label
              htmlFor="srv-name"
              className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
            >
              Nome do Serviço *
            </label>
            <input
              id="srv-name"
              required
              value={srvName}
              onChange={(e) => setSrvName(e.target.value)}
              className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="srv-cat"
                className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
              >
                Categoria
              </label>
              <select
                id="srv-cat"
                value={srvCategory}
                onChange={(e) => setSrvCategory(e.target.value)}
                className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
              >
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="srv-dur"
                className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
              >
                Duração (min) *
              </label>
              <input
                id="srv-dur"
                type="number"
                min="5"
                required
                value={srvDuration}
                onChange={(e) => setSrvDuration(e.target.value)}
                className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="srv-price"
                className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
              >
                Preço Normal (R$) *
              </label>
              <input
                id="srv-price"
                type="number"
                step="0.01"
                required
                value={srvPrice}
                onChange={(e) => setSrvPrice(e.target.value)}
                className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
              />
            </div>
            <div>
              <label
                htmlFor="srv-promo"
                className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
              >
                Preço Promocional (R$)
              </label>
              <input
                id="srv-promo"
                type="number"
                step="0.01"
                value={srvPromo}
                onChange={(e) => setSrvPromo(e.target.value)}
                className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setSrvModalOpen(false)}
              className="min-h-[44px] rounded-xl border border-[#232730] px-4 text-xs text-[#94A3B8]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="min-h-[44px] rounded-xl bg-[#D97706] px-5 text-xs font-bold text-[#0B0D10]"
            >
              Salvar Serviço
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* Modal Novo Produto */}
      <ModalDialog
        open={prodModalOpen}
        onClose={() => setProdModalOpen(false)}
        title="Cadastrar Novo Produto"
      >
        <form onSubmit={handleCreateProduct} className="space-y-4">
          <div>
            <label
              htmlFor="prod-name"
              className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
            >
              Nome do Produto *
            </label>
            <input
              id="prod-name"
              required
              value={prodName}
              onChange={(e) => setProdName(e.target.value)}
              className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="prod-cost"
                className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
              >
                Preço de Custo (R$)
              </label>
              <input
                id="prod-cost"
                type="number"
                step="0.01"
                value={prodCost}
                onChange={(e) => setProdCost(e.target.value)}
                className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
              />
            </div>
            <div>
              <label
                htmlFor="prod-sale"
                className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
              >
                Preço de Venda (R$) *
              </label>
              <input
                id="prod-sale"
                type="number"
                step="0.01"
                required
                value={prodSale}
                onChange={(e) => setProdSale(e.target.value)}
                className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="prod-stock"
                className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
              >
                Estoque Inicial *
              </label>
              <input
                id="prod-stock"
                type="number"
                required
                value={prodStock}
                onChange={(e) => setProdStock(e.target.value)}
                className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
              />
            </div>
            <div>
              <label
                htmlFor="prod-alert"
                className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
              >
                Alerta Mínimo *
              </label>
              <input
                id="prod-alert"
                type="number"
                required
                value={prodAlert}
                onChange={(e) => setProdAlert(e.target.value)}
                className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setProdModalOpen(false)}
              className="min-h-[44px] rounded-xl border border-[#232730] px-4 text-xs text-[#94A3B8]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="min-h-[44px] rounded-xl bg-[#D97706] px-5 text-xs font-bold text-[#0B0D10]"
            >
              Salvar Produto
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
