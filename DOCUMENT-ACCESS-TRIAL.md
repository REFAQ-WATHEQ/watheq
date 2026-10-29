# Restricted document trial readiness — 2026-10-24

## Prepared, not activated
- Owner confirmed the reused PDF is nonsensitive and approved preparation of the exact scope.
- All three actual format records verified successfully at 05:53 UTC; each reports application/pdf and 3,691,274 bytes.
- Private exception manifest pins the three document/format tuples and current Drive IDs; the latter are not included in this report.
- Registered: `50afa961-b024-4ab7-bbdd-ebcd11f2b49a` / `d47c691f-dc89-42cc-9844-879c1c017b63`.
- Employees: `4b34d420-8099-4972-a2b4-1174dab6e361` / `e39d0c09-a9c0-43c7-9342-9de03848d674`.
- Targeted group: `cfd899dd-005e-4887-86f3-32e7376623e8` / `e0fa9bbf-0311-4fd1-87c0-377d5cfbe005`, group `f1d50e06-4224-4014-8b85-a72d64189379`.
- Reader scope is A `3fb9c14e-521a-4acc-979a-a87ae62457cd` and B `85801bbd-ec21-460b-979d-169c2e9fbc07`, conjoined with the real audience requirement; it is not an audience bypass.
- Read-only live readiness check after migrations: all three documents remain unpublished drafts; start/end/stop are NULL; A/B remain confirmed users without employee status or group memberships. General `secure_delivery_ready()` still returns false. No account roles, designations, memberships or original administrator rights changed.

## Isolated evidence
- `bash scripts/test-library.sh`: 82 passed, including 14 trial tests. These run all real application migrations against a disposable loopback PostgreSQL database, not production.
- `bunx vitest run src/test/document-delivery.test.ts`: 20 passed; unchanged delivery tests cover fresh revocation and mapping changes after receipt, no accepted usage on denial, cancellation and private delivery behavior.
- Expiry test initially exposed statement-start timestamp behavior when multiple statements arrive in one request. Authorization now uses wall-clock evaluation; rerun passes even with a transaction/request started before expiry.
- Trial tests cover inactive defaults, owner-only window writes, 7,200-second duration, no extension/restart, tester/visitor/unrelated-account scope, sequential employee/group grants and revocation, search/result counts/related/format/usage filtering, other restricted-document publication refusal, mapping/additional-file/audience integrity, immediate stop and expiry.
- These are database and simulated delivery checks, not observed real-account application results. No authenticated browser sessions are available for this external Supabase project.
- Existing three security warnings predate this work: two definer-function exposure findings and leaked-password protection disabled. No new migration findings reported; address separately before launch.

## Next owner step only
Prepare separate sessions for A, B, an existing administrator, and a signed-out Watheq visitor; confirm readiness without sending credentials. Do not grant employee/group assignments or publish documents yet.

## Later actual start — pending explicit approval
Recheck account and manifest integrity, then record an owner-approved, one-shot start and exact end two hours later; publish only the three approved documents in the same transaction. Record UTC/Riyadh timestamps and baseline counters. No automatic start occurred during preparation.
Expiry/stop denies fresh reader access without a cleanup job; afterward explicitly return the documents to drafts and remove only trial assignments, with read-back verification. The configured window cannot be restarted or extended. Scope records stay pinned so expired documents cannot become generally readable by simply changing audience. Fresh Drive scope/type/download checks and bounded delivery remain unchanged. File-ID pinning does not guarantee immutable Drive bytes; maintain the nonsensitive source without modification during the trial.
Real-account matrix, open-page revocation, counter comparisons, cleanup, restricted-release adoption and public publishing remain pending. Already delivered bytes cannot be retracted.
