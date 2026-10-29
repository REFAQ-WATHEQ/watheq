# PDF preview latency — 2026-10-22

## Measurement scope
Real public Arabic document «دليل خدمات الرعاية للمستفيدين», 51 pages, unchanged original bytes: 6,033,984 bytes (6.034 MB / 5.755 MiB). Five consecutive baseline runs and five final runs on the same browser/localhost preview, 1280×1800. UI completion measured from clicking preview until the first-page rendered marker is observed; this is an upper bound including automation polling. This is not a published-host or authenticated-account benchmark.

| First-page observed latency | Before | Final |
|---|---:|---:|
| Median | 9.712 s | 8.134 s |
| Min–max | 8.713–10.258 s | 7.612–8.611 s |
| Five runs (s) | 10.258, 9.712, 8.713, 9.742, 9.192 | 8.134, 8.611, 8.082, 7.612, 8.150 |

Median improvement: 1.578 s / 16.24%. An earlier optimized batch had median 7.889 s and range 7.591–11.158 s; its slow sample spent 4.850 s awaiting Drive headers. Retain this outlier; final figures are not an SLA or proof of a provider-imposed minimum.

## Independent timing medians

| Step | Before (ms) | Final (ms) |
|---|---:|---:|
| Session setup (anonymous; no actual login validation) | 0.3 | 0.3 |
| Caller-scoped published document query | 180.2 | 200.1 |
| Saved format mapping | 178.3 | 164.4 |
| Google token acquisition | 21.8 | 0.2 |
| Initial narrow metadata and folder ancestry | 2199.6 | 1884.6 |
| Media request until headers | 1892.3 | 1842.4 |
| Headers until first nonempty body chunk | 3.0 | 1.7 |
| Body receipt/bounded assembly, including first chunk | 580.4 | 415.7 |
| Fresh post-receipt Drive check | 2194.8 | 1909.1 |
| Final database access/mapping check and response preparation | 399.8 | 214.2 |
| Complete server response to browser body transfer | 17.7 | 11.2 |

Medians of independent steps do not sum to the median total. First-byte wait from the Drive media request is header wait plus first-chunk wait (about 1.844 s final). Total Drive work median: 6.131 s final, versus 6.771 s baseline.

Final viewer marks separately measure blob-to-PDF-document readiness (median 215 ms, range 207–536 ms), and document readiness-to-first-page canvas plus selectable text completion (median 318 ms, range 295–404 ms). Baseline did not separately instrument these two spans; no invented before-render figures. Server completion to browser headers unexplained remainder median ~4 ms locally, not evidence about public hosting overhead. Actual signed-in session validation duration remains unmeasured.

## Changes and security
One narrow file metadata call per pre/post-receipt check, instead of two; only ancestor parent fields requested. Independent ancestor branches and final RLS/mapping reads run concurrently. Scope decisions remain fresh across requests and rechecked after receipt. Google tokens only are reused in isolate memory, keyed by a credential fingerprint, expiring 60 seconds early; cold isolates refresh normally. No files, audience results or association decisions cached. Validated actor reused inside the same request rather than a second auth lookup. Cancellation, 20 MiB/10 MiB bounded buffering, origin/Range refusal, no-store and idempotent usage preserved. Loading spinner added. Numeric Server-Timing spans and local viewer marks contain no Drive ids or credentials.

## Progressive-delivery experiment
Isolated browser test used the same original PDF, five buffered and five progressive runs with a controlled 600 ms delivery schedule. PDF.js progressive transport and no Range calls were used; the actual protected endpoint was not changed. Buffered median first page 1201 ms (1167–1456); progressive median 884 ms (867–969). Every progressive first page appeared after all bytes (~601 ms), not before full transfer. This shows overlapping parsing can help this synthetic schedule; it does not prove a real protected-delivery improvement. Actual final server-to-browser transfer takes only 10–13 ms. Sending Google bytes before post-receipt scope/RLS/association checks violates the existing release boundary. Therefore no streaming or Range architecture change was made.

## Verification and limitations
101 standard tests pass; bootstrap/database suites skip in the standard run. Separately, all 68 library PostgreSQL/PostgREST tests pass. Tests cover two fresh metadata calls, token reuse/expiry/credential rotation, changed MIME/trash/download capability and scope, revoked audience/mapping, limits and counters. Real browser: one file fetch across pagination/zoom, preview does not increment download requests, spinner visible, close aborts the real pending request, canvas removed and no page errors. Rendered leaf head has one unique title and one og:title.

Second independent Arabic PDF, actual cross-account session tests, direct Drive-viewer confirmation and restricted release verification remain blocked on supplied document/owner confirmation/approved real sessions. Restricted publishing stays blocked; platform not published; no production role/data changes or new service.

## Remaining delay and options
Drive metadata/ancestry and its final recheck remain ~3.8 s combined, media header wait median ~1.84 s (including a measured 4.85 s outlier in the earlier batch). These are measured external-request delays, not a documented unavoidable Drive floor. Public hosting has not been measured. No provider or paid service was added; current optimization requires no new service subscription.

Before further architecture changes: benchmark deployed private hosting only with owner approval; a smaller/optimized copy or alternate approved-folder placement needs an independent experiment and owner approval before changing originals/location. A private synchronized replica could trade Drive round trips for synchronization/revocation complexity, storage and egress costs; it conflicts with current fresh Drive verification unless explicitly redesigned. Exact cost cannot be quoted without storage volume, traffic and provider plan. No such service or replication was enabled.
