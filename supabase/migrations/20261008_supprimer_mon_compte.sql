-- Suppression de compte depuis l'application (DUA-089).
--
-- Apple refuse toute application qui permet de creer un compte sans permettre
-- de le supprimer depuis l'application elle-meme. Et le RGPD donne de toute
-- facon ce droit a chaque parent.
--
-- Ce que fait la fonction, pour le compte connecte (auth.uid()) :
--
--   * Dans chaque espace familial ou l'autre parent est encore la, le parent
--     qui part est detache : sa fiche disparait, et ce qu'il avait saisi
--     (depenses, messages, decisions, evenements) reste a la disposition de
--     l'autre parent, sans auteur. Supprimer ces donnees priverait le
--     co-parent de l'historique des depenses et des decisions, qui est
--     precisement ce que Dualia lui promet de conserver.
--
--   * Dans chaque espace ou il etait seul, tout l'espace est supprime :
--     personne d'autre ne peut plus y acceder.
--
--   * Ses acces tiers (nounou, grand-parent) sont supprimes.
--
--   * Le compte lui-meme est supprime de auth.users, ce qui entraine les
--     identites, sessions et facteurs de double authentification.
--
-- Les fichiers (photos, documents) des espaces supprimes sont retires par
-- l'application AVANT l'appel, via l'API de stockage : Supabase interdit
-- toute suppression directe dans storage.objects depuis SQL.
--
-- Les fonctions existantes comptent les parents (creer_invitation,
-- repondre_demande, mon_invitation_en_cours) : on supprime donc la fiche du
-- parent plutot que de l'anonymiser, sinon l'espace resterait « complet » et
-- le parent restant ne pourrait plus jamais inviter quelqu'un.

create or replace function public.supprimer_mon_compte()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_p record;
begin
  if v_uid is null then
    raise exception 'session_requise';
  end if;

  for v_p in select id, famille_id from parents where user_id = v_uid loop
    if exists (select 1 from parents where famille_id = v_p.famille_id and id <> v_p.id) then
      -- L'autre parent reste : on detache, on ne supprime pas ses donnees.
      update decisions                set auteur_id    = null where auteur_id    = v_p.id;
      update depenses                 set auteur_id    = null where auteur_id    = v_p.id;
      update documents                set auteur_id    = null where auteur_id    = v_p.id;
      update journal_entries          set auteur_id    = null where auteur_id    = v_p.id;
      update evenements_calendrier    set parent_id    = null where parent_id    = v_p.id;
      update evenements_garde         set parent_id    = null where parent_id    = v_p.id;
      update messages                 set expediteur_id = null where expediteur_id = v_p.id;
      update propositions_repartition set confirme_par = null where confirme_par = v_p.id;
      update regles_partage           set valide_par   = null where valide_par   = v_p.id;
      update tiers                    set invite_par   = null where invite_par   = v_p.id;
      -- foyer_personnes, home_widgets_config, calendriers_externes et
      -- evenements_externes suivent en cascade.
      delete from parents where id = v_p.id;
    else
      -- Seul dans l'espace : l'espace entier disparait. L'ordre respecte les
      -- cles etrangeres declarees sans cascade.
      delete from propositions_repartition where famille_id = v_p.famille_id;
      delete from regles_partage
       where cadre_familial_id in (select id from cadre_familial where famille_id = v_p.famille_id);
      delete from cadre_familial       where famille_id = v_p.famille_id;
      delete from evenements_calendrier where famille_id = v_p.famille_id;
      delete from messages             where famille_id = v_p.famille_id;
      delete from decisions            where famille_id = v_p.famille_id;
      delete from depenses             where famille_id = v_p.famille_id;
      delete from documents            where famille_id = v_p.famille_id;
      delete from journal_entries      where famille_id = v_p.famille_id;
      delete from evenements_garde     where famille_id = v_p.famille_id;
      delete from invitations          where famille_id = v_p.famille_id;
      delete from enfants              where famille_id = v_p.famille_id;
      delete from parents              where famille_id = v_p.famille_id;
      -- Les fichiers ont ete retires par l'application avant l'appel. Pas de
      -- menage ici : Supabase refuse toute suppression directe dans
      -- storage.objects (« Direct deletion from storage tables is not
      -- allowed »), et c'est cette ligne qui faisait echouer la premiere
      -- version sur l'iPhone.
      -- Le reste (foyers, tiers, moments, agenda, echeances, transmission...)
      -- suit en cascade.
      delete from familles where id = v_p.famille_id;
    end if;
  end loop;

  delete from tiers where user_id = v_uid;
  update agenda_scolaire set auteur_id = null where auteur_id = v_uid;
  update retours_beta    set user_id   = null where user_id   = v_uid;
  update invitations
     set demandeur_user_id = null, demandeur_nom = null, demandeur_email = null
   where demandeur_user_id = v_uid;

  -- Identites, sessions, jetons et facteurs MFA suivent en cascade.
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.supprimer_mon_compte() from public, anon;
grant execute on function public.supprimer_mon_compte() to authenticated;
