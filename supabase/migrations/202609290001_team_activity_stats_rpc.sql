begin;

create or replace function public.get_managed_team_activity_stats(
  p_org_unit_id uuid default null
)
returns table (
  member_user_id uuid,
  profile_id uuid,
  display_name text,
  photo_url text,
  profile_status text,
  last_seen timestamptz,
  org_unit_id uuid,
  org_unit_name text,
  membership_role text,
  consultation_count bigint,
  schedule_count bigint,
  customer_count bigint,
  activity_points bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  kst_today date := (current_timestamp at time zone 'Asia/Seoul')::date;
  day_start timestamptz;
  day_end timestamptz;
begin
  if caller_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.organization_memberships manager_membership
    join public.organization_units manager_unit
      on manager_unit.id = manager_membership.org_unit_id
     and manager_unit.is_active = true
    where manager_membership.user_id = caller_id
      and manager_membership.status = 'active'
      and manager_membership.role in ('owner', 'org_admin', 'manager', 'team_leader')
  ) then
    raise exception 'TEAM_STATS_FORBIDDEN' using errcode = '42501';
  end if;

  if p_org_unit_id is not null then
    if not exists (
      select 1
      from public.organization_units target_unit
      join public.organization_memberships manager_membership
        on manager_membership.user_id = caller_id
       and manager_membership.status = 'active'
       and manager_membership.role in ('owner', 'org_admin', 'manager', 'team_leader')
       and manager_membership.org_unit_id = any(target_unit.path)
      join public.organization_units manager_unit
        on manager_unit.id = manager_membership.org_unit_id
       and manager_unit.is_active = true
      where target_unit.id = p_org_unit_id
        and target_unit.is_active = true
    ) then
      raise exception 'ORG_UNIT_NOT_MANAGED' using errcode = '42501';
    end if;
  end if;

  day_start := kst_today::timestamp at time zone 'Asia/Seoul';
  day_end := (kst_today + 1)::timestamp at time zone 'Asia/Seoul';

  return query
  with managed_roots as (
    select distinct manager_membership.org_unit_id
    from public.organization_memberships manager_membership
    join public.organization_units manager_unit
      on manager_unit.id = manager_membership.org_unit_id
     and manager_unit.is_active = true
    where manager_membership.user_id = caller_id
      and manager_membership.status = 'active'
      and manager_membership.role in ('owner', 'org_admin', 'manager', 'team_leader')
  ),
  scoped_members as (
    select distinct on (membership.user_id)
      membership.user_id,
      membership.org_unit_id,
      member_unit.name as org_unit_name,
      membership.role as membership_role,
      member_unit.depth
    from public.organization_memberships membership
    join public.organization_units member_unit
      on member_unit.id = membership.org_unit_id
     and member_unit.is_active = true
    where membership.status = 'active'
      and (
        (p_org_unit_id is not null and p_org_unit_id = any(member_unit.path))
        or
        (p_org_unit_id is null and exists (
          select 1
          from managed_roots root
          where root.org_unit_id = any(member_unit.path)
        ))
      )
    order by membership.user_id, member_unit.depth desc, membership.created_at asc
  ),
  consultation_counts as (
    select consultation.user_id, count(*)::bigint as count
    from public.consultations consultation
    join scoped_members member on member.user_id = consultation.user_id
    where consultation.created_at >= day_start
      and consultation.created_at < day_end
    group by consultation.user_id
  ),
  scheduled_at_counts as (
    select schedule.user_id, count(*)::bigint as count
    from public.schedules schedule
    join scoped_members member on member.user_id = schedule.user_id
    where schedule.scheduled_at >= day_start
      and schedule.scheduled_at < day_end
    group by schedule.user_id
  ),
  schedule_counts as (
    select user_id, count
    from scheduled_at_counts
    union all
    select schedule.user_id, count(*)::bigint
    from public.schedules schedule
    join scoped_members member on member.user_id = schedule.user_id
    where not exists (select 1 from scheduled_at_counts)
      and schedule.date = to_char(kst_today, 'YYYY-MM-DD')
    group by schedule.user_id
  ),
  customer_counts as (
    select customer.user_id, count(*)::bigint as count
    from public.customers customer
    join scoped_members member on member.user_id = customer.user_id
    where customer.created_at >= day_start
      and customer.created_at < day_end
    group by customer.user_id
  )
  select
    member.user_id,
    profile.id,
    coalesce(nullif(profile.name, ''), '이름없음'),
    coalesce(profile.photo_url, ''),
    coalesce(profile.status, ''),
    profile.last_seen,
    member.org_unit_id,
    member.org_unit_name,
    member.membership_role,
    coalesce(consultation_count.count, 0),
    coalesce(schedule_count.count, 0),
    coalesce(customer_count.count, 0),
    coalesce(consultation_count.count, 0) * 5
      + coalesce(schedule_count.count, 0) * 3
      + coalesce(customer_count.count, 0) * 10
  from scoped_members member
  left join public.profiles profile on profile.user_id = member.user_id
  left join consultation_counts consultation_count on consultation_count.user_id = member.user_id
  left join schedule_counts schedule_count on schedule_count.user_id = member.user_id
  left join customer_counts customer_count on customer_count.user_id = member.user_id
  order by 13 desc, 3 asc, 1;
end;
$$;

revoke all on function public.get_managed_team_activity_stats(uuid) from public;
revoke all on function public.get_managed_team_activity_stats(uuid) from anon;
revoke all on function public.get_managed_team_activity_stats(uuid) from authenticated;
grant execute on function public.get_managed_team_activity_stats(uuid) to authenticated;

comment on function public.get_managed_team_activity_stats(uuid) is
  'Returns KST-today aggregate activity for active members in organization units managed by auth.uid().';

commit;
