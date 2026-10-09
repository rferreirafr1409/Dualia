-- DUA-102 : signalement d'un message par un parent (exigence Apple 1.2,
-- contenu genere par les utilisateurs).
-- DUA-103 : consentement explicite aux donnees de sante (RGPD art. 9,
-- promis par la politique de confidentialite, section 3).
--
-- Aucune cle etrangere volontairement : ce journal survit a l'effacement
-- d'un message ou d'un espace, et il ne bloque jamais supprimer_mon_compte().

alter table public.parents add column if not exists consentement_sante_at timestamptz;
grant update (consentement_sante_at) on public.parents to authenticated;

create table if not exists public.signalements_messages (
  id          uuid primary key default gen_random_uuid(),
  famille_id  uuid not null,
  message_id  uuid,
  signale_par uuid not null,
  motif       text not null,
  extrait     text,
  created_at  timestamptz not null default now()
);

alter table public.signalements_messages enable row level security;

create policy "Un parent signale un message de sa famille"
  on public.signalements_messages for insert to authenticated
  with check (
    famille_id in (select mes_familles_id())
    and signale_par in (select id from public.parents where user_id = (select auth.uid()))
  );

create policy "Un parent relit ses propres signalements"
  on public.signalements_messages for select to authenticated
  using (signale_par in (select id from public.parents where user_id = (select auth.uid())));

grant select, insert on public.signalements_messages to authenticated;
