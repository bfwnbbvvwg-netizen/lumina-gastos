create table if not exists public.incomes (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  amount numeric(10, 2) not null check (amount > 0),
  description varchar(100),
  source varchar(80),
  income_date date not null default current_date,
  created_at timestamptz default timezone('utc', now())
);

alter table public.incomes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'incomes'
      and policyname = 'Incomes are private'
  ) then
    create policy "Incomes are private"
      on public.incomes for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, monthly_budget, currency)
  values (new.id, 0.00, 'MXN')
  on conflict (id) do nothing;

  insert into public.categories (user_id, category_key, name, icon_name, color_hex, is_default)
  values
    (new.id, 'comida', 'Comida', 'utensils', '#c86f5f', true),
    (new.id, 'hogar', 'Hogar', 'home', '#7d9d8c', true),
    (new.id, 'cafe', 'Cafe', 'coffee', '#d5a83f', true),
    (new.id, 'compras', 'Compras', 'shopping-bag', '#6d99b8', true),
    (new.id, 'servicios', 'Servicios', 'wallet-cards', '#536f55', true)
  on conflict (user_id, category_key) do nothing;

  return new;
end;
$$;

create or replace function public.enqueue_budget_80_alert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  month_start date := date_trunc('month', new.transaction_date)::date;
  monthly_spent numeric(10, 2);
  income_total numeric(10, 2);
  budget numeric(10, 2);
  already_sent date;
begin
  select alert_80_sent_month
  into already_sent
  from public.profiles
  where id = new.user_id;

  select coalesce(sum(amount), 0)
  into income_total
  from public.incomes
  where user_id = new.user_id
    and income_date >= month_start
    and income_date < (month_start + interval '1 month');

  budget := coalesce(income_total, 0);

  if budget <= 0 then
    return new;
  end if;

  if already_sent = month_start then
    return new;
  end if;

  select coalesce(sum(amount), 0)
  into monthly_spent
  from public.transactions
  where user_id = new.user_id
    and transaction_date >= month_start
    and transaction_date < (month_start + interval '1 month');

  if monthly_spent >= budget * 0.8 then
    insert into public.alerts (user_id, transaction_id, alert_type, title, body)
    values (
      new.user_id,
      new.id,
      'budget_80',
      'Presupuesto en zona sensible',
      'Ya consumiste al menos 80% de tus ingresos registrados este mes.'
    );

    update public.profiles
    set alert_80_sent_month = month_start
    where id = new.user_id;
  end if;

  return new;
end;
$$;

create or replace view public.monthly_income as
select
  user_id,
  date_trunc('month', income_date)::date as month,
  sum(amount)::numeric(10, 2) as income
from public.incomes
group by user_id, date_trunc('month', income_date)::date;

create or replace view public.monthly_cashflow as
select
  coalesce(i.user_id, s.user_id) as user_id,
  coalesce(i.month, s.month) as month,
  coalesce(i.income, 0)::numeric(10, 2) as income,
  coalesce(s.spent, 0)::numeric(10, 2) as spent,
  (coalesce(i.income, 0) - coalesce(s.spent, 0))::numeric(10, 2) as balance
from public.monthly_income i
full outer join public.monthly_spending s
  on i.user_id = s.user_id
 and i.month = s.month;
