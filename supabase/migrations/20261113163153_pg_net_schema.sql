-- 20261113162951_email_alerts created pg_net without a schema, so it landed in public
-- (Supabase advisor "extension_in_public"). Reinstall it in the extensions schema. Its
-- functions stay in the net schema, so kick_email_sender() is unaffected.
drop extension if exists pg_net;
create extension pg_net with schema extensions;
