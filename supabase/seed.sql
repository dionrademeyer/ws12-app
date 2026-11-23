-- Local development seed. Reference lists plus the demo learner Thabo Mokoena, flagged is_demo.
-- The demo account has no password and no sign-in identity, so nobody can sign in as it.

insert into public.subjects (code, name_en, name_af) values
  ('MATH', 'Mathematics', 'Wiskunde'),
  ('MLIT', 'Mathematical Literacy', 'Wiskundige Geletterdheid'),
  ('PHSC', 'Physical Sciences', 'Fisiese Wetenskappe'),
  ('LFSC', 'Life Sciences', 'Lewenswetenskappe'),
  ('ENHL', 'English Home Language', 'Engels Huistaal'),
  ('ENFAL', 'English First Additional Language', 'Engels Eerste Addisionele Taal'),
  ('AFHL', 'Afrikaans Home Language', 'Afrikaans Huistaal'),
  ('AFFAL', 'Afrikaans First Additional Language', 'Afrikaans Eerste Addisionele Taal'),
  ('LO', 'Life Orientation', 'Lewensoriëntering'),
  ('ACC', 'Accounting', 'Rekeningkunde'),
  ('BUS', 'Business Studies', 'Besigheidstudies'),
  ('GEO', 'Geography', 'Geografie'),
  ('HIST', 'History', 'Geskiedenis')
on conflict (code) do nothing;

insert into public.achievements (code, name_en, name_af, rule) values
  ('streak_3', '3 day streak', '3 dae aaneen', '{"streak": 3}'),
  ('streak_5', '5 day streak', '5 dae aaneen', '{"streak": 5}'),
  ('streak_7', '7 day streak', '7 dae aaneen', '{"streak": 7}'),
  ('streak_14', '14 day streak', '14 dae aaneen', '{"streak": 14}'),
  ('streak_30', '30 day streak', '30 dae aaneen', '{"streak": 30}'),
  ('streak_60', '60 day streak', '60 dae aaneen', '{"streak": 60}'),
  ('streak_100', '100 day streak', '100 dae aaneen', '{"streak": 100}')
on conflict (code) do nothing;

insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-4000-8000-000000000d30', 'demo.thabo@demo.invalid', '{"language": "en"}')
on conflict (id) do nothing;

update public.profiles
set first_name = 'Thabo', grade = 12, province = 'GP', is_demo = true, onboarding_step = 5,
  onboarded_at = now()
where id = '00000000-0000-4000-8000-000000000d30';

insert into public.age_declarations (user_id, is_adult)
values ('00000000-0000-4000-8000-000000000d30', false)
on conflict (user_id) do nothing;

insert into public.learner_subjects (learner_id, subject_id)
select '00000000-0000-4000-8000-000000000d30', s.id
from public.subjects s
where s.code in ('MATH', 'PHSC', 'ENHL', 'LO')
on conflict do nothing;
