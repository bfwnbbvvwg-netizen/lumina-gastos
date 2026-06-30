import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Banknote,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Coffee,
  Home,
  Lightbulb,
  ListFilter,
  LogOut,
  Plus,
  ReceiptText,
  Search,
  ShoppingBag,
  Sparkles,
  Repeat2,
  Utensils,
  WalletCards,
  X,
} from 'lucide-react';
import { getSession, onAuthStateChange, signOut } from './services/auth';
import { listAlerts, markAlertRead } from './services/alerts';
import { listIncomes, saveIncome } from './services/incomes';
import { listRecurringExpenses } from './services/recurring';
import { isSupabaseReady, listTransactions, saveTransaction } from './services/transactions';
import Login from './views/Login';

const categories = {
  comida: { label: 'Comida', icon: Utensils, color: '#c86f5f' },
  hogar: { label: 'Hogar', icon: Home, color: '#7d9d8c' },
  cafe: { label: 'Cafe', icon: Coffee, color: '#d5a83f' },
  compras: { label: 'Compras', icon: ShoppingBag, color: '#6d99b8' },
  servicios: { label: 'Servicios', icon: WalletCards, color: '#536f55' },
};

const initialTransactions = [
  { id: 1, category: 'comida', description: 'Super semanal', date: '2026-06-03', amount: 1260 },
  { id: 2, category: 'servicios', description: 'Internet', date: '2026-06-05', amount: 599 },
  { id: 3, category: 'cafe', description: 'Cafe con Ana', date: '2026-06-06', amount: 180 },
  { id: 4, category: 'compras', description: 'Camisa trabajo', date: '2026-06-08', amount: 820 },
  { id: 5, category: 'comida', description: 'Cena viernes', date: '2026-06-12', amount: 740 },
  { id: 6, category: 'hogar', description: 'Detergente y focos', date: '2026-06-14', amount: 410 },
  { id: 7, category: 'servicios', description: 'Luz', date: '2026-06-16', amount: 930 },
  { id: 8, category: 'comida', description: 'Mercado', date: '2026-06-18', amount: 1120 },
  { id: 9, category: 'compras', description: 'Regalo', date: '2026-06-21', amount: 650 },
  { id: 10, category: 'cafe', description: 'Panaderia', date: '2026-06-22', amount: 155 },
];

const initialIncomes = [
  { id: 'i1', description: 'Nomina', source: 'Trabajo', date: '2026-06-01', amount: 12000 },
];

const initialRecurringExpenses = [
  { id: 'r1', name: 'Netflix', merchant: 'Netflix', category: 'servicios', amount: 219, billingDay: 3, isActive: true },
  { id: 'r2', name: 'Spotify', merchant: 'Spotify', category: 'servicios', amount: 129, billingDay: 8, isActive: true },
  { id: 'r3', name: 'Gimnasio', merchant: 'Smart Fit', category: 'hogar', amount: 599, billingDay: 12, isActive: true },
  { id: 'r4', name: 'iCloud', merchant: 'Apple', category: 'servicios', amount: 49, billingDay: 18, isActive: true },
  { id: 'r5', name: 'Software', merchant: 'Notion', category: 'compras', amount: 180, billingDay: 25, isActive: true },
];

const currency = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
});

const tabs = [
  { id: 'month', label: 'Mes', icon: CircleDollarSign },
  { id: 'week', label: 'Semana', icon: CalendarDays },
  { id: 'fortnight', label: 'Quincena', icon: Banknote },
  { id: 'recurring', label: 'Recurrentes', icon: Repeat2 },
  { id: 'history', label: 'Historial', icon: ReceiptText },
];

function parseLocalDate(date) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatShortDate(date) {
  return parseLocalDate(date).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
  });
}

function sameWeek(transaction, weekIndex) {
  const day = parseLocalDate(transaction.date).getDate();
  const start = weekIndex * 7 + 1;
  return day >= start && day <= start + 6;
}

function getCategoryTotal(transactions, key) {
  return transactions
    .filter((transaction) => transaction.category === key)
    .reduce((total, transaction) => total + transaction.amount, 0);
}

function getUpcomingDay(expense, today = new Date()) {
  const day = today.getDate();
  if (expense.billingDay >= day) return expense.billingDay - day;

  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return lastDay - day + expense.billingDay;
}

function buildLocalAlerts({ percent, topCategory, maxDay, trendDown }) {
  const alerts = [];

  if (percent >= 80) {
    alerts.push({
      id: 'local-budget-80',
      type: 'budget_80',
      title: 'Presupuesto en zona sensible',
      body: `Ya usaste ${Math.round(percent)}% de tus ingresos mensuales. Revisa ${topCategory?.label ?? 'tu categoria principal'} antes de registrar mas gastos.`,
    });
  }

  if (maxDay.total >= 1000) {
    alerts.push({
      id: 'local-weekly-max',
      type: 'weekly_max',
      title: 'Gasto alto esta semana',
      body: `${maxDay.label} concentra ${currency.format(maxDay.total)}. Puede valer la pena revisar que impulso ese pico.`,
    });
  }

  alerts.push({
    id: 'local-fortnight-trend',
    type: 'fortnight_trend',
    title: trendDown ? 'La segunda quincena va mas ligera' : 'La segunda quincena pide atencion',
    body: trendDown
      ? 'Tu ritmo de gasto bajo frente a la primera quincena.'
      : 'Q2 viene por encima de Q1; conviene vigilar los proximos movimientos.',
  });

  return alerts;
}

function App() {
  const supabaseEnabled = isSupabaseReady();
  const [session, setSession] = useState(null);
  const [isInitializing, setIsInitializing] = useState(supabaseEnabled);
  const [activeTab, setActiveTab] = useState('month');
  const [transactions, setTransactions] = useState(supabaseEnabled ? [] : initialTransactions);
  const [incomes, setIncomes] = useState(supabaseEnabled ? [] : initialIncomes);
  const [recurringExpenses, setRecurringExpenses] = useState(
    supabaseEnabled ? [] : initialRecurringExpenses,
  );
  const [weekIndex, setWeekIndex] = useState(2);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('todos');
  const [isAdding, setIsAdding] = useState(false);
  const [remoteAlerts, setRemoteAlerts] = useState([]);
  const [syncMessage, setSyncMessage] = useState(
    supabaseEnabled ? 'Supabase configurado; verificando sesion.' : 'Modo demo local',
  );

  useEffect(() => {
    if (!supabaseEnabled) {
      setIsInitializing(false);
      return undefined;
    }

    let cancelled = false;

    async function loadSession() {
      try {
        const activeSession = await getSession();
        if (!cancelled) {
          setSession(activeSession);
          setIsInitializing(false);
        }
      } catch (error) {
        if (!cancelled) {
          setSyncMessage(`Supabase: ${error.message}`);
          setIsInitializing(false);
        }
      }
    }

    loadSession();

    const subscription = onAuthStateChange((activeSession) => {
      setSession(activeSession);
      setIsInitializing(false);
    });

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, [supabaseEnabled]);

  useEffect(() => {
    if (!supabaseEnabled) return undefined;
    if (!session) {
      setSyncMessage('Supabase listo; inicia sesion para guardar en la nube.');
      return undefined;
    }

    let cancelled = false;
    setTransactions([]);
    setIncomes([]);
    setRecurringExpenses([]);
    setRemoteAlerts([]);
    setSyncMessage('Cargando tus datos...');

    async function loadRemoteTransactions() {
      try {
        const result = await listTransactions();
        if (cancelled) return;

        if (result.mode === 'supabase') {
          setTransactions(result.transactions);
          setSyncMessage('Conectado a Supabase');

          const incomesResult = await listIncomes();
          if (!cancelled && incomesResult.mode === 'supabase') {
            setIncomes(incomesResult.incomes);
          }

          const alertsResult = await listAlerts();
          if (!cancelled && alertsResult.mode === 'supabase') {
            setRemoteAlerts(alertsResult.alerts);
          }

          const recurringResult = await listRecurringExpenses();
          if (!cancelled && recurringResult.mode === 'supabase') {
            setRecurringExpenses(recurringResult.recurringExpenses);
          }
        }

        if (result.mode === 'needs-auth') {
          setSyncMessage('Supabase listo; inicia sesion para guardar en la nube.');
        }
      } catch (error) {
        if (!cancelled) setSyncMessage(`Supabase: ${error.message}`);
      }
    }

    loadRemoteTransactions();

    return () => {
      cancelled = true;
    };
  }, [session, supabaseEnabled]);

  const incomeTotal = useMemo(
    () => incomes.reduce((total, income) => total + income.amount, 0),
    [incomes],
  );
  const budget = incomeTotal;
  const spent = useMemo(
    () => transactions.reduce((total, transaction) => total + transaction.amount, 0),
    [transactions],
  );
  const percent = budget > 0 ? Math.min((spent / budget) * 100, 100) : spent > 0 ? 100 : 0;
  const remaining = budget - spent;

  const rankedCategories = useMemo(() => {
    return Object.keys(categories)
      .map((key) => ({ key, total: getCategoryTotal(transactions, key), ...categories[key] }))
      .filter((category) => category.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [transactions]);

  const dailyTotals = useMemo(() => {
    const days = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    return days.map((label, index) => {
      const total = transactions
        .filter((transaction) => sameWeek(transaction, weekIndex))
        .filter((transaction) => {
          const day = parseLocalDate(transaction.date).getDay();
          const mondayIndex = day === 0 ? 6 : day - 1;
          return mondayIndex === index;
        })
        .reduce((sum, transaction) => sum + transaction.amount, 0);
      return { label, total };
    });
  }, [transactions, weekIndex]);

  const maxDay = dailyTotals.reduce((current, day) => (day.total > current.total ? day : current), {
    label: 'L',
    total: 0,
  });

  const q1 = transactions
    .filter((transaction) => parseLocalDate(transaction.date).getDate() <= 15)
    .reduce((total, transaction) => total + transaction.amount, 0);
  const q2 = spent - q1;
  const trendDown = q2 <= q1;
  const recurringTotal = useMemo(
    () => recurringExpenses.reduce((total, expense) => total + expense.amount, 0),
    [recurringExpenses],
  );
  const localAlerts = useMemo(
    () => buildLocalAlerts({ percent, topCategory: rankedCategories[0], maxDay, trendDown }),
    [percent, rankedCategories, maxDay, trendDown],
  );
  const visibleAlerts = supabaseEnabled && session ? remoteAlerts : localAlerts;

  const filteredTransactions = transactions
    .filter((transaction) => {
      const normalized = `${transaction.description} ${categories[transaction.category].label}`.toLowerCase();
      const matchesQuery = normalized.includes(query.toLowerCase());
      const matchesFilter =
        filter === 'todos' ||
        transaction.category === filter ||
        (filter === 'mayores' && transaction.amount >= 500);
      return matchesQuery && matchesFilter;
    })
    .sort((a, b) => parseLocalDate(b.date) - parseLocalDate(a.date));

  async function addMovement(formData) {
    const movementType = formData.get('movementType');
    const nextMovement = {
      id: crypto.randomUUID(),
      description: formData.get('description') || (movementType === 'income' ? 'Ingreso' : 'Gasto rapido'),
      amount: Number(formData.get('amount')),
      date: formData.get('date'),
    };
    if (!nextMovement.amount || !nextMovement.date) return;

    if (movementType === 'income') {
      const nextIncome = {
        ...nextMovement,
        source: formData.get('source') || '',
      };

      try {
        const result = await saveIncome(nextIncome);
        if (result.mode === 'needs-auth') {
          setSyncMessage('Ingreso guardado localmente; inicia sesion para activar Supabase.');
          setIncomes((current) => [nextIncome, ...current]);
        } else {
          setSyncMessage(result.mode === 'supabase' ? 'Ingreso guardado en Supabase' : 'Ingreso guardado en demo');
          setIncomes((current) => [result.income, ...current]);
        }
        setIsAdding(false);
      } catch (error) {
        setSyncMessage(`No se pudo guardar el ingreso: ${error.message}`);
        if (!(supabaseEnabled && session)) {
          setIncomes((current) => [nextIncome, ...current]);
        }
        setIsAdding(false);
      }
      return;
    }

    const nextTransaction = {
      ...nextMovement,
      category: formData.get('category'),
    };

    try {
      const result = await saveTransaction(nextTransaction);
      if (result.mode === 'needs-auth') {
        setSyncMessage('Gasto guardado localmente; inicia sesion para activar Supabase.');
        setTransactions((current) => [nextTransaction, ...current]);
      } else {
        setSyncMessage(result.mode === 'supabase' ? 'Gasto guardado en Supabase' : 'Gasto guardado en demo');
        setTransactions((current) => [result.transaction, ...current]);
        if (result.mode === 'supabase') {
          const alertsResult = await listAlerts();
          if (alertsResult.mode === 'supabase') setRemoteAlerts(alertsResult.alerts);
        }
      }
      setIsAdding(false);
    } catch (error) {
      setSyncMessage(`No se pudo guardar en Supabase: ${error.message}`);
      if (!(supabaseEnabled && session)) {
        setTransactions((current) => [nextTransaction, ...current]);
      }
      setIsAdding(false);
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
      setTransactions(supabaseEnabled ? [] : initialTransactions);
      setIncomes(supabaseEnabled ? [] : initialIncomes);
      setRecurringExpenses(supabaseEnabled ? [] : initialRecurringExpenses);
      setRemoteAlerts([]);
      setSyncMessage('Sesion cerrada.');
    } catch (error) {
      setSyncMessage(`No se pudo cerrar sesion: ${error.message}`);
    }
  }

  async function handleMarkAlertRead(alertId) {
    if (!(supabaseEnabled && session)) return;

    try {
      await markAlertRead(alertId);
      setRemoteAlerts((current) => current.filter((alert) => alert.id !== alertId));
    } catch (error) {
      setSyncMessage(`No se pudo actualizar la alerta: ${error.message}`);
    }
  }

  if (isInitializing) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper px-4 text-center text-sm font-semibold text-ink/55">
        Cargando Lumina...
      </main>
    );
  }

  if (supabaseEnabled && !session) {
    return <Login />;
  }

  return (
    <main className="min-h-screen pb-28 text-ink">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <div>
            <p className="text-sm font-medium text-moss">
              Hola, {session?.user?.email?.split('@')[0] || 'Carlos'}
            </p>
            <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">Lumina</h1>
            <p className="mt-1 text-xs font-semibold text-ink/45">{syncMessage}</p>
          </div>
          <div className="flex items-center gap-2">
            {supabaseEnabled && session && (
              <button
                type="button"
                onClick={handleSignOut}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-ink/55 shadow-soft transition hover:text-coral focus:outline-none focus:ring-4 focus:ring-coral/20"
                aria-label="Cerrar sesion"
              >
                <LogOut aria-hidden="true" size={20} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="inline-flex h-12 min-w-12 items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white shadow-soft transition hover:bg-moss focus:outline-none focus:ring-4 focus:ring-sage/30"
            >
              <Plus aria-hidden="true" size={20} />
              <span>Agregar</span>
            </button>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <BudgetPanel spent={spent} budget={budget} remaining={remaining} percent={percent} />
          <InsightPanel
            percent={percent}
            topCategory={rankedCategories[0]}
            maxDay={maxDay}
            trendDown={trendDown}
            alerts={visibleAlerts}
            onMarkAlertRead={supabaseEnabled && session ? handleMarkAlertRead : null}
          />
        </section>

        <nav className="sticky top-3 z-20 rounded-full border border-white/70 bg-white/85 p-1 shadow-soft backdrop-blur">
          <div className="flex gap-1 overflow-x-auto scrollbar-none sm:grid sm:grid-cols-5">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  type="button"
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex h-12 min-w-[7.5rem] items-center justify-center gap-1.5 rounded-full px-3 text-xs font-semibold transition sm:min-w-0 sm:text-sm ${
                    active ? 'bg-ink text-white shadow-sm' : 'text-ink/70 hover:bg-paper'
                  }`}
                  aria-pressed={active}
                >
                  <Icon aria-hidden="true" size={18} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {activeTab === 'month' && (
          <MonthView rankedCategories={rankedCategories} spent={spent} transactions={transactions} />
        )}
        {activeTab === 'week' && (
          <WeekView
            dailyTotals={dailyTotals}
            weekIndex={weekIndex}
            setWeekIndex={setWeekIndex}
            maxDay={maxDay}
          />
        )}
        {activeTab === 'fortnight' && <FortnightView q1={q1} q2={q2} trendDown={trendDown} />}
        {activeTab === 'recurring' && (
          <RecurringView recurringExpenses={recurringExpenses} total={recurringTotal} budget={budget} />
        )}
        {activeTab === 'history' && (
          <HistoryView
            query={query}
            setQuery={setQuery}
            filter={filter}
            setFilter={setFilter}
            transactions={filteredTransactions}
          />
        )}
      </div>

      <button
        type="button"
        onClick={() => setIsAdding(true)}
        aria-label="Agregar gasto"
        className="fixed bottom-5 right-5 z-30 flex h-16 w-16 items-center justify-center rounded-full bg-coral text-white shadow-soft transition hover:bg-clay active:scale-95 sm:hidden"
      >
        <Plus aria-hidden="true" size={30} />
      </button>

      {isAdding && <QuickAdd onClose={() => setIsAdding(false)} onSave={addMovement} />}
    </main>
  );
}

function BudgetPanel({ spent, budget, remaining, percent }) {
  const barColor = remaining < 0 || percent >= 80 ? 'bg-coral' : 'bg-sage';

  return (
    <section className="rounded-lg border border-white/80 bg-white p-5 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-ink/55">Balance disponible</p>
          <p className="mt-1 text-4xl font-semibold tracking-normal sm:text-5xl">
            {currency.format(remaining)}
          </p>
        </div>
        <span className="rounded-full bg-sage/15 px-3 py-1 text-sm font-semibold text-moss">
          Junio 2026
        </span>
      </div>
      <div className="mt-7">
        <div className="h-3 w-full overflow-hidden rounded-full bg-paper">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${percent}%` }} />
        </div>
        <div className="mt-3 flex items-center justify-between text-sm font-medium text-ink/58">
          <span>{currency.format(spent)} gastado</span>
          <span>{currency.format(budget)} ingresos</span>
        </div>
      </div>
    </section>
  );
}

function InsightPanel({ percent, topCategory, maxDay, trendDown, alerts, onMarkAlertRead }) {
  return (
    <section className="rounded-lg border border-white/80 bg-[#fffaf0] p-5 shadow-soft sm:p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-marigold/20 text-clay">
          <Lightbulb aria-hidden="true" size={22} />
        </span>
        <div>
          <p className="text-sm font-semibold text-clay">Aviso inteligente</p>
          <h2 className="text-xl font-semibold tracking-normal">Ritmo bajo control</h2>
        </div>
      </div>
      <p className="mt-5 text-sm leading-6 text-ink/70">
        Has usado {Math.round(percent)}% de tus ingresos registrados. Tu mayor categoria es{' '}
        <strong>{topCategory?.label ?? 'Sin datos'}</strong> y el dia mas alto de esta semana fue{' '}
        <strong>{maxDay.label}</strong> con <strong>{currency.format(maxDay.total)}</strong>.
      </p>
      <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-semibold text-ink">
        {trendDown ? <ArrowDown aria-hidden="true" size={18} /> : <ArrowUp aria-hidden="true" size={18} />}
        {trendDown ? 'Q2 viene mas ligera' : 'Q2 necesita atencion'}
      </div>
      <div className="mt-5 space-y-3">
        {alerts.slice(0, 2).map((alert) => (
          <div key={alert.id} className="rounded-lg border border-white bg-white/80 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sage/18 text-moss">
                  <Bell aria-hidden="true" size={16} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{alert.title}</p>
                  <p className="mt-1 text-xs font-medium leading-5 text-ink/62">{alert.body}</p>
                </div>
              </div>
              {onMarkAlertRead && (
                <button
                  type="button"
                  onClick={() => onMarkAlertRead(alert.id)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink/45 transition hover:bg-sage/15 hover:text-moss"
                  aria-label="Marcar alerta como leida"
                >
                  <CheckCircle2 aria-hidden="true" size={17} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MonthView({ rankedCategories, spent, transactions }) {
  return (
    <section className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
      <div className="rounded-lg border border-white/80 bg-white p-5 shadow-soft sm:p-6">
        <h2 className="text-lg font-semibold tracking-normal">Top categorias</h2>
        <div className="mt-5 flex items-center justify-center">
          <DonutChart categories={rankedCategories.slice(0, 3)} total={spent} />
        </div>
      </div>
      <div className="rounded-lg border border-white/80 bg-white p-5 shadow-soft sm:p-6">
        <h2 className="text-lg font-semibold tracking-normal">Movimientos recientes</h2>
        <div className="mt-4 divide-y divide-paper">
          {transactions
            .slice()
            .sort((a, b) => parseLocalDate(b.date) - parseLocalDate(a.date))
            .slice(0, 5)
            .map((transaction) => (
              <TransactionRow key={transaction.id} transaction={transaction} />
            ))}
        </div>
      </div>
    </section>
  );
}

function DonutChart({ categories, total }) {
  let offset = 0;
  const gradient = categories
    .map((category) => {
      const start = offset;
      const size = total ? (category.total / total) * 100 : 0;
      offset += size;
      return `${category.color} ${start}% ${offset}%`;
    })
    .join(', ');
  const chartBackground =
    categories.length > 0
      ? `conic-gradient(${gradient}, #ebe7dc ${offset}% 100%)`
      : '#ebe7dc';

  return (
    <div className="grid w-full gap-5 sm:grid-cols-[190px_1fr] sm:items-center">
      <div
        className="mx-auto h-48 w-48 rounded-full"
        style={{ background: chartBackground }}
        aria-label="Distribucion de gastos"
      >
        <div className="flex h-full w-full items-center justify-center rounded-full p-8">
          <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-white text-center shadow-inner">
            <span className="text-xs font-semibold text-ink/50">Total</span>
            <span className="text-lg font-semibold">{currency.format(total)}</span>
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {categories.map((category) => {
          const Icon = category.icon;
          return (
            <div key={category.key} className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
                  style={{ background: category.color }}
                >
                  <Icon aria-hidden="true" size={18} />
                </span>
                <span className="truncate text-sm font-semibold">{category.label}</span>
              </div>
              <span className="text-sm font-semibold text-ink/65">{currency.format(category.total)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ dailyTotals, weekIndex, setWeekIndex, maxDay }) {
  const max = Math.max(...dailyTotals.map((day) => day.total), 1);

  return (
    <section className="rounded-lg border border-white/80 bg-white p-5 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-normal">Semana {weekIndex + 1}</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekIndex((current) => Math.max(0, current - 1))}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-paper text-ink hover:bg-sage/20"
            aria-label="Semana anterior"
          >
            <ChevronLeft aria-hidden="true" size={20} />
          </button>
          <button
            type="button"
            onClick={() => setWeekIndex((current) => Math.min(3, current + 1))}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-paper text-ink hover:bg-sage/20"
            aria-label="Semana siguiente"
          >
            <ChevronRight aria-hidden="true" size={20} />
          </button>
        </div>
      </div>

      <div className="mt-8 grid h-72 grid-cols-7 items-end gap-3 sm:gap-5">
        {dailyTotals.map((day, index) => (
          <div key={`${day.label}-${index}`} className="flex h-full flex-col items-center justify-end gap-3">
            <div className="flex h-56 w-full items-end rounded-full bg-paper">
              <div
                className="w-full rounded-full bg-sky transition-all"
                style={{ height: `${Math.max((day.total / max) * 100, day.total ? 8 : 0)}%` }}
                title={currency.format(day.total)}
              />
            </div>
            <span className="text-sm font-semibold text-ink/65">{day.label}</span>
          </div>
        ))}
      </div>

      <div className="mt-7 rounded-lg bg-sage/12 p-4 text-sm font-medium leading-6 text-ink/75">
        {maxDay.total > 0
          ? `${maxDay.label} fue tu mayor gasto con ${currency.format(maxDay.total)}.`
          : 'Esta semana aun no tiene gastos registrados.'}
      </div>
    </section>
  );
}

function FortnightView({ q1, q2, trendDown }) {
  const max = Math.max(q1, q2, 1);

  return (
    <section className="grid gap-5 md:grid-cols-2">
      <FortnightCard label="Q1" range="1-15" amount={q1} max={max} color="bg-sage" />
      <FortnightCard label="Q2" range="16-Fin" amount={q2} max={max} color="bg-coral" />
      <div className="rounded-lg border border-white/80 bg-white p-5 shadow-soft md:col-span-2 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-ink/55">Comparativa quincenal</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-normal">
              {trendDown ? 'Gastaste menos en Q2' : 'Q2 supero a Q1'}
            </h2>
          </div>
          <span
            className={`flex h-12 w-12 items-center justify-center rounded-full ${
              trendDown ? 'bg-sage/20 text-moss' : 'bg-coral/20 text-clay'
            }`}
          >
            {trendDown ? <ArrowDown aria-hidden="true" size={24} /> : <ArrowUp aria-hidden="true" size={24} />}
          </span>
        </div>
      </div>
    </section>
  );
}

function FortnightCard({ label, range, amount, max, color }) {
  return (
    <div className="rounded-lg border border-white/80 bg-white p-5 shadow-soft sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-ink/55">{range}</p>
          <h2 className="text-2xl font-semibold tracking-normal">{label}</h2>
        </div>
        <p className="text-xl font-semibold">{currency.format(amount)}</p>
      </div>
      <div className="mt-8 h-4 rounded-full bg-paper">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${(amount / max) * 100}%` }} />
      </div>
    </div>
  );
}

function RecurringView({ recurringExpenses, total, budget }) {
  const commitment = budget ? Math.round((total / budget) * 100) : 0;
  const nextExpense = recurringExpenses
    .slice()
    .sort((a, b) => getUpcomingDay(a) - getUpcomingDay(b))[0];

  return (
    <section className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
      <div className="rounded-lg border border-white/80 bg-white p-5 shadow-soft sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sky/15 text-sky">
            <Repeat2 aria-hidden="true" size={22} />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink/55">Comprometido mensual</p>
            <h2 className="text-3xl font-semibold tracking-normal">{currency.format(total)}</h2>
          </div>
        </div>
        <div className="mt-7 h-3 rounded-full bg-paper">
          <div className="h-full rounded-full bg-sky" style={{ width: `${Math.min(commitment, 100)}%` }} />
        </div>
        <p className="mt-3 text-sm font-medium leading-6 text-ink/62">
          {commitment}% de tus ingresos ya esta reservado antes de gastos variables.
        </p>
        {nextExpense && (
          <div className="mt-5 rounded-lg bg-sage/12 p-4">
            <div className="flex items-center gap-3">
              <Clock3 aria-hidden="true" className="shrink-0 text-moss" size={20} />
              <p className="text-sm font-semibold text-ink">
                Proximo cargo: {nextExpense.name} en {getUpcomingDay(nextExpense)} dias
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-white/80 bg-white p-5 shadow-soft sm:p-6">
        <h2 className="text-lg font-semibold tracking-normal">Suscripciones activas</h2>
        <div className="mt-4 divide-y divide-paper">
          {recurringExpenses.map((expense) => {
            const category = categories[expense.category] || categories.servicios;
            const Icon = category.icon;
            return (
              <div key={expense.id} className="flex min-h-20 items-center justify-between gap-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white"
                    style={{ background: category.color }}
                  >
                    <Icon aria-hidden="true" size={19} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{expense.name}</p>
                    <p className="text-xs font-medium text-ink/48">
                      Dia {expense.billingDay} · {expense.merchant || category.label}
                    </p>
                  </div>
                </div>
                <p className="shrink-0 text-sm font-semibold">{currency.format(expense.amount)}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function HistoryView({ query, setQuery, filter, setFilter, transactions }) {
  const filterOptions = [
    { id: 'todos', label: 'Todos' },
    { id: 'comida', label: 'Comida' },
    { id: 'servicios', label: 'Servicios' },
    { id: 'mayores', label: '>$500' },
  ];

  return (
    <section className="rounded-lg border border-white/80 bg-white p-5 shadow-soft sm:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <label className="relative block md:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/45" size={19} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar"
            className="h-12 w-full rounded-full border border-paper bg-paper pl-10 pr-4 text-sm outline-none transition focus:border-sage focus:bg-white"
          />
        </label>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {filterOptions.map((option) => (
            <button
              type="button"
              key={option.id}
              onClick={() => setFilter(option.id)}
              className={`h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition ${
                filter === option.id ? 'bg-ink text-white' : 'bg-paper text-ink/65 hover:bg-sage/20'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-5 divide-y divide-paper">
        {transactions.length ? (
          transactions.map((transaction) => <TransactionRow key={transaction.id} transaction={transaction} />)
        ) : (
          <div className="flex h-36 flex-col items-center justify-center gap-2 text-center text-ink/55">
            <ListFilter aria-hidden="true" size={28} />
            <p className="text-sm font-semibold">Sin movimientos</p>
          </div>
        )}
      </div>
    </section>
  );
}

function TransactionRow({ transaction }) {
  const category = categories[transaction.category];
  const Icon = category.icon;

  return (
    <div className="flex min-h-20 items-center justify-between gap-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white"
          style={{ background: category.color }}
        >
          <Icon aria-hidden="true" size={19} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{transaction.description}</p>
          <p className="text-xs font-medium text-ink/48">
            {category.label} · {formatShortDate(transaction.date)}
          </p>
        </div>
      </div>
      <p className="shrink-0 text-sm font-semibold">{currency.format(transaction.amount)}</p>
    </div>
  );
}

function QuickAdd({ onClose, onSave }) {
  const [movementType, setMovementType] = useState('expense');
  const today = new Date().toISOString().slice(0, 10);
  const isIncome = movementType === 'income';

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-ink/35 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6">
      <form
        className="w-full rounded-t-lg bg-white p-5 shadow-soft sm:max-w-md sm:rounded-lg sm:p-6"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(new FormData(event.currentTarget));
        }}
      >
        <input type="hidden" name="movementType" value={movementType} />
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-moss">Nuevo movimiento</p>
            <h2 className="text-2xl font-semibold tracking-normal">
              {isIncome ? 'Agregar ingreso' : 'Agregar gasto'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-paper text-ink hover:bg-sage/20"
            aria-label="Cerrar"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </div>

        <div className="mt-6 grid gap-4">
          <div className="grid grid-cols-2 rounded-full bg-paper p-1">
            <button
              type="button"
              onClick={() => setMovementType('expense')}
              className={`h-10 rounded-full text-sm font-semibold transition ${
                !isIncome ? 'bg-ink text-white shadow-sm' : 'text-ink/60 hover:bg-white'
              }`}
            >
              Gasto
            </button>
            <button
              type="button"
              onClick={() => setMovementType('income')}
              className={`h-10 rounded-full text-sm font-semibold transition ${
                isIncome ? 'bg-ink text-white shadow-sm' : 'text-ink/60 hover:bg-white'
              }`}
            >
              Ingreso
            </button>
          </div>
          <label className="grid gap-2 text-sm font-semibold text-ink/65">
            Monto
            <input
              name="amount"
              type="number"
              min="1"
              step="1"
              required
              className="h-12 rounded-lg border border-paper bg-paper px-4 text-ink outline-none transition focus:border-sage focus:bg-white"
              placeholder="450"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-ink/65">
            Descripcion
            <input
              name="description"
              type="text"
              maxLength="100"
              className="h-12 rounded-lg border border-paper bg-paper px-4 text-ink outline-none transition focus:border-sage focus:bg-white"
              placeholder={isIncome ? 'Nomina' : 'Comida'}
            />
          </label>
          {isIncome && (
            <label className="grid gap-2 text-sm font-semibold text-ink/65">
              Fuente
              <input
                name="source"
                type="text"
                maxLength="80"
                className="h-12 rounded-lg border border-paper bg-paper px-4 text-ink outline-none transition focus:border-sage focus:bg-white"
                placeholder="Trabajo, venta, transferencia"
              />
            </label>
          )}
          <div className="grid grid-cols-2 gap-3">
            {!isIncome && (
              <label className="grid gap-2 text-sm font-semibold text-ink/65">
                Categoria
                <select
                  name="category"
                  defaultValue="comida"
                  className="h-12 rounded-lg border border-paper bg-paper px-3 text-ink outline-none transition focus:border-sage focus:bg-white"
                >
                  {Object.entries(categories).map(([key, category]) => (
                    <option key={key} value={key}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="grid gap-2 text-sm font-semibold text-ink/65">
              Fecha
              <input
                name="date"
                type="date"
                defaultValue={today}
                required
                className="h-12 rounded-lg border border-paper bg-paper px-3 text-ink outline-none transition focus:border-sage focus:bg-white"
              />
            </label>
          </div>
        </div>

        <button
          type="submit"
          className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white transition hover:bg-moss"
        >
          <Sparkles aria-hidden="true" size={18} />
          Guardar
        </button>
      </form>
    </div>
  );
}

export default App;
