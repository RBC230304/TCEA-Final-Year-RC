# T&P Portal Professional V12

This version keeps the existing T&P workflow and adds a reliable media upload path, a redesigned registration page, and dynamic job-specific CV requirements.

## V12 setup

1. Keep the existing Supabase project and database.
2. Do not rerun `sql/schema.sql`, `sql/schema_v2.sql`, or the older CV/onboarding patches.
3. Run only `sql/schema_v12_cv_requirements_media_fix.sql` in Supabase SQL Editor.
4. Keep the existing `js/config.js` Supabase URL and anon/publishable key.
5. Deploy the existing `admin-create-user` Edge Function as before.
6. Replace the frontend with the V12 files.

## Profile picture

Students can upload JPG/PNG/WEBP from **Student Portal → My Profile & CV**. V12 stores the image at a stable path and updates the public URL with a cache-busting query string. The V12 SQL patch also replaces the old storage policies with ownership-by-folder policies, which removes the dependency on `current_role()` for profile media uploads.

## Dynamic CV requirements

Companies can:
- choose a website CV format or upload a fillable PDF;
- select standard CV fields;
- mark fields as Required;
- add custom fields with a key, label, type and required flag;
- later edit the requirements from **My Placement Drives → CV Fields**.

TPOs can use **Job Drives & Shortlisting → CV Fields** to edit the exact required fields for any drive, and **Build CV on Website** to edit the web CV format.

Students see the job's required fields from **Search Jobs → Prepare CV**. Required information must be saved before the application or job-specific CV download is allowed.

For fillable PDFs, use form-field names that match the saved field keys (for example `FULL_NAME`, `CGPA`, `LINKEDIN`, `GITHUB`).


## V13 fixes
- Profile picture upload uses unique files, timeout/error handling, and path-based Storage policies.
- Company logo and homepage poster uploads use the same robust upload handling.
- Company Job Ad Posters now refreshes and falls back to legacy active drives that match the company name when company_id was missing on older records.
- Run `sql/schema_v13_media_ads_fix.sql` once after your existing V12 patch.


V14 fixes: student profile-picture upload self-recovers when the profile context is not yet loaded; job poster storage path now matches the authenticated company folder policy.
