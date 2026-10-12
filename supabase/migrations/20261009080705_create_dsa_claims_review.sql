create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references auth.users (id) on delete cascade,
  claimant_name text not null,
  claimant_email text not null,
  claim_month text not null,
  claim_year smallint not null check (claim_year between 2000 and 2200),
  nights_chamber integer not null default 0 check (nights_chamber >= 0),
  nights_committee integer not null default 0 check (nights_committee >= 0),
  status text not null default 'secretary_review'
    check (status in ('secretary_review', 'approved', 'rejected')),
  declaration_signed_name text not null,
  declaration_confirmed boolean not null default false
    check (declaration_confirmed),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint claims_review_fields_match_status check (
    (status = 'secretary_review' and reviewed_by is null and reviewed_at is null)
    or
    (status in ('approved', 'rejected') and reviewed_by is not null and reviewed_at is not null)
  )
);

create table if not exists public.claim_weeks (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims (id) on delete cascade,
  week_number integer not null check (week_number > 0),
  week_starting date not null,
  week_ending date not null,
  attended_chamber boolean not null default false,
  attended_committee boolean not null default false,
  committees jsonb not null default '[]'::jsonb
    check (jsonb_typeof(committees) = 'array'),
  constraint claim_weeks_dates_valid check (week_ending >= week_starting),
  constraint claim_weeks_attendance_present check (
    attended_chamber or attended_committee
  ),
  constraint claim_weeks_claim_week_unique unique (claim_id, week_number)
);

alter table public.claims
  add column if not exists claimant_name text not null default 'Member',
  add column if not exists claimant_email text not null default '',
  add column if not exists reviewed_by uuid,
  add column if not exists reviewed_at timestamptz,
  add column if not exists created_at timestamptz not null default now();

alter table public.claim_weeks
  add column if not exists committees jsonb not null default '[]'::jsonb;

alter table public.claims
  alter column status set default 'secretary_review';

update public.claims as claim
set
  claimant_name = coalesce(
    nullif(auth_user.raw_user_meta_data ->> 'full_name', ''),
    'Member'
  ),
  claimant_email = coalesce(auth_user.email, '')
from auth.users as auth_user
where auth_user.id = claim.member_id
  and (claim.claimant_name = 'Member' or claim.claimant_email = '');

create or replace function public.require_claim_weeks()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.claim_weeks
    where claim_id = new.id
  ) then
    raise exception 'A submitted claim must include at least one week'
      using errcode = '23514';
  end if;

  return null;
end;
$$;

revoke all on function public.require_claim_weeks() from public, anon, authenticated;

drop trigger if exists claims_require_weeks on public.claims;
create constraint trigger claims_require_weeks
  after insert on public.claims
  deferrable initially deferred
  for each row
  execute function public.require_claim_weeks();

create index if not exists claims_member_created_at_idx
  on public.claims (member_id, created_at desc);

create index if not exists claims_review_queue_idx
  on public.claims (created_at desc)
  where status = 'secretary_review';

create index if not exists claim_weeks_claim_id_idx
  on public.claim_weeks (claim_id);

alter table public.claims enable row level security;
alter table public.claim_weeks enable row level security;

revoke all on table public.claims, public.claim_weeks from anon, authenticated;

grant select on table public.claims, public.claim_weeks to authenticated;
grant insert (
  member_id,
  claimant_name,
  claimant_email,
  claim_month,
  claim_year,
  nights_chamber,
  nights_committee,
  declaration_signed_name,
  declaration_confirmed
) on table public.claims to authenticated;
grant insert (
  claim_id,
  week_number,
  week_starting,
  week_ending,
  attended_chamber,
  attended_committee,
  committees
) on table public.claim_weeks to authenticated;
grant update (status, reviewed_by, reviewed_at)
  on table public.claims to authenticated;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('claims', 'claim_weeks')
  loop
    execute format(
      'drop policy %I on %I.%I',
      existing_policy.policyname,
      existing_policy.schemaname,
      existing_policy.tablename
    );
  end loop;
end;
$$;

drop policy if exists "Members and secretaries can read claims"
  on public.claims;
create policy "Members and secretaries can read claims"
  on public.claims
  for select
  to authenticated
  using (
    member_id = (select auth.uid())
    or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'secretary'
  );

drop policy if exists "Members can submit their own claims"
  on public.claims;
create policy "Members can submit their own claims"
  on public.claims
  for insert
  to authenticated
  with check (
    member_id = (select auth.uid())
    and status = 'secretary_review'
    and declaration_confirmed
    and reviewed_by is null
    and reviewed_at is null
    and coalesce(
      (select auth.jwt() -> 'app_metadata' ->> 'role'),
      'member'
    ) = 'member'
  );

drop policy if exists "Secretaries can review pending claims"
  on public.claims;
create policy "Secretaries can review pending claims"
  on public.claims
  for update
  to authenticated
  using (
    status = 'secretary_review'
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'secretary'
  )
  with check (
    status in ('approved', 'rejected')
    and reviewed_by = (select auth.uid())
    and reviewed_at is not null
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'secretary'
  );

drop policy if exists "Members and secretaries can read claim weeks"
  on public.claim_weeks;
create policy "Members and secretaries can read claim weeks"
  on public.claim_weeks
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.claims as claim
      where claim.id = claim_weeks.claim_id
        and (
          claim.member_id = (select auth.uid())
          or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'secretary'
        )
    )
  );

drop policy if exists "Members can add weeks to their pending claims"
  on public.claim_weeks;
create policy "Members can add weeks to their pending claims"
  on public.claim_weeks
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.claims as claim
      where claim.id = claim_weeks.claim_id
        and claim.member_id = (select auth.uid())
        and claim.status = 'secretary_review'
        and claim.created_at = (select transaction_timestamp())
    )
  );