-- DUA-156 : un e-mail à contact@dualia.app à chaque retour envoyé depuis
-- l'application (bouton « Donner mon avis »).
--
-- À chaque nouvelle ligne de public.retours_beta, Supabase appelle le backend
-- (/api/notifier-retour, dépôt dualia-backend) avec l'id du retour ; le
-- backend relit le retour et envoie l'e-mail. notifie_le garantit un seul
-- e-mail par retour.
--
-- PROD : coller tel quel. PRÉPROD : remplacer l'adresse du backend par
-- https://dualia-backend-preprod.vercel.app/api/notifier-retour
-- Prérequis : SMTP_USER et SMTP_PASSWORD dans les variables Vercel du backend.

create extension if not exists pg_net with schema extensions;

alter table public.retours_beta
  add column if not exists notifie_le timestamptz;

-- Les retours déjà reçus sont considérés comme vus : pas d'e-mail pour eux.
update public.retours_beta set notifie_le = created_at where notifie_le is null;

create or replace function public.notifier_nouveau_retour()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  begin
    perform net.http_post(
      url := 'https://dualia-backend.vercel.app/api/notifier-retour',
      body := jsonb_build_object('id', new.id),
      headers := jsonb_build_object('Content-Type', 'application/json')
    );
  exception when others then
    -- Jamais de retour perdu à cause de la notification.
    raise warning 'notifier_nouveau_retour : %', sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists retours_beta_notifier on public.retours_beta;
create trigger retours_beta_notifier
  after insert on public.retours_beta
  for each row execute function public.notifier_nouveau_retour();
