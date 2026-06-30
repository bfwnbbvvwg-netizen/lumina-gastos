import { supabase } from '../lib/supabase';

function toAppIncome(row) {
  return {
    id: row.id,
    amount: Number(row.amount),
    description: row.description || 'Ingreso',
    date: row.income_date,
    source: row.source || '',
  };
}

async function getCurrentUser() {
  if (!supabase) return null;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  return user;
}

export async function listIncomes() {
  if (!supabase) return { mode: 'demo', incomes: [] };

  const user = await getCurrentUser();
  if (!user) return { mode: 'needs-auth', incomes: [] };

  const { data, error } = await supabase
    .from('incomes')
    .select('id, amount, description, source, income_date, created_at')
    .eq('user_id', user.id)
    .order('income_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;

  return {
    mode: 'supabase',
    incomes: data.map(toAppIncome),
  };
}

export async function saveIncome(income) {
  if (!supabase) return { mode: 'demo', income };

  const user = await getCurrentUser();
  if (!user) return { mode: 'needs-auth', income: null };

  const { data, error } = await supabase
    .from('incomes')
    .insert({
      user_id: user.id,
      amount: income.amount,
      description: income.description,
      source: income.source,
      income_date: income.date,
    })
    .select('id, amount, description, source, income_date')
    .single();

  if (error) throw error;

  return {
    mode: 'supabase',
    income: toAppIncome(data),
  };
}
