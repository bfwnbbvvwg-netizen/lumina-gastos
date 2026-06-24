import { supabase } from '../lib/supabase';

function toAppAlert(row) {
  return {
    id: row.id,
    type: row.alert_type,
    title: row.title,
    body: row.body,
    isRead: row.is_read,
    createdAt: row.created_at,
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

export async function listAlerts() {
  if (!supabase) return { mode: 'demo', alerts: [] };

  const user = await getCurrentUser();
  if (!user) return { mode: 'needs-auth', alerts: [] };

  const { data, error } = await supabase
    .from('alerts')
    .select('id, alert_type, title, body, is_read, created_at')
    .eq('user_id', user.id)
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) throw error;

  return {
    mode: 'supabase',
    alerts: data.map(toAppAlert),
  };
}

export async function markAlertRead(alertId) {
  if (!supabase) return { mode: 'demo' };

  const user = await getCurrentUser();
  if (!user) return { mode: 'needs-auth' };

  const { error } = await supabase
    .from('alerts')
    .update({ is_read: true })
    .eq('id', alertId)
    .eq('user_id', user.id);

  if (error) throw error;

  return { mode: 'supabase' };
}
