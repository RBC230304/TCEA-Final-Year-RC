# admin-create-user

Deploy this Supabase Edge Function. It lets an authenticated portal admin create Student, TPO, or Admin accounts from the Admin CMS without exposing a service-role/secret key to the browser.

Required server-side secret:
- `SUPABASE_SERVICE_ROLE_KEY` = your Supabase service-role/secret key. Keep it only in Supabase Edge Function secrets; never put it in `config.js`.

The function verifies the caller's session and checks `profiles.role = admin` before creating an account.
