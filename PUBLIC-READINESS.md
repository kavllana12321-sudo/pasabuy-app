# Public deployment progress

Updated 2026-11-17. Current estimate: 75% toward public launch. This is an estimate against the checklist, not a certification.

Completed:
- Connected customer, rider, admin, booking, marketplace, messaging, profile and recovery flows; prior browser lifecycle tests passed.
- Default demo access disabled; existing demo sessions rejected without deleting local data.
- Private one-time admin provisioning; public registration cannot create an admin.
- Persistent data directory configuration, fixed public origin and secure cookies behind HTTPS.
- Security response headers, bounded request body, opt-in trusted-proxy authentication limits.
- Production launch checks and a container/reverse-proxy deployment template.
- Public mode automated checks, isolated full backend workflows, lint and production compilation passed.
- Online backup integrity and reading the restored snapshot passed in an isolated test database.

Cloud hosting progress:
- Netlify Free + Supabase Free selected.
- Verified TLS and password authentication to the Supabase transaction pooler.
- Private pasabuy_app schema created; public/auth schemas were not modified.
- Full PostgreSQL cloud workflow tests passed, including concurrency and recovery.
- Next.js updated to16.4.6; npm audit fix reported zero known vulnerabilities.
- Public site and permanent administrator are still pending.

Required before public launch:
- Connect the GitHub source repository to Netlify, configure runtime secrets and public URL, and provision the private admin.
- Complete and test the actual Netlify deployment. Docker is an optional alternative, not the selected free-hosting path.
- Configure and test off-host backups and restoration, host monitoring and capacity.
- Confirm actual service area, rider review process, support/cancellation disputes and public content rules with the operator.
- Test multiple real user sessions, abuse limits and HTTPS on the deployed domain.

No public site is deployed yet. Existing local/Supabase data was not migrated or deleted.
