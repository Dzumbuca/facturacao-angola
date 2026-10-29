# Machine Facturas Desktop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a secure Windows Electron companion that reuses the hosted Machine Facturas app online and supports encrypted, authorized offline invoice drafts with durable synchronization.

**Architecture:** Electron loads the existing HTTPS Next.js application for online authentication and use; when it cannot be reached, a packaged React offline shell uses a narrow preload API backed by encrypted SQLite in Electron main. The server issues short-lived user/tenant grants and remains authoritative for every synchronized write and all fiscal issuance.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Electron, electron-builder NSIS, SQLite, AES-GCM with a DPAPI-protected key through Electron `safeStorage`, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-29-machine-facturas-desktop-design.md`

## Global Constraints

- Preserve the hosted Next.js app, its auth flows, tenant-role checks, APIs, database and existing behaviors.
- Offline writes are limited to invoice drafts; an offline record is never an issued invoice.
- The first offline setup requires authenticated online access; an expired grant makes the local workspace read-only until renewed online.
- Local data and queues are partitioned by signed user and tenant; switching accounts preserves, but does not reveal, other accounts' unsynced drafts.
- Keep all SQLite access and encryption keys in Electron main; use `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, schema-validated IPC and sender-origin checks.
- No server credentials, database URLs, Supabase service keys, passwords or invoice private keys may enter the executable.
- No production deployment, database migration or installer publication is part of this task.
- The web download link is absent unless a real HTTPS installer URL is configured.
- Never change or stage unrelated pre-existing files; preserve the existing Adsterra edits and unrelated untracked files.

## Review Focus

- Expired grant: cached data remains readable but all local draft edits are denied until successful online renewal.
- Account switch: a user can never enumerate, read or sync another user's or tenant's local partition; pending work survives a switch.
- Stale authorization: VIEWER, disabled user, suspended tenant, wrong tenant and expired session cannot sync a draft.
- Retry/replay: a lost response and repeated sync cannot create duplicate server drafts; mismatched stable IDs become conflicts.
- Connection loss/recovery: interruption during sync, app restart and restoration preserve the draft and produce one synchronized server record without issuing an invoice.

---

### Task 1: Server authorization grant and safe draft API contract

**Files:**
- Create: `src/lib/offline-grant-core.ts`
- Test: `src/lib/offline-grant-core.test.ts`
- Create: `src/app/api/desktop/offline-bootstrap/route.ts`
- Modify: `src/lib/invoice-draft-validation.ts`
- Modify: `src/lib/invoice-draft-service.ts`
- Modify: `src/app/api/invoices/drafts/route.ts`
- Modify: `src/app/api/invoices/drafts/[id]/route.ts`
- Test: offline bootstrap, draft API idempotency and update-conflict tests under `src/lib/`
- Modify: `.env.example` only with an empty offline grant signing-key contract if the existing examples use environment placeholders.

**Interfaces:**
- `OfflineGrantClaims`: `userId`, `tenantId`, `tenantRole`, `sessionVersion`, `canCreateInvoiceDrafts`, `issuedAt`, `expiresAt`.
- `signOfflineGrant(claims, privateKey): string` and `verifyOfflineGrant(token, publicKey, now): OfflineGrantClaims | null`.
- `POST /api/desktop/offline-bootstrap` returns a signed grant and only the authenticated tenant's approved company profile, active bank account references, customers, products and drafts.
- `InvoiceDraftInput` accepts an optional UUID `id` and optional `expectedUpdatedAt`; normal web requests without these fields retain current behavior.

- [ ] **Step 1: Add failing grant tests** for valid signature, tampering, wrong tenant/user scope, invalid role, not-yet-valid grant, and expired grant.
- [ ] **Step 2: Run the focused test** with `node_modules/vitest/vitest.mjs run src/lib/offline-grant-core.test.ts`; confirm the missing functions fail.
- [ ] **Step 3: Implement signing and verification** using server-only private key configuration and a public verification key that is safe to bundle; set a maximum 12-hour grant lifetime.
- [ ] **Step 4: Add failing draft contract tests** proving stable-ID replay with equal payload returns one draft, same ID with a different payload returns conflict, and stale update versions cannot overwrite server changes.
- [ ] **Step 5: Implement the guarded bootstrap and idempotent draft contract** using existing tenant access guards and `InvoiceDraft.id`; preserve the existing `/issue` path unchanged.
- [ ] **Step 6: Run the focused authorization and draft tests** and `tsc --noEmit`; confirm VIEWER and suspended tenants receive no draft-write grant.

### Task 2: Electron foundation, encrypted SQLite and restricted IPC

**Files:**
- Create: `electron/main.ts`
- Create: `electron/preload.ts`
- Create: `electron/offline-store.ts`
- Create: `electron/ipc-contract.ts`
- Create: `electron/offline-store.test.ts`
- Create: `src/types/desktop.d.ts`
- Modify: `package.json` and `package-lock.json` with pinned Electron/SQLite/build dependencies and scripts needed by this task.

**Interfaces:**
- `OfflineStore.open(userId, tenantId)`, `readSnapshot()`, `replaceSnapshot(snapshot)`, `saveDraft(draft)`, `listDrafts()`, `listOutbox()`, `updateSyncState(id, state)` and `close()`.
- `window.machineFacturasDesktop`: only typed named methods for checking runtime, reading status, reading/updating the active local partition, and requesting online sync; no generic IPC method.
- SQLite payloads are encrypted JSON envelopes. A random AES-GCM key is encrypted through asynchronous `safeStorage`; the store refuses writes if encryption is unavailable.

- [ ] **Step 1: Add failing store tests** for encryption at rest, partition isolation, expiry read-only enforcement, restart persistence and pending queue retention.
- [ ] **Step 2: Run the focused tests** and confirm the store/security APIs are absent.
- [ ] **Step 3: Implement the store and Electron main/preload scaffold** with `contextIsolation`, sandboxing, `nodeIntegration: false`, HTTPS/custom-protocol allowlists, external-window restrictions and IPC sender validation.
- [ ] **Step 4: Verify the SQLite file** contains no plaintext test NIF, customer name, invoice contents, grant token or encryption key.
- [ ] **Step 5: Run focused store tests** under Electron's Windows runtime and TypeScript checks.

### Task 3: Packaged offline React workspace and account isolation

**Files:**
- Create: `desktop/offline/index.html`
- Create: `desktop/offline/main.tsx`
- Create: `desktop/offline/offline-workspace.tsx`
- Create: `desktop/offline/offline.css`
- Create: offline UI tests under `desktop/offline/`
- Modify: `electron/main.ts` and `electron/ipc-contract.ts` for the `app://offline` protocol and account-partition lifecycle.
- Modify: package scripts/configuration for offline UI bundling.

**Interfaces:**
- Offline workspace consumes only `window.machineFacturasDesktop` and cached snapshot data.
- Draft writes include the cached grant's user/tenant identity only inside the main-process vault; the renderer cannot choose another partition.
- At grant expiry, draft lists are readable and all add/edit operations return a visible read-only state.

- [ ] **Step 1: Add failing offline UI tests** for empty cache, read-only expired grant, create/edit local draft, state label, account switch and no issuance controls.
- [ ] **Step 2: Run the focused UI tests** and confirm they fail before implementation.
- [ ] **Step 3: Implement the small offline workspace** using the existing draft validation/tax calculation and Machine Facturas visual styles where safely shareable.
- [ ] **Step 4: Test account switching** with two test users/tenants; each can only see its own snapshot and drafts, and switching away/back preserves pending data.
- [ ] **Step 5: Confirm the offline view cannot call issuance, payment, profile mutation or catalog mutation APIs.**

### Task 4: Authorized online bootstrap and durable automatic synchronization

**Files:**
- Create: `src/components/desktop-offline-bootstrap.tsx` or an equivalent narrowly scoped desktop-only integration component.
- Create: sync core and tests under `src/lib/desktop-sync-core.ts` and `src/lib/desktop-sync-core.test.ts`.
- Modify: `electron/main.ts`, `electron/offline-store.ts`, `electron/ipc-contract.ts`.
- Modify: `src/app/(dashboard)/layout.tsx` to mount the invisible bootstrap/status component without touching the pre-existing app-shell changes.

**Interfaces:**
- Bootstrap writes the signed grant and only the authorized snapshot to the current encrypted partition.
- `syncPendingDrafts(store, apiClient, now): Promise<SyncSummary>` uses stable draft UUIDs and existing authenticated APIs.
- Queue states: `PENDING`, `SYNCING`, `SYNCED`, `CONFLICT`, `ERROR`; retry uses bounded exponential backoff and never discards payloads.
- Server denial due to changed user/role/tenant status stops the sync and retains encrypted work.

- [ ] **Step 1: Add failing sync tests** for retry after network failure, replay after lost response, one stable server ID, stale-version conflict, API 401/403/validation error, and payload preservation.
- [ ] **Step 2: Run the focused tests** and confirm they fail before implementation.
- [ ] **Step 3: Implement bootstrap and main-process sync** using the Electron partition's Chromium session fetch to the configured HTTPS origin; never connect directly to PostgreSQL.
- [ ] **Step 4: Test interruption/restart/recovery** with a disposable API fixture and SQLite file; assert one server draft, no lost payload, and no invoice issuance.
- [ ] **Step 5: Test a real Electron connectivity-loss/recovery cycle on Windows** before claiming offline sync complete.

### Task 5: Windows installer and gated website download

**Files:**
- Create: `electron-builder.config.ts` (or the supported configuration format selected for the pinned packager).
- Modify: `package.json`, `package-lock.json`, `.gitignore` and any build scripts.
- Modify: `src/components/site-footer.tsx` or the chosen public download location to render a link only for a valid configured HTTPS URL.
- Modify: `.env.example` with an empty `NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL` placeholder.

**Interfaces:**
- Scripts preserve existing `dev`, `build`, `start` and `test`; add desktop development, desktop build, desktop test and Windows NSIS distribution scripts.
- Windows artifact path: `dist-desktop/MachineFacturas-Setup.exe`.
- No link renders for an empty, non-HTTPS or absent installer URL.

- [ ] **Step 1: Add failing configuration tests** for absent/invalid HTTPS download URL and exact installer artifact naming.
- [ ] **Step 2: Run the focused tests** and confirm they fail.
- [ ] **Step 3: Configure electron-builder NSIS** for per-user installation, app metadata, packaged offline assets and runtime files; exclude `.env*`, backups, logs, workspace caches and server private material.
- [ ] **Step 4: Implement the conditional download link** with no placeholder target and no link to an unbuilt artifact.
- [ ] **Step 5: Build the Windows installer** and inspect its contents and path. Do not publish it.

### Task 6: Full verification, diff review and requested commit

**Files:**
- Test: all relevant `src/lib/**/*.test.ts` and new Electron/offline test suites.
- Review: `git diff`, staged path list and installer archive contents.

- [ ] **Step 1: Run the full Vitest suite** and record exact totals.
- [ ] **Step 2: Run TypeScript and production Next.js build** with the configured Node runtime; confirm existing website routes still build.
- [ ] **Step 3: Run the Windows Electron loss/recovery test** and verify all acceptance criteria from the design.
- [ ] **Step 4: Inspect the complete diff and scan only relevant staged paths** for secrets, `.env`, credentials, backups, logs and generated build files.
- [ ] **Step 5: Stage only desktop/server integration files and tests from this plan.** Preserve the already-existing Adsterra edits and unrelated untracked files without staging them.
- [ ] **Step 6: Commit the verified desktop implementation** with `feat: add secure Windows desktop app with offline invoice drafts`.

---

## Builder review focus

The five highest-risk conditions have explicit tests in Tasks 1–4: expiry, account switching, stale server authorization, replay/conflict handling and connection loss/recovery.
