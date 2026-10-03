# T&P WEB PORTAL WITH SMART FEATURES

Professional college-style Training & Placement portal. Hosting-provider independent.

## Supabase
1. Run `sql/schema.sql` in your Supabase SQL Editor.
2. Put the project URL and browser-safe Publishable key in `js/config.js`.
3. Create the first Admin in Supabase Authentication and set its profile role to `admin` once with SQL.

## Admin-created users
The Admin CMS now includes **User Management**. It can create Student, TPO, and Admin accounts directly from the portal.

For security, account creation uses a Supabase Edge Function. Supabase's `auth.admin.createUser` must run server-side and the service-role/secret key must never be exposed in browser code.

### Deploy the Edge Function
In the Supabase Dashboard:
1. Open **Edge Functions**.
2. Choose **Deploy a new function → Via Editor**.
3. Create a function named `admin-create-user`.
4. Paste the code from `supabase/functions/admin-create-user/index.ts` into the editor.
5. Add a server-side secret named `SUPABASE_SERVICE_ROLE_KEY` containing your service-role/secret key. Do NOT put it in `js/config.js`.
6. Deploy the function.

After deployment, Admin → User Management → Create account will create users and assign their selected role.

## Roles
- Admin: full portal administration
- TPO: placement operations
- Student: student portal

## Hosting
No Netlify/Vercel dependency is included. Host the static frontend wherever you choose later.
