-- DUA-088 : un compte sans ligne parents ni acces tiers recevait 429
-- « plafond atteint » sur tous les endpoints IA, alors que le plafond n'y
-- etait pour rien. consommer_quota rend un booleen et ne peut pas distinguer
-- les deux cas ; cette v2 rend un texte : 'ok', 'plafond' ou 'non_membre'.
-- lib/garde.cjs (dualia-backend) l'appelle en priorite et retombe sur la v1
-- si elle manque, pour que l'ordre de deploiement soit sans importance.
--
-- Reservee a la cle de service : la verification se fait dans le corps
-- (auth.role()), ce qui evite de toucher aux droits d'execution.

create or replace function public.consommer_quota_v2(p_user uuid, p_endpoint text, p_plafond integer)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appels integer;
  v_membre boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'reserve_au_service';
  end if;

  select exists (
    select 1 from public.parents where user_id = p_user
    union all
    select 1 from public.tiers where user_id = p_user and revoque_le is null
  ) into v_membre;

  if not v_membre then
    insert into public.quotas_api (user_id, jour, endpoint, appels)
    values (p_user, current_date, 'refus-non-membre', 1)
    on conflict (user_id, jour, endpoint)
    do update set appels = public.quotas_api.appels + 1;
    return 'non_membre';
  end if;

  insert into public.quotas_api (user_id, jour, endpoint, appels)
  values (p_user, current_date, p_endpoint, 1)
  on conflict (user_id, jour, endpoint)
  do update set appels = public.quotas_api.appels + 1
  returning appels into v_appels;

  return case when v_appels <= p_plafond then 'ok' else 'plafond' end;
end;
$$;
