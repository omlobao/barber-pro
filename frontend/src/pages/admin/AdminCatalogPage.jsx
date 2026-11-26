import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Edit3,
  PauseCircle,
  PlayCircle,
  Plus,
  Search,
  Star,
  Trash2,
} from 'lucide-react';
import api from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { ModalDialog } from '@/components/ui/ModalDialog';
import { SpellBadge } from '@/components/spell/SpellBadge';
import {
  CATEGORY_LABELS,
  extractErrorMessage,
  formatCurrency,
} from '@/utils/formatters';

const EMPTY_SRV_FORM = {
  name: '',
  category: 'HAIR',
  description: '',
  price: '',
  promotion_price: '',
  duration_minutes: '30',
  display_order: '0',
  is_featured: false,
  is_active: true,
};

const EMPTY_PROD_FORM = {
  name: '',
  sku: '',
  description: '',
  cost_price: '',
  sale_price: '',
  stock_quantity: '10',
  min_stock_alert: '3',
  is_active: true,
};

export default function AdminCatalogPage() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState('SERVICES');
  const [services, setServices] = useState([]);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [feedback, setFeedback] = useState('');

  // Modal Criar / Editar Serviço
  const [srvModalOpen, setSrvModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [srvForm, setSrvForm] = useState(EMPTY_SRV_FORM);
  const [srvFormError, setSrvFormError] = useState('');
  const [savingSrv, setSavingSrv] = useState(false);

  // Modal Criar / Editar Produto
  const [prodModalOpen, setProdModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [prodForm, setProdForm] = useState(EMPTY_PROD_FORM);
  const [prodFormError, setProdFormError] = useState('');
  const [savingProd, setSavingProd] = useState(false);

  // Modal Confirmação de Exclusão
  const [deleteTarget, setDeleteTarget] = useState(null);

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

  const filteredServices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return services;
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.description || '').toLowerCase().includes(q)
    );
  }, [services, search]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q)
    );
  }, [products, search]);

  // Ações de Serviço
  const openCreateService = () => {
    setEditingService(null);
    setSrvForm(EMPTY_SRV_FORM);
    setSrvFormError('');
    setSrvModalOpen(true);
  };

  const openEditService = (srv) => {
    setEditingService(srv);
    setSrvFormError('');
    setSrvForm({
      name: srv.name || '',
      category: srv.category || 'HAIR',
      description: srv.description || '',
      price: String(srv.price ?? ''),
      promotion_price:
        srv.promotion_price !== null && srv.promotion_price !== undefined
          ? String(srv.promotion_price)
          : '',
      duration_minutes: String(srv.duration_minutes ?? '30'),
      display_order: String(srv.display_order ?? '0'),
      is_featured: Boolean(srv.is_featured),
      is_active: Boolean(srv.is_active),
    });
    setSrvModalOpen(true);
  };

  const handleSaveService = async (e) => {
    e.preventDefault();
    setSavingSrv(true);
    setSrvFormError('');

    const payload = {
      name: srvForm.name.trim(),
      category: srvForm.category,
      description: srvForm.description.trim(),
      price: Number(srvForm.price).toFixed(2),
      promotion_price: srvForm.promotion_price
        ? Number(srvForm.promotion_price).toFixed(2)
        : null,
      duration_minutes: Number(srvForm.duration_minutes) || 30,
      display_order: Number(srvForm.display_order) || 0,
      is_featured: Boolean(srvForm.is_featured),
      is_active: Boolean(srvForm.is_active),
    };

    try {
      if (editingService) {
        await api.patch(`/api/admin/services/${editingService.id}/`, payload);
      } else {
        await api.post('/api/admin/services/', payload);
      }
      setSrvModalOpen(false);
      await loadCatalog();
    } catch (err) {
      setSrvFormError(extractErrorMessage(err, 'Erro ao salvar serviço.'));
    } finally {
      setSavingSrv(false);
    }
  };

  const handleToggleServiceActive = async (srv) => {
    setFeedback('');
    try {
      await api.patch(`/api/admin/services/${srv.id}/`, {
        is_active: !srv.is_active,
      });
      await loadCatalog();
    } catch (err) {
      setFeedback(
        extractErrorMessage(err, 'Não foi possível alterar o status do serviço.')
      );
    }
  };

  // Ações de Produto
  const openCreateProduct = () => {
    setEditingProduct(null);
    setProdForm(EMPTY_PROD_FORM);
    setProdFormError('');
    setProdModalOpen(true);
  };

  const openEditProduct = (prod) => {
    setEditingProduct(prod);
    setProdFormError('');
    setProdForm({
      name: prod.name || '',
      sku: prod.sku || '',
      description: prod.description || '',
      cost_price: String(prod.cost_price ?? '0.00'),
      sale_price: String(prod.sale_price ?? ''),
      stock_quantity: String(prod.stock_quantity ?? '0'),
      min_stock_alert: String(prod.min_stock_alert ?? '2'),
      is_active: Boolean(prod.is_active),
    });
    setProdModalOpen(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    setSavingProd(true);
    setProdFormError('');

    const payload = {
      name: prodForm.name.trim(),
      description: prodForm.description.trim(),
      cost_price: Number(prodForm.cost_price || 0).toFixed(2),
      sale_price: Number(prodForm.sale_price).toFixed(2),
      stock_quantity: Number(prodForm.stock_quantity),
      min_stock_alert: Number(prodForm.min_stock_alert),
      is_active: Boolean(prodForm.is_active),
    };
    if (prodForm.sku.trim()) {
      payload.sku = prodForm.sku.trim().toUpperCase();
    }

    try {
      if (editingProduct) {
        await api.patch(`/api/admin/products/${editingProduct.id}/`, payload);
      } else {
        await api.post('/api/admin/products/', payload);
      }
      setProdModalOpen(false);
      await loadCatalog();
    } catch (err) {
      setProdFormError(extractErrorMessage(err, 'Erro ao salvar produto.'));
    } finally {
      setSavingProd(false);
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

  const handleToggleProductActive = async (prod) => {
    setFeedback('');
    try {
      await api.patch(`/api/admin/products/${prod.id}/`, {
        is_active: !prod.is_active,
      });
      await loadCatalog();
    } catch (err) {
      setFeedback(
        extractErrorMessage(err, 'Não foi possível alterar o status do produto.')
      );
    }
  };

  // Exclusão Segura (Serviço ou Produto)
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setFeedback('');
    const endpoint =
      deleteTarget.kind === 'SERVICE'
        ? `/api/admin/services/${deleteTarget.id}/`
        : `/api/admin/products/${deleteTarget.id}/`;
    try {
      await api.delete(endpoint);
      setDeleteTarget(null);
      await loadCatalog();
    } catch (err) {
      setDeleteTarget(null);
      setFeedback(
        extractErrorMessage(err, 'Não foi possível excluir este item.')
      );
    }
  };

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#F8FAFC] sm:text-3xl">
            Serviços &amp; Estoque
          </h1>
          <p className="mt-1 text-sm text-[#94A3B8]">
            Cadastre, edite preços, promoções e controle o estoque de produtos.
          </p>
        </div>

        <div className="flex gap-2">
          {tab === 'SERVICES' && isAdmin ? (
            <button
              type="button"
              onClick={openCreateService}
              className="inline-flex min-h-[46px] items-center gap-2 rounded-xl bg-[#D97706] px-4 text-xs font-bold text-[#0B0D10] shadow-lg shadow-[#D97706]/20 hover:bg-[#F59E0B]"
            >
              <Plus className="h-4 w-4" />
              Novo Serviço
            </button>
          ) : null}
          {tab === 'PRODUCTS' ? (
            <button
              type="button"
              onClick={openCreateProduct}
              className="inline-flex min-h-[46px] items-center gap-2 rounded-xl bg-[#D97706] px-4 text-xs font-bold text-[#0B0D10] shadow-lg shadow-[#D97706]/20 hover:bg-[#F59E0B]"
            >
              <Plus className="h-4 w-4" />
              Novo Produto
            </button>
          ) : null}
        </div>
      </div>

      {feedback ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300"
        >
          {feedback}
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#232730] pb-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab('SERVICES')}
            className={`min-h-[42px] rounded-xl px-4 text-xs font-bold transition ${
              tab === 'SERVICES'
                ? 'bg-[#D97706] text-[#0B0D10]'
                : 'bg-[#14171D] text-[#94A3B8] hover:text-[#F8FAFC]'
            }`}
          >
            Serviços ({services.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('PRODUCTS')}
            className={`min-h-[42px] rounded-xl px-4 text-xs font-bold transition ${
              tab === 'PRODUCTS'
                ? 'bg-[#D97706] text-[#0B0D10]'
                : 'bg-[#14171D] text-[#94A3B8] hover:text-[#F8FAFC]'
            }`}
          >
            Produtos ({products.length})
          </button>
        </div>

        <div className="flex flex-1 items-center justify-end gap-2.5 sm:max-w-md">
          <search className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="search"
              aria-label="Buscar item no catálogo"
              placeholder={
                tab === 'SERVICES'
                  ? 'Buscar serviço...'
                  : 'Buscar produto ou SKU...'
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-xl border border-[#232730] bg-[#14171D] pr-3 pl-9 text-xs text-[#F8FAFC] placeholder-[#94A3B8]/50 focus:border-[#D97706] focus:outline-none"
            />
          </search>

          {tab === 'PRODUCTS' ? (
            <button
              type="button"
              onClick={() => setOnlyLowStock((prev) => !prev)}
              className={`inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold ${
                onlyLowStock
                  ? 'border-amber-500 bg-amber-500/15 text-amber-400'
                  : 'border-[#232730] bg-[#14171D] text-[#94A3B8]'
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Estoque Baixo
            </button>
          ) : null}
        </div>
      </div>

      {/* LISTA DE SERVIÇOS */}
      {tab === 'SERVICES' ? (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredServices.map((s) => (
            <div
              key={s.id}
              className="flex flex-col justify-between rounded-2xl border border-[#232730] bg-[#14171D] p-5"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <SpellBadge variant="outline" size="sm">
                      {CATEGORY_LABELS[s.category] || s.category}
                    </SpellBadge>
                    {s.is_featured ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#D97706]/15 px-2 py-0.5 text-[10px] font-bold text-[#F59E0B]">
                        <Star className="h-2.5 w-2.5 fill-current" />
                        Destaque
                      </span>
                    ) : null}
                  </div>
                  <SpellBadge
                    variant={s.is_active ? 'emerald' : 'rose'}
                    size="sm"
                  >
                    {s.is_active ? 'Ativo' : 'Inativo'}
                  </SpellBadge>
                </div>

                <h3 className="mt-3 text-base font-bold text-[#F8FAFC]">
                  {s.name}
                </h3>
                {s.description ? (
                  <p className="mt-1 line-clamp-2 text-xs text-[#94A3B8]">
                    {s.description}
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-[#94A3B8]">
                  Duração: <strong className="text-[#F8FAFC]">{s.duration_minutes} min</strong>
                </p>
              </div>

              <div className="mt-4 border-t border-[#232730] pt-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-extrabold text-[#F59E0B]">
                    {formatCurrency(s.effective_price)}
                  </span>
                  {s.promotion_price ? (
                    <span className="text-xs text-[#94A3B8] line-through">
                      {formatCurrency(s.price)}
                    </span>
                  ) : null}
                </div>

                {isAdmin ? (
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEditService(s)}
                      className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-xs font-bold text-[#F8FAFC] hover:border-[#D97706]/50"
                    >
                      <Edit3 className="h-3.5 w-3.5 text-[#D97706]" />
                      Editar
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleServiceActive(s)}
                      aria-label={s.is_active ? 'Inativar serviço' : 'Ativar serviço'}
                      title={s.is_active ? 'Inativar serviço' : 'Ativar serviço'}
                      className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-xl border border-[#232730] bg-[#0B0D10] text-[#94A3B8] hover:text-[#F8FAFC]"
                    >
                      {s.is_active ? (
                        <PauseCircle className="h-4 w-4 text-amber-400" />
                      ) : (
                        <PlayCircle className="h-4 w-4 text-emerald-400" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setDeleteTarget({
                          id: s.id,
                          name: s.name,
                          kind: 'SERVICE',
                        })
                      }
                      aria-label={`Excluir serviço ${s.name}`}
                      className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* LISTA DE PRODUTOS */
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((p) => (
            <div
              key={p.id}
              className="flex flex-col justify-between rounded-2xl border border-[#232730] bg-[#14171D] p-5"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-[#94A3B8]">
                    SKU: {p.sku}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {!p.is_active ? (
                      <SpellBadge variant="rose" size="sm">
                        INATIVO
                      </SpellBadge>
                    ) : p.is_low_stock ? (
                      <SpellBadge variant="orange" size="sm">
                        ESTOQUE BAIXO
                      </SpellBadge>
                    ) : (
                      <SpellBadge variant="emerald" size="sm">
                        EM ESTOQUE
                      </SpellBadge>
                    )}
                  </div>
                </div>

                <h3 className="mt-3 text-base font-bold text-[#F8FAFC]">
                  {p.name}
                </h3>
                {p.description ? (
                  <p className="mt-1 line-clamp-2 text-xs text-[#94A3B8]">
                    {p.description}
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-[#94A3B8]">
                  Custo: {formatCurrency(p.cost_price)} • Venda:{' '}
                  <strong className="text-[#F59E0B]">
                    {formatCurrency(p.sale_price)}
                  </strong>
                </p>
              </div>

              <div className="mt-5 space-y-3 border-t border-[#232730] pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[#F8FAFC]">
                    Qtd: {p.stock_quantity} un{' '}
                    <span className="text-[11px] font-normal text-[#94A3B8]">
                      (mín. {p.min_stock_alert})
                    </span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleQuickStockDelta(p, -1)}
                      className="h-8 w-8 rounded-lg border border-[#232730] bg-[#0B0D10] text-xs font-bold text-[#F8FAFC] hover:border-[#D97706]"
                    >
                      -1
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickStockDelta(p, 1)}
                      className="h-8 w-8 rounded-lg border border-[#232730] bg-[#0B0D10] text-xs font-bold text-[#F59E0B] hover:border-[#D97706]"
                    >
                      +1
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEditProduct(p)}
                    className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-xs font-bold text-[#F8FAFC] hover:border-[#D97706]/50"
                  >
                    <Edit3 className="h-3.5 w-3.5 text-[#D97706]" />
                    Editar
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleProductActive(p)}
                    aria-label={p.is_active ? 'Inativar produto' : 'Ativar produto'}
                    title={p.is_active ? 'Inativar produto' : 'Ativar produto'}
                    className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-xl border border-[#232730] bg-[#0B0D10] text-[#94A3B8] hover:text-[#F8FAFC]"
                  >
                    {p.is_active ? (
                      <PauseCircle className="h-4 w-4 text-amber-400" />
                    ) : (
                      <PlayCircle className="h-4 w-4 text-emerald-400" />
                    )}
                  </button>

                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteTarget({
                          id: p.id,
                          name: p.name,
                          kind: 'PRODUCT',
                        })
                      }
                      aria-label={`Excluir produto ${p.name}`}
                      className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Criar / Editar Serviço */}
      <ModalDialog
        open={srvModalOpen}
        onClose={() => setSrvModalOpen(false)}
        title={
          editingService
            ? `Editar Serviço — ${editingService.name}`
            : 'Cadastrar Novo Serviço'
        }
      >
        <form onSubmit={handleSaveService} className="space-y-4">
          {srvFormError ? (
            <div
              role="alert"
              className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs font-medium text-rose-300"
            >
              {srvFormError}
            </div>
          ) : null}

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
              value={srvForm.name}
              onChange={(e) =>
                setSrvForm((prev) => ({ ...prev, name: e.target.value }))
              }
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
                value={srvForm.category}
                onChange={(e) =>
                  setSrvForm((prev) => ({ ...prev, category: e.target.value }))
                }
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
                value={srvForm.duration_minutes}
                onChange={(e) =>
                  setSrvForm((prev) => ({
                    ...prev,
                    duration_minutes: e.target.value,
                  }))
                }
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
                min="0.01"
                required
                value={srvForm.price}
                onChange={(e) =>
                  setSrvForm((prev) => ({ ...prev, price: e.target.value }))
                }
                className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label
                  htmlFor="srv-promo"
                  className="text-xs font-semibold text-[#F8FAFC]"
                >
                  Preço Promocional (R$)
                </label>
                {srvForm.promotion_price ? (
                  <button
                    type="button"
                    onClick={() =>
                      setSrvForm((prev) => ({ ...prev, promotion_price: '' }))
                    }
                    className="text-[10px] font-bold text-[#F59E0B] hover:underline"
                  >
                    Limpar
                  </button>
                ) : null}
              </div>
              <input
                id="srv-promo"
                type="number"
                step="0.01"
                min="0"
                placeholder="Sem oferta"
                value={srvForm.promotion_price}
                onChange={(e) =>
                  setSrvForm((prev) => ({
                    ...prev,
                    promotion_price: e.target.value,
                  }))
                }
                className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="srv-desc"
              className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
            >
              Descrição na Vitrine
            </label>
            <textarea
              id="srv-desc"
              rows={2}
              placeholder="Ex.: Corte moderno com acabamento na navalha e finalização."
              value={srvForm.description}
              onChange={(e) =>
                setSrvForm((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              className="w-full rounded-xl border border-[#232730] bg-[#0B0D10] p-3 text-sm text-[#F8FAFC]"
            />
          </div>

          <div className="space-y-2 rounded-xl border border-[#232730] bg-[#0B0D10] p-3">
            <div className="flex items-center gap-2">
              <input
                id="srv-featured"
                type="checkbox"
                checked={srvForm.is_featured}
                onChange={(e) =>
                  setSrvForm((prev) => ({
                    ...prev,
                    is_featured: e.target.checked,
                  }))
                }
                className="h-4 w-4 accent-[#D97706]"
              />
              <label htmlFor="srv-featured" className="text-xs text-[#F8FAFC]">
                Destacar este serviço na vitrine inicial
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="srv-active"
                type="checkbox"
                checked={srvForm.is_active}
                onChange={(e) =>
                  setSrvForm((prev) => ({
                    ...prev,
                    is_active: e.target.checked,
                  }))
                }
                className="h-4 w-4 accent-[#D97706]"
              />
              <label htmlFor="srv-active" className="text-xs text-[#F8FAFC]">
                Serviço ativo para agendamento
              </label>
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
              disabled={savingSrv}
              className="min-h-[44px] rounded-xl bg-[#D97706] px-5 text-xs font-bold text-[#0B0D10]"
            >
              {savingSrv
                ? 'Salvando...'
                : editingService
                ? 'Salvar Alterações'
                : 'Salvar Serviço'}
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* Modal Criar / Editar Produto */}
      <ModalDialog
        open={prodModalOpen}
        onClose={() => setProdModalOpen(false)}
        title={
          editingProduct
            ? `Editar Produto — ${editingProduct.name}`
            : 'Cadastrar Novo Produto'
        }
      >
        <form onSubmit={handleSaveProduct} className="space-y-4">
          {prodFormError ? (
            <div
              role="alert"
              className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs font-medium text-rose-300"
            >
              {prodFormError}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label
                htmlFor="prod-name"
                className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
              >
                Nome do Produto *
              </label>
              <input
                id="prod-name"
                required
                value={prodForm.name}
                onChange={(e) =>
                  setProdForm((prev) => ({ ...prev, name: e.target.value }))
                }
                className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
              />
            </div>
            <div>
              <label
                htmlFor="prod-sku"
                className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
              >
                Código SKU
              </label>
              <input
                id="prod-sku"
                placeholder="Automático"
                value={prodForm.sku}
                onChange={(e) =>
                  setProdForm((prev) => ({
                    ...prev,
                    sku: e.target.value.toUpperCase(),
                  }))
                }
                className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 font-mono text-xs text-[#F8FAFC]"
              />
            </div>
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
                min="0"
                value={prodForm.cost_price}
                onChange={(e) =>
                  setProdForm((prev) => ({
                    ...prev,
                    cost_price: e.target.value,
                  }))
                }
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
                min="0.01"
                required
                value={prodForm.sale_price}
                onChange={(e) =>
                  setProdForm((prev) => ({
                    ...prev,
                    sale_price: e.target.value,
                  }))
                }
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
                Quantidade em Estoque *
              </label>
              <input
                id="prod-stock"
                type="number"
                required
                value={prodForm.stock_quantity}
                onChange={(e) =>
                  setProdForm((prev) => ({
                    ...prev,
                    stock_quantity: e.target.value,
                  }))
                }
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
                min="0"
                required
                value={prodForm.min_stock_alert}
                onChange={(e) =>
                  setProdForm((prev) => ({
                    ...prev,
                    min_stock_alert: e.target.value,
                  }))
                }
                className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="prod-desc"
              className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
            >
              Descrição (opcional)
            </label>
            <textarea
              id="prod-desc"
              rows={2}
              value={prodForm.description}
              onChange={(e) =>
                setProdForm((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              className="w-full rounded-xl border border-[#232730] bg-[#0B0D10] p-3 text-sm text-[#F8FAFC]"
            />
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-[#232730] bg-[#0B0D10] p-3">
            <input
              id="prod-active"
              type="checkbox"
              checked={prodForm.is_active}
              onChange={(e) =>
                setProdForm((prev) => ({
                  ...prev,
                  is_active: e.target.checked,
                }))
              }
              className="h-4 w-4 accent-[#D97706]"
            />
            <label htmlFor="prod-active" className="text-xs text-[#F8FAFC]">
              Produto disponível no caixa (PDV)
            </label>
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
              disabled={savingProd}
              className="min-h-[44px] rounded-xl bg-[#D97706] px-5 text-xs font-bold text-[#0B0D10]"
            >
              {savingProd
                ? 'Salvando...'
                : editingProduct
                ? 'Salvar Alterações'
                : 'Salvar Produto'}
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* Modal de Confirmação de Exclusão */}
      <ModalDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Confirmar exclusão?"
        subtitle="Itens que já possuem atendamentos ou vendas anteriores são preservados (use Inativar nesses casos)."
      >
        <p className="text-sm text-[#94A3B8]">
          Deseja excluir{' '}
          <strong className="text-[#F8FAFC]">{deleteTarget?.name}</strong>?
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
            className="min-h-[44px] rounded-xl bg-rose-600 px-5 text-xs font-bold text-white hover:bg-rose-500"
          >
            Excluir
          </button>
        </div>
      </ModalDialog>
    </div>
  );
}
