begin;

alter table public.role_requests
  add column if not exists company_name text;

comment on column public.role_requests.company_name is
  '권한 신청자가 입력한 소속 회사명';

commit;
