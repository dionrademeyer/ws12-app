-- Sprint 2 QA round 1: a parent keeps the way to withdraw consent after the learner removes
-- the link that consent created (Product Bible 3.3, docs/api-contract.md).
--
-- When a learner removes such a link, the consent stays given. my_family() now lists that
-- removed link for the consenting parent only, with status 'removed' and the consent id, for
-- as long as the consent is given, so Family can still offer withdraw_consent(). Nobody else
-- sees the removed link: not the learner and not any other parent.

create or replace function public.my_family()
returns table (
  link_id uuid,
  other_user_id uuid,
  other_first_name text,
  relation text,
  status text,
  waiting_on_me boolean,
  consent_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;

  return query
  select
    family.id,
    family.other_id,
    case
      when family.relation = 'parent' or public.has_consent_for(family.other_id) then o.first_name
    end,
    family.relation,
    family.status,
    family.status = 'pending' and case
      when not public.has_consent_for(family.learner_id) then family.parent_id = v_uid
      else family.initiated_by <> v_uid
    end,
    case
      when family.parent_id = v_uid and family.status = 'pending' then (
        select c.id
        from public.parental_consents c
        where c.link_id = family.id
          and c.status = 'pending'
          and public.consent_request_expires_at(c.requested_at) > now()
        order by c.requested_at desc
        limit 1
      )
      when family.parent_id = v_uid and family.status in ('active', 'removed') then (
        select c.id
        from public.parental_consents c
        where c.link_id = family.id and c.parent_user_id = v_uid and c.status = 'given'
        order by c.given_at desc
        limit 1
      )
    end
  from (
    select
      l.id,
      l.learner_id,
      l.parent_id,
      l.initiated_by,
      l.status,
      l.created_at,
      case when l.learner_id = v_uid then l.parent_id else l.learner_id end as other_id,
      case when l.learner_id = v_uid then 'parent' else 'child' end as relation
    from public.parent_links l
    where v_uid in (l.learner_id, l.parent_id)
      and (
        l.status in ('pending', 'active')
        or (
          l.status = 'removed'
          and l.parent_id = v_uid
          and exists (
            select 1
            from public.parental_consents c
            where c.link_id = l.id and c.parent_user_id = v_uid and c.status = 'given'
          )
        )
      )
  ) family
  join public.profiles o on o.id = family.other_id
  order by family.created_at, family.id;
end;
$$;

revoke execute on function public.my_family() from public, anon;
grant execute on function public.my_family() to authenticated;
