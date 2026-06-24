import { supabase } from '../lib/supabase';

function toAppRecurringExpense(row) {
  return {
    id: row.id,
    name: row.name,
    amount: Number(row.amount),
    billingDay: row.billing_day,
    category: row.categories?.category_key || 'servicios',
    merchant: row.merchant || '',
    isActive: row.is_active,
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

export async function listRecurringExpenses() {
  if (!supabase) return { mode: 'demo', recurringExpenses: [] };

  const user = await getCurrentUser();
  if (!user) return { mode: 'needs-auth', recurringExpenses: [] };

  const { data, error } = await supabase
    .from('recurring_expenses')
    .select('id, name, amount, billing_day, merchant, is_active, categories(category_key)')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('billing_day', { ascending: true });

  if (error) throw error;

  return {
    mode: 'supabase',
    recurringExpenses: data.map(toAppRecurringExpense),
  };
}
