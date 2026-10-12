alter table public.claims
  add column if not exists secretary_reviewed_by uuid,
  add column if not exists secretary_reviewed_at timestamptz;

alter table public.claims
  drop constraint if exists claims_status_check,
  drop constraint if exists claims_review_fields_match_status;

update public.claims
set
  secretary_reviewed_by = reviewed_by,
  secretary_reviewed_at = reviewed_at
where status in ('approved', 'rejected')
  and reviewed_by is not null
  and reviewed_at is not null
  and secretary_reviewed_by is null
  and secretary_reviewed_at is null;

alter table public.claims
  add constraint claims_status_check
    check (status in ('secretary_review', 'director_review', 'approved', 'rejected')),
  add constraint claims_review_fields_match_status check (
    (
      status = 'secretary_review'
      and secretary_reviewed_by is null
      and secretary_reviewed_at is null
      and reviewed_by is null
      and reviewed_at is null
    )
    or (
      status = 'director_review'
      and secretary_reviewed_by is not null
      and secretary_reviewed_at is not null
      and reviewed_by is null
      and reviewed_at is null
    )
    or (
      status in ('approved', 'rejected')
      and (
        (
          secretary_reviewed_by is not null
          and secretary_reviewed_at is not null
          and reviewed_by is not null
          and reviewed_at is not null
        )
        or (
          status = 'rejected'
          and secretary_reviewed_by is not null
          and secretary_reviewed_at is not null
          and reviewed_by is null
          and reviewed_at is null
        )
      )
    )
  );

grant update (status, secretary_reviewed_by, secretary_reviewed_at)
  on table public.claims to authenticated;

drop policy if exists "Members and secretaries can read claims"
  on public.claims;
create policy "Members and reviewers can read claims"
  on public.claims
  for select
  to authenticated
  using (
    member_id = (select auth.uid())
    or (select auth.jwt() -> 'user_metadata' ->> 'role') in ('secretary', 'director')
    or (select auth.jwt() -> 'app_metadata' ->> 'role') in ('secretary', 'director')
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
    and secretary_reviewed_by is null
    and secretary_reviewed_at is null
    and coalesce(
      (select auth.jwt() -> 'user_metadata' ->> 'role'),
      (select auth.jwt() -> 'app_metadata' ->> 'role'),
      'member'
    ) = 'member'
  );

drop policy if exists "Secretaries can review pending claims"
  on public.claims;
create policy "Secretaries can forward or reject claims"
  on public.claims
  for update
  to authenticated
  using (
    status = 'secretary_review'
    and coalesce(
      (select auth.jwt() -> 'user_metadata' ->> 'role'),
      (select auth.jwt() -> 'app_metadata' ->> 'role')
    ) = 'secretary'
  )
  with check (
    status in ('director_review', 'rejected')
    and secretary_reviewed_by = (select auth.uid())
    and secretary_reviewed_at is not null
    and reviewed_by is null
    and reviewed_at is null
    and coalesce(
      (select auth.jwt() -> 'user_metadata' ->> 'role'),
      (select auth.jwt() -> 'app_metadata' ->> 'role')
    ) = 'secretary'
  );

drop policy if exists "Directors can approve or reject forwarded claims"
  on public.claims;
create policy "Directors can approve or reject forwarded claims"
  on public.claims
  for update
  to authenticated
  using (
    status = 'director_review'
    and coalesce(
      (select auth.jwt() -> 'user_metadata' ->> 'role'),
      (select auth.jwt() -> 'app_metadata' ->> 'role')
    ) = 'director'
  )
  with check (
    status in ('approved', 'rejected')
    and secretary_reviewed_by is not null
    and secretary_reviewed_at is not null
    and reviewed_by = (select auth.uid())
    and reviewed_at is not null
    and coalesce(
      (select auth.jwt() -> 'user_metadata' ->> 'role'),
      (select auth.jwt() -> 'app_metadata' ->> 'role')
    ) = 'director'
  );

drop policy if exists "Members and secretaries can read claim weeks"
  on public.claim_weeks;
create policy "Members and reviewers can read claim weeks"
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
          or (select auth.jwt() -> 'user_metadata' ->> 'role')
            in ('secretary', 'director')
          or (select auth.jwt() -> 'app_metadata' ->> 'role')
            in ('secretary', 'director')
        )
    )
  );

create or replace function public.submit_member_claim(
  p_claim_month text,
  p_claim_year smallint,
  p_nights_chamber integer,
  p_nights_committee integer,
  p_declaration_signed_name text,
  p_weeks jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_user_metadata jsonb;
  v_claim_id uuid;
begin
  v_user_id := auth.uid();
  v_user_metadata := auth.jwt() -> 'user_metadata';

  if v_user_id is null then
    raise exception 'Authentication is required to submit a claim'
      using errcode = '28000';
  end if;

  if coalesce(
       auth.jwt() -> 'user_metadata' ->> 'role',
       auth.jwt() -> 'app_metadata' ->> 'role',
       'member'
     ) <> 'member' then
    raise exception 'Only members can submit claims'
      using errcode = '42501';
  end if;

  if nullif(btrim(p_declaration_signed_name), '') is null then
    raise exception 'A signed declaration is required'
      using errcode = '22023';
  end if;

  if jsonb_typeof(p_weeks) is distinct from 'array' then
    raise exception 'Claim weeks must be submitted as an array'
      using errcode = '22023';
  end if;

  if jsonb_array_length(p_weeks) = 0 then
    raise exception 'At least one claim week is required'
      using errcode = '22023';
  end if;

  insert into public.claims (
    member_id,
    claimant_name,
    claimant_email,
    claim_month,
    claim_year,
    nights_chamber,
    nights_committee,
    declaration_signed_name,
    declaration_confirmed
  )
  values (
    v_user_id,
    coalesce(nullif(btrim(v_user_metadata ->> 'full_name'), ''), 'Member'),
    coalesce(auth.jwt() ->> 'email', ''),
    p_claim_month,
    p_claim_year,
    p_nights_chamber,
    p_nights_committee,
    btrim(p_declaration_signed_name),
    true
  )
  returning id into v_claim_id;

  insert into public.claim_weeks (
    claim_id,
    week_number,
    week_starting,
    week_ending,
    attended_chamber,
    attended_committee,
    committees
  )
  select
    v_claim_id,
    submitted_week.week_number,
    submitted_week.week_starting,
    submitted_week.week_ending,
    submitted_week.attended_chamber,
    submitted_week.attended_committee,
    coalesce(submitted_week.committees, '[]'::jsonb)
  from jsonb_to_recordset(p_weeks) as submitted_week (
    week_number integer,
    week_starting date,
    week_ending date,
    attended_chamber boolean,
    attended_committee boolean,
    committees jsonb
  );

  return v_claim_id;
end;
$function$;

revoke all on function public.submit_member_claim(
  text, smallint, integer, integer, text, jsonb
) from public, anon, authenticated;
grant execute on function public.submit_member_claim(
  text, smallint, integer, integer, text, jsonb
) to authenticated;

notify pgrst, 'reload schema';