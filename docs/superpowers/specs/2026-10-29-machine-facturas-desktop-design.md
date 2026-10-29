# Machine Facturas Desktop — Design

## Intent

Provide a Windows installer for a hybrid desktop companion to Machine Facturas while keeping the existing hosted Next.js application as the online product and PostgreSQL/Supabase as the system of record. The desktop app adds a narrowly scoped offline mode for customers who need to consult previously authorized company data and prepare invoice drafts when connectivity is unavailable.

## Goals

- Package the existing hosted application in Electron for online use and reuse its Next.js UI, NextAuth login, tenant authorization and APIs.
- Provide a packaged offline screen that can read an authorized local snapshot and create or edit local invoice drafts.
- Store the snapshot and a durable outbox in SQLite, encrypted with a per-user key protected by Windows DPAPI through Electron `safeStorage`.
- Synchronize drafts automatically when the official API is reachable, with stable IDs, retry, visible status and conservative conflict handling.
- Keep fiscal issuance exclusively on the existing authenticated server path. An offline draft is never a numbered, signed, shared or issued invoice.
- Build a per-user Windows NSIS installer named `MachineFacturas-Setup.exe`. Do not publish or link it until an installer has been produced and verified.

## Non-goals

- Offline invoice issuance, PDF generation that represents an issued fiscal invoice, customer/product/profile edits, payments, reports, SAFT exports, account administration or plan changes.
- Running PostgreSQL, Supabase, Prisma migrations or server secrets on the desktop.
- Replacing the web site, changing its database, or changing authentication and authorization rules for existing web users.
- Treating an offline user's cached role as current after its authorization grant expires.

## Audit findings

- The app is Next.js 16.4.2 with React 19 and TypeScript 7. It uses App Router route handlers and Prisma against PostgreSQL. There is no Electron, SQLite or service-worker package or desktop shell in the current package manifest.
- NextAuth uses JWT sessions. Each server request rechecks the user's active status, session version, tenant association and account verification; tenant reads and writes pass through shared authorization guards. `VIEWER` cannot write, suspended tenants cannot write, and company-settings writes require `COMPANY_ADMIN`.
- Existing API routes already return tenant-scoped company profile, customers, products and invoice drafts. The invoice composer posts drafts to `/api/invoices/drafts` and updates them through `/api/invoices/drafts/[id]`.
- Invoice issuance is a separate server operation. It checks quota, validates the tenant bank account, allocates the invoice number, calculates totals, chains the previous hash, signs with the server private key and persists the invoice in PostgreSQL. These rules remain server-only.
- `InvoiceDraft.id` is already a UUID primary key. It can serve as the stable offline draft identifier, avoiding a new database column or migration. The current draft API will need idempotent create/update semantics and an optimistic version check to handle retries safely.
- The UI's reusable invoice form depends on Next navigation and server-rendered data. The online app can reuse it as-is; the offline fallback should be a small packaged React screen sharing pure validation/tax logic and the visual design, rather than attempting to boot Next's database-backed server locally.
- Next.js route handlers are public endpoints and must keep explicit server-side authentication and authorization. The locally loaded desktop renderer must not gain Node access.

## Architecture

### Online mode

Electron opens only the configured HTTPS Machine Facturas origin in a persistent Electron session partition. That reuses the existing sign-in and web application. The desktop shell keeps the same authentication cookies in the Chromium session; it does not read passwords or expose cookies to React. Existing APIs remain the only online source of truth.

### Offline mode

If the HTTPS app cannot be reached, Electron loads a packaged `app://offline` screen. This screen is a small React/TypeScript bundle that uses the existing invoice-draft validation and tax calculation code where those modules are safe to share. A narrow preload bridge exposes only snapshot reads, local draft create/update, sync status and an explicit retry action.

Before offline use is enabled, an authenticated server endpoint issues a short-lived, signed offline authorization grant containing the user ID, tenant ID, permitted role/capability and expiry. The private signing key exists only in the server environment; the installer contains only the public verification key. If the signing configuration is absent or the grant expires, offline access is disabled. The app never infers an identity from renderer-supplied tenant IDs. The first use requires a successful online login and cache/grant setup; no manual or unauthenticated provisioning path is provided.

The online renderer may cache only the records returned to the authenticated user by existing read APIs and needed by the invoice form: company profile and active bank account references, customers, products, plus the local drafts themselves. It does not mirror issued invoices or unrelated tenant data. Each cache is partitioned by the signed user/tenant identity. Switching accounts opens only the newly authenticated account's partition; the previous account's unsynced drafts remain encrypted and inaccessible until that same account returns. Account switching never deletes pending drafts.

### Local persistence and IPC

SQLite is owned and opened only by Electron main. The database stores ciphertext for profile/catalog/draft payloads and the outbox; no password, PostgreSQL URL, Supabase service key or invoice signing key is stored there. A random AES-GCM data key is protected by asynchronous Electron `safeStorage` (Windows DPAPI). If OS encryption is unavailable, the app refuses to persist offline data rather than falling back to plaintext.

Electron uses `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, restrictive navigation/window-open rules, HTTPS-only remote loads, and sender-origin validation on every IPC handler. The preload exposes named, schema-validated operations only; it never exposes raw `ipcRenderer`, filesystem, SQLite or Electron APIs.

### Draft queue and synchronization

- An offline draft receives a stable UUID and remains visibly marked **Local — por sincronizar**. Editing a local, unsynced draft updates its queued payload instead of creating duplicate queue entries.
- When online, the main process uses the Electron session's Chromium network stack to call the hosted draft API. It does not connect to PostgreSQL directly.
- The hosted `POST /api/invoices/drafts` accepts the stable UUID. Repeating a create for the same tenant and UUID returns the same draft when the payload matches; a mismatch returns a conflict. Updates use `updatedAt` as an expected version. A stale or already-issued draft becomes **Conflito** and the local payload is retained; the app does not auto-merge or overwrite server data.
- Queue states are **Pendente**, **A sincronizar**, **Sincronizado**, **Conflito** and **Erro**. Retries use bounded exponential backoff and stop on authentication/authorization or validation errors. A successful HTTP response alone is not enough: the server draft ID and version must be persisted locally before marking it synchronized.
- Sync rechecks normal server authorization and tenant status. If the user is suspended, the role changes, the tenant is suspended, or the session expires, the server rejects the operation and the local encrypted draft remains intact for the same authorized account to resolve later.
- The existing `/issue` operation is never called by the offline screen. A synchronized draft can be opened in the normal online interface for fiscal validation and issuance.

## Installer and website integration

- Add Electron development, test, build and Windows packaging scripts without changing existing `dev`, `build`, `start` or `test` behavior.
- Use electron-builder's Windows NSIS target. The output path is `dist-desktop/MachineFacturas-Setup.exe`; a build may be unsigned if signing credentials are unavailable, and must be labelled as a test artifact.
- The web site may render a desktop-download link only when an explicit HTTPS `NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL` is configured. Empty configuration renders no link; no placeholder or non-existent installer is advertised.
- No production deployment, database migration or installer publication is part of this change.

## Security and authorization constraints

- The hosted API remains authoritative for user status, role, tenant ownership, invoice quota, numbering, hash chain, RSA signature and fiscal issue status.
- The offline grant is scoped to one user and one tenant, expires within 12 hours, and permits only reading the approved local snapshot and saving invoice drafts. Once expired, cached data and drafts remain read-only until the user reconnects and renews authorization. No local action can broaden it.
- Cached records and drafts are encrypted at rest; renderer code cannot read the database file or decryption key. Switching accounts never exposes another account's local partition or deletes its pending work.
- The server's signing key is added only as an unset example entry and runtime configuration contract; no real key is committed or bundled.
- Unsent drafts survive network loss, app restart and a denied sync. Account separation and explicit clearing/deletion behavior must not silently discard unsynced work.

## Verification and acceptance

- Unit tests cover grant signature/scope/expiry, IPC sender and payload validation, user/tenant partitioning, encrypted SQLite reads/writes, draft UUID idempotency, optimistic concurrency, queue retry and conflict states.
- Integration tests use a disposable test API/database and never the production database. They prove unauthorized users and `VIEWER` cannot sync, cross-tenant identifiers do not disclose records, a replay does not create a second draft, and a version conflict preserves local work.
- A Windows Electron test performs a real connectivity-loss/recovery cycle: load the app online, cache an authorized snapshot, disable the test network, create and restart with a local draft, restore connectivity, then verify one server draft and a synchronized local status. No invoice is issued in this test.
- Build and inspect the Windows installer, confirm its exact path/name and installed launch behavior, and scan the packaged files for server secrets and private signing material.
- Verify the existing web `npm test` and production Next build still pass. Do not call the offline feature complete until the Windows loss/recovery test passes.

## Implementation choices and pending runtime requirements

- The user selected offline invoice drafts only; other offline writes are excluded.
- The user selected online setup before first offline use, and read-only access after grant expiry.
- The user selected isolated account partitions that retain unsynced drafts across account switches.
- No database migration is expected. The existing `InvoiceDraft.id` becomes the stable client ID, with API safeguards added around that field.
- The offline grant signing key must be configured on the hosted server before production offline mode can be enabled. This task prepares the API and installer contract but does not change production configuration.
- The exact Electron, SQLite and packager versions will be pinned after checking compatibility with the project's Windows/Node environment; no installer is to be published during implementation.

## References

- Next.js 16 local docs: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`, `node_modules/next/dist/docs/01-app/02-guides/authentication.md` and `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`.
- Electron security: https://www.electronjs.org/docs/latest/tutorial/security
- Electron context isolation: https://www.electronjs.org/docs/latest/tutorial/context-isolation
- Electron safeStorage: https://www.electronjs.org/docs/latest/api/safe-storage
- Electron session fetch: https://www.electronjs.org/docs/latest/api/session
- electron-builder NSIS: https://www.electron.build/docs/nsis/
