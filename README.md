# PasaBuy PH

Customer requests, rider jobs, marketplace, messaging and administration share a persistent database. Public launch is still pending hosting configuration and deployment verification. See PUBLIC-READINESS.md.

## Development

Use Node 26 and run `npm.cmd install` then `npm.cmd run dev`. Open http://localhost:3000 and create your account. PowerShell uses `npm.cmd` to avoid execution-policy errors.

Demo logins are disabled by default, including existing demo sessions. For isolated development tests only, explicitly set PASABUY_DEMO_MODE=true before starting the development server. This cannot enable demo accounts in production. Do not expose a development server publicly.

## Public deployment

Selected free hosting: Netlify + Supabase. See FREE-HOSTING.md for deployment and runtime settings. TLS connection, cloud schema migration and full cloud workflow tests have passed. No public site has been deployed yet. DEPLOYMENT.md describes the optional single-server alternative.

Existing Supabase records have not been migrated. With PASABUY_DATABASE_URL configured, the API uses private PostgreSQL tables in Supabase. Otherwise it uses SQLite for local development. Application accounts are separate from existing Supabase Auth accounts. Customer and rider registration work without demo accounts. New riders require manual administrator approval. Payments are arranged directly; tracking records rider status updates rather than live GPS.

## Verification

- npm.cmd run lint
- npm.cmd run build
- npm.cmd run test:public (starts an isolated temporary test server and database)
- npm.cmd test (starts an isolated temporary server/database with test-only demo mode)
- npm.cmd run test:browser (also requires isolated demo development server and Chrome debugging port9223)

Public-mode tests verify demo rejection, private admin provisioning, secure session cookies and origin checks. Earlier full browser tests covered customer-to-rider completion, marketplace, recovery and message drafts. Re-run these flows on the final HTTPS host before launch.
