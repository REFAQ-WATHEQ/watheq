# Foundation phase

## First-administrator initialization
- [x] Inspect live role grants, procedures and three current linter warnings; identify privileged role writes, TRUNCATE grants, audit gaps and propose an owner-only one-time bootstrap. No account roles changed.
- [x] Implement approved private owner-only UUID bootstrap, consumed state, audit attribution and role/audit privilege restrictions. 24 actual isolated PostgreSQL/PostgREST tests plus 36 regressions passed; live effective grants checked and zero admins preserved. See BOOTSTRAP-VERIFICATION.md.
- [x] First administrator initialized by the owner (bootstrap consumed, audit recorded). Never re-run.

# Document library
- [x] Prepare revised trial drafts: rechecked confirmed ordinary A/B with no employee/group/category assignments; created three unpublished restricted drafts (50afa961-b024-4ab7-bbdd-ebcd11f2b49a, 4b34d420-8099-4972-a2b4-1174dab6e361, cfd899dd-005e-4887-86f3-32e7376623e8) reusing the existing test PDF, fresh verification deliberately pending; created empty group f1d50e06-4224-4014-8b85-a72d64189379. No original document, account assignment or administrator role changed; no exception created or activated.
- [x] Prepare inactive exception and isolated database tests: owner confirmed the file is nonsensitive and approved exact scope on 2026-10-24; all three formats freshly verified ok at 05:53 UTC. Private pinned manifest and owner-only one-shot window installed; 82 database and 20 delivery tests passed. Live read-back confirms NULL start/end, three unpublished drafts and unchanged ordinary A/B without assignments; general restricted publishing remains blocked. See DOCUMENT-ACCESS-TRIAL.md.
- [ ] Execute revised two-account sequential trial. Blockers: owner-prepared separate A/B/admin/visitor sessions and explicit actual-start approval. Two hours start only at actual trial; guide owner one step at a time. Preserve general restricted-publication block; actual sign-ins remain owner-driven on external Supabase (no credentials in chat).
- [x] Owner confirmed second independent Arabic PDF preview, download and counters succeeded on 2026-10-24; confirmation is not an assistant-observed run.
- [x] Current preview latency: five same-file baseline/final runs (6,033,984 bytes), median 9.712s → 8.134s (16.24%); separate numeric timing spans, narrow fresh Drive metadata, credential-keyed token reuse, concurrent final checks, unchanged cancellation/counters. Progressive transport tested in isolation, not enabled: same file still needs full receipt and protected final checks. See PDF-PERFORMANCE.md; Arabic-file/actual-account/hosting gaps remain pending and restricted publishing stays blocked.
- [x] Current PDF repair: proved browser font-face discrepancy against embedded outlines and independent local renders; isolated selectable text, bounded current-page zoom, cancellation/retry, timing and real 51-page Arabic document verified. Source bytes unchanged; restricted publishing blocked.
- [ ] PDF comparison gaps: direct Google Drive viewer comparison needs owner's visual confirmation; cross-account preview checks need owner-driven actual sign-ins on external Supabase. Second Arabic PDF success confirmed by owner. No public sharing or role changes requested.
- [x] Stage 5 part 2 implementation: fresh protected Drive delivery, internal PDF preview, idempotent usage totals and staff event history; real public PDF preview, pagination, download and count increment verified on desktop/mobile.
- [ ] Stage 5 part 2 restricted release verification: signed-in user/employee/staff delivery and staff event history require approved real-account sessions on external Supabase. Keep restricted publishing blocked; isolated tests are not authenticated application end-to-end evidence.
- [x] Stage 1: statuses, 12 topics, 10 types, tags, Drive formats table, usage events; normalized topic uniqueness. Tests passed.
- [x] Stage 2: descriptions, delete protection, cycle prevention, normalized type/tag uniqueness, visitor-scoped counts, taxonomy admin UI, library page.
- [ ] Manual staff verification of taxonomy admin in preview. Blocker: needs the owner's signed-in session.
- [x] Stage 3: document admin list/search/filter, create/edit, multi-format Drive references, draft/archive/restore, publish checks (restricted publishing blocked until secure delivery). 51 library + 50 automated + 24 admin tests pass.
- [ ] Manual staff test of document admin in preview. Blocker: owner's signed-in session.
- [x] Stage 4: visitor library cards, details page, search/filter/sort/pages in link, permission-aware counts.
- [ ] Manual signed-in check of library and details (user/employee/staff). Blocker: owner's session.
- [ ] Before launch: fix 3 security warnings (definer function exposure x2, leaked-password protection).
- [x] Stage 5 part 1 (code): service-account Drive check, staff-only verify button, stored results reset on link change. Tests pass with simulated Drive.
- [x] Stage 5 part 1 (setup): owner saved service account and approved library folder secrets, and confirmed a real non-sensitive file check succeeded.
- [ ] Verify the application server function and administrator UI with approved real accounts after initialization. Blocker: external unmanaged Supabase has no available authenticated test session and no approved active administrator; isolated PostgREST tests do not cover the application server endpoint.

## Multiple platform administrators
- [x] Inspect existing roles and live database, and prepare a minimal modification plan; no application or database changes. Multiple admins already supported; zero current admins; last-active-admin protection and audit absent.
- [x] Implement administrator listing and confirmation controls, caller-scoped atomic role mutation, last-active-admin guards and append-only audit logging. No existing roles changed; 36 local tests pass; public route redirects signed-out visitors; no new database linter warnings.
- [ ] Verify authenticated administrator assignment/revocation, audit UI, concurrent requests and account-deletion protection with approved actual accounts. Blocker: zero current admins, no approved bootstrap account or managed external-Supabase test session; authenticated path UNVERIFIED.

## Employee and content access
- [x] Add independent administrator-managed employee designation and account display.
- [x] Add common content audiences, category membership, protected reads/search/file requests.
- [x] Verify administrator grant/revoke, account persistence, four audiences, protected files, search filtering and blocked user/supervisor employee writes with temporary real accounts; 28 automated tests pass. Detailed courses/documents remain deferred; not published.

## Revio presentation update
- [x] Apply the approved Revio-inspired public presentation, preserving identity and existing account behavior.
- [x] Verify navigation, search, loaded artwork, desktop/mobile presentation, and 20 existing tests without public publishing.

- [x] Inspect and store the three supplied REFAQ logo variants without altering colors or proportions; retain both Wathiq logos.
- [x] Verify external Supabase binding to WATHEQ inside REFAQ. User confirmed ref vfndtiiztccebdfkaxaq and Healthy status on 2026-10-18.
- [x] Implement Arabic RTL shell, all component routes, initial home page and explicit empty content states.
- [x] Implement required account data, separate roles, categories, groups, private memberships, RLS and explicit GRANTs.
- [x] Implement association branding, searchable Arabic font settings, previews, reset and private logo storage.
- [x] Verify real user/supervisor/admin login and logout, private profile edit persistence, cross-user privacy, blocked role/membership writes, staff font/logo persistence, groups/membership management and admin role grant/revoke. All temporary accounts removed; 20 automated tests pass; desktop/mobile RTL checked.
- [ ] Owner creates and confirms their real account, then explicitly bootstraps the first admin using the documented SQL. Blocker: owner identity not yet supplied; no automatic admin.
- [ ] Owner adds the preview /auth callback to Supabase redirect URLs and configures Google OAuth. Blocker: external Supabase/Google settings require owner intervention; Google currently disabled.
- [ ] Verify real email delivery, confirmation link and password-recovery completion. Blocker: a real inbox and permitted redirect settings are needed; placeholder-domain signup was rejected by the email service. Forms and calls implemented, delivery not claimed.

Remaining components, video, AI, domain integration, and public publishing are outside this phase.
