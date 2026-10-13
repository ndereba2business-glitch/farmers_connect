-- Light or dark theme, remembered on the profile so the choice follows the
-- person from one device to the next.
--
-- Null means "never chose": the app then uses what the browser remembers,
-- and failing that the phone's own setting. 'system' is an explicit choice
-- to follow the phone. The column is on farmer_profiles because every
-- role has a row there (see handle_new_user), and the existing owner rule
-- already lets a person update their own row and nobody else's.

alter table public.farmer_profiles
  add column if not exists theme_preference text
    check (theme_preference is null or theme_preference in ('light', 'dark', 'system'));

comment on column public.farmer_profiles.theme_preference is
  'The person''s chosen appearance: light, dark or system (follow the phone). Null until they choose.';
