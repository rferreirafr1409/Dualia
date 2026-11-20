-- DUA-151 : date et heure de fin des événements de l'agenda.
-- Colonne facultative : un événement sans fin reste un événement ponctuel.
-- À passer en préprod, puis en prod, avant de publier le build qui l'utilise
-- (l'app reste compatible sans elle : la fin n'est envoyée que si elle existe).
alter table public.evenements_calendrier
  add column if not exists date_fin timestamptz;

alter table public.evenements_calendrier
  drop constraint if exists evenements_calendrier_fin_apres_debut;
alter table public.evenements_calendrier
  add constraint evenements_calendrier_fin_apres_debut
  check (date_fin is null or date_fin >= date);
