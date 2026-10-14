# Cosmy Flagships — catalogue, admin dashboard & stock management

Storefront (`/`) and admin dashboard (`/admin`) share one source of truth: a **Supabase** project
(free tier — Postgres database, Auth, Storage). There is no separate server to run or pay for.

## How security works (important)
All rules are enforced **in the database**, not in the browser:
- Visitors can only **read phones whose status is "available"**.
- Only users listed in the `admins` table can see sold/unavailable phones, add, edit, delete, or upload images.
- Prices, conditions, statuses, image links etc. are validated by database constraints, so a hand-made request
  can't bypass the checks.
- The browser only holds the **public anon key**. The `service_role` key is never used — don't add it.
- Passwords are handled and hashed by Supabase Auth; this app stores none.

## 1. Install
Add the one new dependency to your existing project, then copy these files in (keep your own `package.json`,
`vite.config.js`, `index.html`):
```
npm install @supabase/supabase-js
```
Copy: `src/`, `supabase/`, `public/_redirects`, `vercel.json`, `.env.example`; append `.gitignore.additions` to your `.gitignore`.

## 2. Create the Supabase project (free)
1. supabase.com → New project (free plan). Save the database password somewhere safe.
2. **SQL Editor → New query**, paste all of `supabase/schema.sql`, **Run**. (Safe to re-run.)
   This creates the `phones` and `admins` tables, security policies and the `phone-images` storage bucket.
3. **Authentication → Providers → Email**: keep Email on, and **turn OFF "Allow new users to sign up"** so
   nobody can create their own account. (Authentication → Sign In / Providers, wording varies slightly.)

## 3. Environment variables
```
cp .env.example .env
```
Fill in from **Project Settings → API**: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the *anon / public* key).
Restart `npm run dev` after editing `.env`.

## 4. Create the admin account
1. **Authentication → Users → Add user → Create new user**: enter your email + a strong password, tick
   "Auto Confirm User".
2. **SQL Editor**, run (with your email):
```sql
insert into public.admins (user_id)
select id from auth.users where email = 'you@example.com'
on conflict do nothing;
```
3. Open `/admin` and sign in. Other users you create can't do anything until added to `admins` the same way.
   To remove an admin: `delete from public.admins where user_id = (select id from auth.users where email = '...');`

## 5. Run locally
```
npm install
npm run dev      # http://localhost:5173  (admin at /admin)
npm run build    # production build
npm run preview
```

## 6. Deploy (free options)
- **Vercel / Netlify / Cloudflare Pages**: connect the repo, build command `npm run build`, output `dist`.
  Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the host's environment-variable settings.
  `vercel.json` / `public/_redirects` make `/admin` work on refresh.
- In Supabase **Authentication → URL Configuration**, set the Site URL to your live address.

## Using the dashboard
- **Add / Edit phone**: brand, model, storage, RAM (optional — leave blank when unknown, e.g. iPhones),
  price (KSh), condition (new / ex-UK / used), description, images, status, stock source.
- **Images**: upload JPEG/PNG/WebP up to 2 MB (stored in Supabase Storage, not the database), or paste an `https://` link.
  Up to 6 per phone; the first is the main image.
- **Mark sold / Mark available / Supplier out of stock**: changes what customers see immediately.
  Only "Available" phones appear on the shop.
- **Supplier stock**: shown to customers as *"we confirm availability when you message us"* until you press
  **Confirm supplier** after actually checking with the supplier. If you mark a supplier phone sold/unavailable,
  its confirmation is cleared automatically; re-listing it requires confirming again.
- **Delete** asks for confirmation. Prefer "Mark sold" to keep a record.

## Free-tier notes
Supabase free projects pause after about a week of no activity (the first visit afterwards is slow until you
resume the project in the dashboard). Images up to 2 MB each keep you well inside the storage allowance.
The shop loads all *available* phones in one request and filters in the browser — fine for a catalogue of
up to a few hundred phones.

## Tests included
`supabase/run-tests.sh` applies `schema.sql` to a scratch **local** Postgres, simulates Supabase's roles, and runs
56 checks (who can read/write what, validation rules, supplier-confirmation rules, storage policies):
```
./supabase/run-tests.sh -h localhost -U postgres      # needs a local Postgres you can create databases in
```
