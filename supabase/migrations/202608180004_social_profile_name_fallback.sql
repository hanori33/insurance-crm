-- Keep existing profile creation behavior, but support OAuth metadata fallbacks.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.profiles (
    user_id,
    name,
    role,
    status
  )
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'display_name', ''),
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      new.email,
      ''
    ),
    'staff',
    'active'
  );

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
