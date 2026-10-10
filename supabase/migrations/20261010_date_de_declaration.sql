-- DUA-086 : date de déclaration (cree_le) sur les tables qui n'en avaient pas.
--
-- Pour un relevé destiné à un avocat ou un juge, « quand cette dépense
-- a-t-elle été déclarée ? » doit avoir une réponse distincte de la date du
-- ticket. Les lignes existantes reçoivent leur date métier comme meilleure
-- approximation ; les nouvelles reçoivent l'horloge du serveur, que le
-- client ne peut pas falsifier.

alter table public.depenses             add column if not exists cree_le timestamptz;
alter table public.documents            add column if not exists cree_le timestamptz;
alter table public.journal_entries      add column if not exists cree_le timestamptz;
alter table public.evenements_calendrier add column if not exists cree_le timestamptz;
alter table public.evenements_garde     add column if not exists cree_le timestamptz;

update public.depenses             set cree_le = coalesce(date::timestamptz, now()) where cree_le is null;
update public.documents            set cree_le = coalesce(date::timestamptz, now()) where cree_le is null;
update public.journal_entries      set cree_le = coalesce(date::timestamptz, now()) where cree_le is null;
update public.evenements_calendrier set cree_le = coalesce(date::timestamptz, now()) where cree_le is null;
update public.evenements_garde     set cree_le = coalesce(date_debut::timestamptz, now()) where cree_le is null;

alter table public.depenses             alter column cree_le set default now(), alter column cree_le set not null;
alter table public.documents            alter column cree_le set default now(), alter column cree_le set not null;
alter table public.journal_entries      alter column cree_le set default now(), alter column cree_le set not null;
alter table public.evenements_calendrier alter column cree_le set default now(), alter column cree_le set not null;
alter table public.evenements_garde     alter column cree_le set default now(), alter column cree_le set not null;
