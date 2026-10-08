-- Personnalisation de l'accueil refusee pour tout compte recent (DUA-097).
--
-- La politique comparait home_widgets_config.parent_id a auth.uid(). Or
-- parent_id pointe vers parents.id, qui est distinct de l'identifiant du
-- compte depuis que creer_famille genere un id propre (c'est ce qui permet
-- a un meme compte d'avoir plusieurs espaces). Les anciens comptes, pour qui
-- les deux identifiants coincidaient, passaient ; tout compte cree depuis
-- recevait un 403 a la premiere ouverture de l'accueil, et ses reglages
-- n'etaient jamais enregistres. Vu dans les journaux Supabase le 8 oct. 2026.
--
-- La nouvelle condition accepte les deux cas : la fiche parent du compte,
-- quel que soit son id.

alter policy "Un parent gère sa propre config de widgets" on public.home_widgets_config
  using (parent_id in (select id from public.parents where user_id = (select auth.uid())))
  with check (parent_id in (select id from public.parents where user_id = (select auth.uid())));
