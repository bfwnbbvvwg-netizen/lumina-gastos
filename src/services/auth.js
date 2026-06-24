import { supabase } from '../lib/supabase';

function assertSupabase() {
  if (!supabase) {
    throw new Error('Supabase no esta configurado.');
  }
}

export async function signIn(email, password) {
  assertSupabase();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

export async function signUp(email, password) {
  assertSupabase();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

export async function signOut() {
  assertSupabase();

  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  if (!supabase) return null;

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) throw error;
  return session;
}

export function onAuthStateChange(callback) {
  if (!supabase) return { unsubscribe() {} };

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });

  return subscription;
}
