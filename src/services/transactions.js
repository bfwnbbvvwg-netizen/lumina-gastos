import { supabase } from '../lib/supabase';

const categoryDefaults = {
  comida: { name: 'Comida', icon_name: 'utensils', color_hex: '#c86f5f' },
  hogar: { name: 'Hogar', icon_name: 'home', color_hex: '#7d9d8c' },
  cafe: { name: 'Cafe', icon_name: 'coffee', color_hex: '#d5a83f' },
  compras: { name: 'Compras', icon_name: 'shopping-bag', color_hex: '#6d99b8' },
  servicios: { name: 'Servicios', icon_name: 'wallet-cards', color_hex: '#536f55' },
};

export function isSupabaseReady() {
  return Boolean(supabase);
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

function toAppTransaction(row) {
  return {
    id: row.id,
    amount: Number(row.amount),
    description: row.description || 'Gasto rapido',
    date: row.transaction_date,
    category: row.categories?.category_key || 'comida',
  };
}

async function ensureCategory(userId, categoryKey) {
  const { data: existing, error: selectError } = await supabase
    .from('categories')
    .select('id')
    .eq('user_id', userId)
    .eq('category_key', categoryKey)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return existing.id;

  const fallback = categoryDefaults[categoryKey] || categoryDefaults.comida;
  const { data: created, error: insertError } = await supabase
    .from('categories')
    .insert({
      user_id: userId,
      category_key: categoryKey,
      name: fallback.name,
      icon_name: fallback.icon_name,
      color_hex: fallback.color_hex,
      is_default: true,
    })
    .select('id')
    .single();

  if (insertError) throw insertError;
  return created.id;
}

export async function listTransactions() {
  if (!supabase) return { mode: 'demo', transactions: [] };

  const user = await getCurrentUser();
  if (!user) return { mode: 'needs-auth', transactions: [] };

  const { data, error } = await supabase
    .from('transactions')
    .select('id, amount, description, transaction_date, categories(category_key)')
    .eq('user_id', user.id)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;

  return {
    mode: 'supabase',
    transactions: data.map(toAppTransaction),
  };
}

export async function saveTransaction(transaction) {
  if (!supabase) return { mode: 'demo', transaction };

  const user = await getCurrentUser();
  if (!user) return { mode: 'needs-auth', transaction: null };

  const categoryId = await ensureCategory(user.id, transaction.category);
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: user.id,
      category_id: categoryId,
      amount: transaction.amount,
      description: transaction.description,
      transaction_date: transaction.date,
    })
    .select('id, amount, description, transaction_date, categories(category_key)')
    .single();

  if (error) throw error;

  return {
    mode: 'supabase',
    transaction: toAppTransaction(data),
  };
}
