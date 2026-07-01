-- Execute no Supabase: SQL Editor → New query → Run
-- Kanban HUB SENAI — tabela de leads

create table if not exists public.hub_leads (
  id text primary key,
  stage text not null default 'mapeamento',
  pillar text not null default 'emp',
  org text not null default '',
  segment text not null default '',
  decisor_nome text not null default '',
  decisor_cargo text not null default '',
  contato text not null default '',
  whatsapp text not null default '',
  dor text not null default '',
  fit jsonb not null default '[]'::jsonb,
  responsaveis jsonb not null default '[]'::jsonb,
  canal text not null default 'E-mail',
  prox_contato text not null default '',
  data_visita text not null default '',
  objecoes text not null default '',
  relatorio_dores text not null default '',
  decisor_final_nome text not null default '',
  decisor_final_cargo text not null default '',
  decisor_final_contato text not null default '',
  proximo_passo text not null default '',
  visita_realizada boolean not null default false,
  briefing_enviado boolean not null default false,
  data_entrada_handoff text not null default '',
  checks jsonb not null default '{}'::jsonb,
  created_at date not null default current_date,
  updated_at timestamptz not null default now()
);

-- Migração para tabelas já existentes (idempotente): adiciona as colunas novas se faltarem.
alter table public.hub_leads add column if not exists whatsapp text not null default '';
alter table public.hub_leads add column if not exists decisor_final_nome text not null default '';
alter table public.hub_leads add column if not exists decisor_final_cargo text not null default '';
alter table public.hub_leads add column if not exists decisor_final_contato text not null default '';
alter table public.hub_leads add column if not exists proximo_passo text not null default '';
alter table public.hub_leads add column if not exists visita_realizada boolean not null default false;

create index if not exists hub_leads_stage_idx on public.hub_leads (stage);
create index if not exists hub_leads_pillar_idx on public.hub_leads (pillar);

create or replace function public.hub_leads_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists hub_leads_updated_at on public.hub_leads;
create trigger hub_leads_updated_at
  before update on public.hub_leads
  for each row execute function public.hub_leads_set_updated_at();

alter table public.hub_leads enable row level security;

-- Políticas abertas para anon (time interno com anon key).
-- Em produção: troque por políticas com auth.uid() após ativar Supabase Auth.
drop policy if exists "hub_leads_select" on public.hub_leads;
drop policy if exists "hub_leads_insert" on public.hub_leads;
drop policy if exists "hub_leads_update" on public.hub_leads;
drop policy if exists "hub_leads_delete" on public.hub_leads;

create policy "hub_leads_select"
  on public.hub_leads for select to anon, authenticated using (true);

create policy "hub_leads_insert"
  on public.hub_leads for insert to anon, authenticated with check (true);

create policy "hub_leads_update"
  on public.hub_leads for update to anon, authenticated using (true) with check (true);

create policy "hub_leads_delete"
  on public.hub_leads for delete to anon, authenticated using (true);
