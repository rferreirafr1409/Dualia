-- DUA-148 : enfant concerné par une dépense (retour testeur TestFlight, 3 nov. 2026).
-- Même modèle que les événements du calendrier : l'id pour relier, le prénom
-- pour l'affichage même si l'enfant est supprimé plus tard.
alter table public.depenses
  add column if not exists enfant text,
  add column if not exists enfant_id uuid references public.enfants(id) on delete set null;

comment on column public.depenses.enfant is 'Prénom de l''enfant concerné (optionnel, affichage).';
comment on column public.depenses.enfant_id is 'Enfant concerné par la dépense (optionnel). Null = toute la famille.';
