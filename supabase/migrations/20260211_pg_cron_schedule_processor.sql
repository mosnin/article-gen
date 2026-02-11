-- pg_cron setup for scheduled article processing
-- This calls the Supabase Edge Function every 5 minutes to process pending scheduled articles
--
-- PREREQUISITES:
-- 1. Enable the pg_cron extension in Supabase Dashboard > Database > Extensions
-- 2. Enable the pg_net extension in Supabase Dashboard > Database > Extensions
-- 3. Deploy the Edge Function: supabase functions deploy process-schedules
-- 4. Set the CRON_SECRET in your Edge Function environment variables
--
-- After enabling extensions and deploying the function, run this SQL in the SQL Editor:

-- Enable extensions (if not already enabled)
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Schedule the cron job to run every 5 minutes
-- Replace YOUR_PROJECT_REF with your actual Supabase project reference (e.g., abcdefghijklmnop)
-- Replace YOUR_CRON_SECRET with a secure random string you also set in your Edge Function env vars

/*
select cron.schedule(
  'process-scheduled-articles',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-schedules?secret=YOUR_CRON_SECRET',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
*/

-- To check existing cron jobs:
-- select * from cron.job;

-- To remove the cron job:
-- select cron.unschedule('process-scheduled-articles');
