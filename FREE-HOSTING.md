# Free hosting: Netlify + Supabase

Confirmed on 2026-11-17: TLS-verified Supabase connection, isolated pasabuy_app schema migration and complete cloud workflow test passed. No public/auth schema records were modified. Application accounts use the app's password/recovery system stored in the private schema; existing Supabase Auth users are not automatically imported.

The API uses PostgreSQL when PASABUY_DATABASE_URL is set; otherwise it uses local SQLite. Cloud mutations share a transaction-scoped advisory lock so concurrent rider acceptance cannot claim a request twice. PostgreSQL also has a unique index limiting each rider to one active job. Netlify requires PostgreSQL: its functions must not rely on a local SQLite file.

## Upload code

Create a private personal GitHub repository. Upload only the prepared source folder, then connect that repository from Netlify > Add new project > Import an existing project > GitHub. The netlify.toml build configuration uses npm run build and Next.js integration. Do not upload .env.local, .data, node_modules or .next.

## Netlify environment settings

Before the first public deployment set these values in Netlify environment variables, including Functions/runtime scope:

- PASABUY_DATABASE_URL: the working Transaction pooler URI from .env.local. This is a server secret; never give it a NEXT_PUBLIC_ prefix.
- PASABUY_DATABASE_CA_PATH: config/prod-ca-2021.crt (public certificate included in source/build tracing).
- APP_ORIGIN: the exact HTTPS origin of the Netlify site, with no path.
- PASABUY_DEMO_MODE: false.
- PASABUY_TRUST_PROXY: false (the current trusted-proxy option is for the separate Caddy deployment, not Netlify).

No PASABUY_DATA_DIR is required for cloud mode. The existing NEXT_PUBLIC_SUPABASE_URL and publishable key do not replace PASABUY_DATABASE_URL. No app secret belongs in GitHub source or chat.

## Private operator account

Before opening the site publicly, create the operator with npm run cloud:admin using ADMIN_EMAIL, ADMIN_NAME and ADMIN_PASSWORD set locally. It refuses an existing administrator and prints a one-time recovery code. Save that code privately and clear ADMIN_PASSWORD afterward. Never create a public registration endpoint that accepts admin role.

## Final launch verification

Complete Netlify build, domain HTTPS, secure session-cookie checks, real two-browser customer/rider smoke tests and restart persistence. Configure an off-host database backup/export and practice restoring it. Check support contacts, rider review criteria and operating area before accepting real service requests.

Free plans have quotas. Supabase Free can pause for inactivity; Netlify Free has monthly usage credits. A paid custom domain is optional; use the provider's free subdomain initially. Do not enable paid upgrades automatically.

References: https://www.netlify.com/pricing/ , https://supabase.com/pricing , https://supabase.com/docs/guides/database/connecting-to-postgres .
