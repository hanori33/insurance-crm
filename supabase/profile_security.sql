begin;

-- Run as the caller so direct authenticated updates can be distinguished from
-- trusted SECURITY DEFINER RPCs and service-role operations.
create or replace function public.protect_profile_privileged_fields()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if current_user in ('anon', 'authenticated') and (
    new.role is distinct from old.role
    or new.branch_id is distinct from old.branch_id
    or new.parent_user_id is distinct from old.parent_user_id
    or new.role_name is distinct from old.role_name
    or new.fax_credit is distinct from old.fax_credit
    or new.pro_plan is distinct from old.pro_plan
    or new.pro_expire_at is distinct from old.pro_expire_at
    or new.trial_used is distinct from old.trial_used
    or new.pro_trial_start is distinct from old.pro_trial_start
    or new.pro_trial_end is distinct from old.pro_trial_end
  ) then
    raise exception using
      errcode = '42501',
      message = 'Privileged profile fields cannot be changed directly.';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_profile_privileged_fields() from public, anon, authenticated;

drop trigger if exists protect_profile_privileged_fields_trigger on public.profiles;

create trigger protect_profile_privileged_fields_trigger
before update on public.profiles
for each row
execute function public.protect_profile_privileged_fields();

create or replace function public.activate_free_trial()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_profile public.profiles%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required.';
  end if;

  select *
    into v_profile
    from public.profiles
   where user_id = v_user_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Profile not found.';
  end if;

  if not coalesce(v_profile.trial_used, false) and v_profile.pro_trial_end is null then
    update public.profiles
       set trial_used = true,
           pro_trial_start = v_now,
           pro_trial_end = v_now + interval '14 days',
           fax_credit = greatest(coalesce(fax_credit, 0), 20)
     where user_id = v_user_id
     returning * into v_profile;
  end if;

  return jsonb_build_object(
    'pro_plan', v_profile.pro_plan,
    'pro_expire_at', v_profile.pro_expire_at,
    'fax_credit', v_profile.fax_credit,
    'trial_used', v_profile.trial_used,
    'pro_trial_start', v_profile.pro_trial_start,
    'pro_trial_end', v_profile.pro_trial_end
  );
end;
$$;

revoke all on function public.activate_free_trial() from public, anon;
grant execute on function public.activate_free_trial() to authenticated;

commit;
