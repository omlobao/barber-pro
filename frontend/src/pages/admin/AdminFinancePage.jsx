import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle2,
  Plus,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import api from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { ModalDialog } from '@/components/ui/ModalDialog';
import { SpellBadge } from '@/components/spell/SpellBadge';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  PAYMENT_METHOD_LABELS,
  extractErrorMessage,
  formatCurrency,
  formatDateBR,
  toLocalISODate,
} from '@/utils/formatters';

export default function AdminFinancePage() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('CASHFLOW');
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');

  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txType, setTxType] = useState('EXPENSE');
  const [txCategory, setTxCategory] = useState('FIXED_EXPENSE');
  const [txDesc, setTxDesc] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txMethod, setTxMethod] = useState('PIX');
  const [txDate, setTxDate] = useState(() => toLocalISODate());
  const [savingTx, setSavingTx] = useState(false);

  const loadFinanceData = useCallback(async () => {
    setLoading(true);
    setFeedback('');
    try {
      const [sumRes, cfRes, comRes] = await Promise.all([
        api.get('/api/admin/cashflow/summary/'),
        api.get('/api/admin/cashflow/'),
        api.get('/api/admin/commissions/'),
      ]);
      setSummary(sumRes.data);
      setTransactions(Array.isArray(cfRes.data) ? cfRes.data : []);
      setCommissions(Array.isArray(comRes.data) ? comRes.data : []);
    } catch (err) {
      setFeedback(extractErrorMessage(err, 'Erro ao carregar dados financeiros.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFinanceData();
  }, [loadFinanceData]);

  const handleMarkCommissionPaid = async (commissionId) => {
    try {
      await api.post(`/api/admin/commissions/${commissionId}/mark-paid/`);
      await loadFinanceData();
    } catch (err) {
      setFeedback(extractErrorMessage(err, 'Erro ao confirmar repasse.'));
    }
  };

  const handleCreateTransaction = async (e) => {
    e.preventDefault();
    setSavingTx(true);
    setFeedback('');
    try {
      await api.post('/api/admin/cashflow/', {
        transaction_type: txType,
        category: txCategory,
        description: txDesc.trim(),
        amount: Number(txAmount).toFixed(2),
        payment_method: txMethod,
        date: txDate,
      });
      setTxModalOpen(false);
      setTxDesc('');
      setTxAmount('');
      await loadFinanceData();
    } catch (err) {
      setFeedback(extractErrorMessage(err, 'Erro ao salvar lançamento.'));
    } finally {
      setSavingTx(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#F8FAFC] sm:text-3xl">
            Financeiro & Comissões
          </h1>
          <p className="mt-1 text-sm text-[#94A3B8]">
            Fluxo de caixa consolidado, despesas operacionais e repasse da equipe.
          </p>
        </div>

        {isAdmin ? (
          <button
            type="button"
            onClick={() => setTxModalOpen(true)}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#D97706] px-5 text-sm font-bold text-[#0B0D10] hover:bg-[#F59E0B]"
          >
            <Plus className="h-4 w-4" />
            Novo Lançamento
          </button>
        ) : null}
      </div>

      {feedback ? (
        <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
          {feedback}
        </div>
      ) : null}

      {/* KPIs do Resumo Financeiro */}
      {loading ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((n) => (
            <Skeleton key={n} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : summary ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-[#232730] bg-[#14171D] p-5">
            <div className="flex items-center justify-between text-xs text-[#94A3B8]">
              <span>Receitas (Entradas)</span>
              <ArrowUpCircle className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="mt-2 text-2xl font-extrabold text-emerald-400">
              {formatCurrency(summary.total_income)}
            </p>
            <p className="mt-1 text-[11px] text-[#94A3B8]">
              {summary.paid_orders_count} comanda(s) liquidada(s)
            </p>
          </div>

          <div className="rounded-2xl border border-[#232730] bg-[#14171D] p-5">
            <div className="flex items-center justify-between text-xs text-[#94A3B8]">
              <span>Despesas (Saídas)</span>
              <ArrowDownCircle className="h-4 w-4 text-rose-400" />
            </div>
            <p className="mt-2 text-2xl font-extrabold text-rose-400">
              {formatCurrency(summary.total_expense)}
            </p>
            <p className="mt-1 text-[11px] text-[#94A3B8]">
              Inclui repasses e custos fixos
            </p>
          </div>

          <div className="rounded-2xl border border-[#232730] bg-[#14171D] p-5">
            <div className="flex items-center justify-between text-xs text-[#94A3B8]">
              <span>Saldo Líquido</span>
              <TrendingUp className="h-4 w-4 text-[#F59E0B]" />
            </div>
            <p className="mt-2 text-2xl font-extrabold text-[#F8FAFC]">
              {formatCurrency(summary.net_balance)}
            </p>
            <p className="mt-1 text-[11px] text-[#94A3B8]">
              Resultado líquido em caixa
            </p>
          </div>

          <div className="rounded-2xl border border-[#232730] bg-[#14171D] p-5">
            <div className="flex items-center justify-between text-xs text-[#94A3B8]">
              <span>Comissões Pendentes</span>
              <Wallet className="h-4 w-4 text-amber-400" />
            </div>
            <p className="mt-2 text-2xl font-extrabold text-[#F59E0B]">
              {formatCurrency(summary.pending_commissions)}
            </p>
            <p className="mt-1 text-[11px] text-[#94A3B8]">
              Aguardando repasse aos barbeiros
            </p>
          </div>
        </div>
      ) : null}

      {/* Abas Caixa x Comissões */}
      <div className="mt-8 flex gap-2 border-b border-[#232730] pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('CASHFLOW')}
          className={`min-h-[42px] rounded-xl px-4 text-xs font-bold transition ${
            activeTab === 'CASHFLOW'
              ? 'bg-[#D97706] text-[#0B0D10]'
              : 'bg-[#14171D] text-[#94A3B8] hover:text-[#F8FAFC]'
          }`}
        >
          Extrato de Caixa ({transactions.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('COMMISSIONS')}
          className={`min-h-[42px] rounded-xl px-4 text-xs font-bold transition ${
            activeTab === 'COMMISSIONS'
              ? 'bg-[#D97706] text-[#0B0D10]'
              : 'bg-[#14171D] text-[#94A3B8] hover:text-[#F8FAFC]'
          }`}
        >
          Comissões da Equipe ({commissions.length})
        </button>
      </div>

      {activeTab === 'CASHFLOW' ? (
        <div className="mt-5 space-y-2.5">
          {transactions.map((tx) => {
            const isIncome = tx.transaction_type === 'INCOME';
            return (
              <div
                key={tx.id}
                className="flex flex-col justify-between gap-3 rounded-2xl border border-[#232730] bg-[#14171D] p-4 sm:flex-row sm:items-center"
              >
                <div className="flex items-center gap-3">
                  {isIncome ? (
                    <ArrowUpCircle className="h-5 w-5 shrink-0 text-emerald-400" />
                  ) : (
                    <ArrowDownCircle className="h-5 w-5 shrink-0 text-rose-400" />
                  )}
                  <div>
                    <p className="text-sm font-bold text-[#F8FAFC]">
                      {tx.description || tx.category}
                    </p>
                    <p className="text-xs text-[#94A3B8]">
                      {formatDateBR(tx.date)} •{' '}
                      {PAYMENT_METHOD_LABELS[tx.payment_method] ||
                        tx.payment_method}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-base font-extrabold ${
                    isIncome ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {isIncome ? '+' : '-'} {formatCurrency(tx.amount)}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-5 space-y-2.5">
          {commissions.map((com) => (
            <div
              key={com.id}
              className="flex flex-col justify-between gap-3 rounded-2xl border border-[#232730] bg-[#14171D] p-4 sm:flex-row sm:items-center"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-[#F8FAFC]">
                    {com.professional_name}
                  </p>
                  <SpellBadge
                    variant={com.status === 'PAID' ? 'emerald' : 'amber'}
                    size="sm"
                  >
                    {com.status === 'PAID' ? 'PAGA' : 'PENDENTE'}
                  </SpellBadge>
                </div>
                <p className="mt-1 text-xs text-[#94A3B8]">
                  Base da comanda: {formatCurrency(com.base_amount)}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-base font-extrabold text-[#F59E0B]">
                  {formatCurrency(com.comission_amount)}
                </span>
                {isAdmin && com.status === 'PENDING' ? (
                  <button
                    type="button"
                    onClick={() => handleMarkCommissionPaid(com.id)}
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 text-xs font-bold text-[#0B0D10] hover:bg-emerald-400"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Pagar Comissão
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <ModalDialog
        open={txModalOpen}
        onClose={() => setTxModalOpen(false)}
        title="Novo Lançamento Manual no Caixa"
        subtitle="Registre despesas fixas, compras de insumos ou entradas avulsas."
      >
        <form onSubmit={handleCreateTransaction} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="tx-type"
                className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
              >
                Tipo
              </label>
              <select
                id="tx-type"
                value={txType}
                onChange={(e) => setTxType(e.target.value)}
                className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
              >
                <option value="EXPENSE">Saída (Despesa)</option>
                <option value="INCOME">Entrada (Receita)</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="tx-cat"
                className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
              >
                Categoria
              </label>
              <select
                id="tx-cat"
                value={txCategory}
                onChange={(e) => setTxCategory(e.target.value)}
                className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
              >
                <option value="FIXED_EXPENSE">Despesa Fixa (Aluguel/Luz)</option>
                <option value="STOCK_PURCHASE">Compra de Produtos</option>
                <option value="OTHER">Outros</option>
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="tx-desc"
              className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
            >
              Descrição *
            </label>
            <input
              id="tx-desc"
              type="text"
              required
              placeholder="Ex.: Conta de Energia Elétrica"
              value={txDesc}
              onChange={(e) => setTxDesc(e.target.value)}
              className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="tx-amount"
                className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
              >
                Valor (R$) *
              </label>
              <input
                id="tx-amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={txAmount}
                onChange={(e) => setTxAmount(e.target.value)}
                className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
              />
            </div>
            <div>
              <label
                htmlFor="tx-date"
                className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
              >
                Data *
              </label>
              <input
                id="tx-date"
                type="date"
                required
                value={txDate}
                onChange={(e) => setTxDate(e.target.value)}
                className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="tx-method"
              className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
            >
              Meio de Pagamento
            </label>
            <select
              id="tx-method"
              value={txMethod}
              onChange={(e) => setTxMethod(e.target.value)}
              className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
            >
              {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setTxModalOpen(false)}
              className="min-h-[44px] rounded-xl border border-[#232730] bg-[#0B0D10] px-4 text-xs font-semibold text-[#94A3B8]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingTx}
              className="min-h-[44px] rounded-xl bg-[#D97706] px-5 text-xs font-bold text-[#0B0D10]"
            >
              {savingTx ? 'Salvando...' : 'Salvar Lançamento'}
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
