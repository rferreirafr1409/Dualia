-- Horodatage qualifié eIDAS des décisions (DUA-069).
--
-- Le backend (dualia-backend, /api/horodater-decision) demande à Certigna un
-- jeton d'horodatage RFC 3161 sur l'empreinte SHA-256 de la décision, et le
-- conserve ici : c'est ce jeton, avec l'empreinte, qui prouve devant un avocat
-- ou un juge que le texte existait à cette date et n'a pas été modifié.
--
--   horodatage_jeton        le jeton (.tsr, DER) encodé en base64
--   horodatage_fournisseur  'certigna' ; NULL quand la date vient de
--                           l'application elle-même (repli sans valeur probante)
--
-- Les colonnes existantes gardent leur rôle : horodatage_eidas porte la date
-- du jeton, signature_token l'empreinte (« sha256:… »).
--
-- À passer dans l'éditeur SQL de Supabase, sur la pré-prod puis sur la prod.
-- Idempotent : peut être rejoué sans effet.

alter table public.decisions
  add column if not exists horodatage_jeton text,
  add column if not exists horodatage_fournisseur text;

comment on column public.decisions.horodatage_jeton is
  'Jeton d''horodatage qualifié RFC 3161 (DER en base64), écrit par le backend.';
comment on column public.decisions.horodatage_fournisseur is
  'Prestataire qualifié qui a délivré le jeton (certigna) ; NULL = date locale sans valeur probante.';
