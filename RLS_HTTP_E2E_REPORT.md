# RLS_HTTP_E2E_REPORT

**Status:** **PARTIAL (minimal HTTP proof on isolated runtime) / NOT COMPLETE.**

## Isolated runtime (5437 only, NOBYPASSRLS target)
- **DB target (proven by Prisma-client process using same `@prisma/client` and temp env URL):** `database=mf_rls_staging`, `user=mf_app_login`, `rolsuper=false`, `rolbypassrls=false`, `host_target_port_5437=true` (`tmp/prove-prisma-5437-identity.cjs`). `server_port_internal=5432` is container-internal only.
- **Env isolation strategy:** Node launcher reads `tmp/.env.rls-e2e-5437` (**not committed**, gitignored; local test creds) and injects into child `process.env` before spawning `node node_modules/next/dist/bin/next dev --webpack -p 3018 -H 127.0.0.1`. Probe showed `@next/env.loadEnvConfig` does **not override existing `process.env` values** (existing values kept). Risk remains because Next still reports loading `.env.local,.env`; the launcher sets required vars explicitly (DB/auth/URL/cron). Temp env corrected to `NEXTAUTH_URL/APP_URL=http://127.0.0.1:3018`.
- **Next.js hang diagnosis (3017):** previous isolated instance (PID 34624, facturacao-angola only) compiled and became unresponsive after starting `/api/auth/[...nextauth]/route` compile; `/login` and `/api/auth/csrf` timed out. Likely causes observed: dev compilation/request blocking plus env/DB-target ambiguity from project `.env/.env.local` precedence; no evidence of unrelated project process interference. Restart via detached PS/npx launcher had `spawn EINVAL` in that shell. Controlled Node spawn with explicit env on 3018 became responsive.
- **Runtime-process DB identity endpoint through Next:** attempted temporary `/api/rls-e2e-db-proof` route; first attempt returned 404/compile issues due to route writing/syntax and was removed. **NOT CAPTURED** as a successful Next-route response in this run. Independent Prisma process proof above is the available evidence.

## Executed minimal HTTP proof (isolated Next 3018, 5437 fixtures)
| Test | Result | Evidence |
|---|---|---|
| `/login` page | **PASS** | `tmp/rls-e2e-artifacts/minimal-http-proof.log` + HTTP probe 200 HTML |
| `/api/auth/csrf` | **PASS** | status 200, csrfToken present |
| `/api/auth/providers` URL points to 3018 | **PASS** | response includes 3018 URLs (after env fix) |
| `/api/auth/session` unauthenticated | **PASS** | status 200 |
| `/api/cron/reminders` without `CRON_SECRET` | **PASS** | status 401 |
| Credentials login Tenant A (`rls-e2e-a@example.test`) | **PASS** | callback 302, session 200, user present (`tmp/minimal-http-proof.cjs`) |
| Credentials login Tenant B (`rls-e2e-b@example.test`) | **PASS** | callback 302, session 200, user present |

## Not Executed / Blocked
| Scenario | Result | Blocker/notes |
|---|---|---|
| Runtime DB identity via live Next route | **FAIL/NOT CAPTURED** (evidence gap) | temp route compile/write issues; removed; rely on Prisma process proof |
| Register/verify/reset/change-unverified-email/logout OAuth/session refresh/onboarding HTTP | **NOT EXECUTED** | minimal proof only; PrismaAdapter/global auth complexity remains |
| Full tenant A/B CRUD HTTP matrix | **NOT EXECUTED** | needs authenticated API calls per resource + schema-compatible fixtures |
| Admin HTTP (normal/company admin/ADMIN/SUPERADMIN, proof/actions) | **NOT EXECUTED** | `admin-actions` runtime not fully migrated/validated |
| Financial HTTP (draft->issue->PDF->payment->balance/history) | **NOT EXECUTED** | 5437 schema drift/fixtures/runtime scope |
| WMS HTTP full flows | **NOT EXECUTED** | out of minimal scope; preserve WMS work |
| Playwright full suite execution | **NOT EXECUTED** | minimal Node HTTP probes used; Playwright config/spec artifacts exist locally/uncommitted as needed |
| PrismaAdapter compatibility under active RLS | **NOT EXECUTED/AT RISK** | adapter uses global Prisma; Account/Session/VerificationToken/EmailActionToken RLS-off prototype on 5437; credentials/JWT flows passed minimally |

## Preserved DB evidence (rerun)
- **19/19 PASS**, **60/60 PASS**, **5/5 PASS** (`tmp/rls-runtime-phase-19/60/exec.txt`).

## Conclusion
Minimal HTTP runtime/auth/cron-guard proof **PASS** on isolated 3018 with 5437-targeted NOBYPASSRLS env and synthetic fixtures. **This is not sufficient for production readiness**; full HTTP isolation, admin, financial, WMS, adapter compatibility, and Supabase pooling remain unproven.
