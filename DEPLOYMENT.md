# Public deployment runbook

Target: one Node26 server with a persistent local disk, behind HTTPS. This is a prepared deployment template, not a deployed or container-tested service.

1. Select the server/domain, point DNS at it, and allow ports80/443. Keep the app port private.
2. Set APP_ORIGIN to the exact HTTPS origin and PASABUY_DATA_DIR to an absolute persistent directory. Never copy development .env.local or .data into the public installation. PASABUY_DEMO_MODE must be false.
3. Install dependencies and build. Provision the administrator once using npm run admin:create with ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD in the process environment. Use a unique password of at least14 characters, entered privately, not committed to a file or shell command history. Save the printed recovery code privately. Clear ADMIN_PASSWORD afterward. The command refuses to replace an existing administrator.
4. Start using npm start. It refuses missing HTTPS-origin/storage configuration or demo mode. Run under the host's process supervisor.
5. Alternatively use deploy/compose.yaml with DOMAIN set, then docker compose -f deploy/compose.yaml up --build -d. The app stores records in the records named volume; Caddy terminates HTTPS and sets X-Real-IP. Provision the administrator inside that app container with the same one-time environment inputs. This container template needs a real Docker build/run check before launch; Docker is not installed in the development workspace.
6. Set PASABUY_TRUST_PROXY=true only behind a proxy you control that overwrites X-Real-IP. Authentication attempts are limited per that address; do not place a CDN in front without configuring its trusted address chain. Direct public access to the app port must be blocked.
7. Schedule npm run db:backup with PASABUY_DATA_DIR and PASABUY_BACKUP_DIR. It uses SQLite online backup and checks integrity. Transfer encrypted backup copies off-host, set retention, and test restoration on a separate server. Restore only while the application is stopped; do not copy a raw live SQLite file without its journal.
8. Before launch: verify real customer/rider registration, saved recovery codes, admin approval, accept/pickup/completion, chat across two browsers, cancellation, marketplace, secure cookies and redirects, rate-limit behavior, restart persistence, backup restoration and service monitoring on the actual domain. Establish the operator's support process and rider-review criteria. No online payment/email service is implied by this release.

The reverse proxy configuration follows the [Caddy header_up reference](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy). Backup uses the [Node SQLite backup API](https://nodejs.org/api/sqlite.html#sqlitebackup-sourcedb-path-options).
