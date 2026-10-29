<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Foundation architecture
- Employee designation lives separately from roles/profiles; admin-checked server mutation alone uses the privileged employee setter, so it cannot confer management rights.
- Shared content records and file mappings use a private database audience helper for reads and user-scoped server queries for lists/search/details; file downloads proxy bytes with fresh RLS and no transferable URLs, preventing post-revocation link reuse.
- Targeted audiences match any explicitly assigned category or group membership; public content shells hydrate visitor-scoped queries without embedding restricted data in SSR or metadata.
- Keep foundation account, organization, brand, and permission logic in `src/features/foundation`; routes compose shared features to keep access rules consistent.
- Use public SSR routes for content and the client-gated `_authenticated` subtree for accounts and staff surfaces; local-storage sessions cannot authorize SSR loaders.
- All internal database actions run through TanStack server functions with user-scoped RLS; role replacement retains the caller session and rechecks active administrator authorization inside a serialized private database procedure, with role-table guards and atomic append-only administrator auditing.
- Store roles separately from private profiles, revoke browser role writes, and isolate definer role-check helpers in the non-exposed private schema to prevent escalation and recursive policies.
- Store replacement logos in a private storage bucket and persist stable object references; resolve temporary read URLs rather than storing expiring URLs.
- First-administrator initialization uses the private owner-only, permanently consumed bootstrap procedure with a separately approved verified UUID; never infer administrators from registration order, email matching or editable metadata, and never expose a service-role or public initializer.
- Run bootstrap security tests against a disposable loopback PostgreSQL cluster and PostgREST using scripts/test-bootstrap.sh; real application migrations supply all application objects, and production account role changes require separate approval.
- Restricted-document trials use an owner-only private one-shot window and exact document/format/audience manifest, conjoined with fresh ordinary audience checks; wall-clock expiry and mapping integrity fail closed without enabling general restricted publication.

## Public presentation
- Keep the public visual shell in the shared foundation Shell and home-specific presentation in the index route, using global semantic tokens; this updates the presentation without changing account, permission, or data behavior.
- Google Drive access uses one dedicated read-only service account on the server only (drive.server.ts); checks are limited to saved formats inside approved library folders, and only the server (service role) writes check results, so staff cannot forge them or probe other files.
- Reuse only credential-fingerprinted unexpired Google tokens in server-isolate memory with an expiry safety margin; never cache audience, association or Drive-scope decisions. Use one narrow metadata call per fresh pre/post-receipt check and parallel independent final database checks; expose only numeric timing names.
- Reader delivery resolves formats only after caller-scoped RLS, rechecks Drive and database association before releasing bounded bytes, and records service-only hashed idempotent usage; retain full bounded POST delivery rather than insecure or redundant Range slicing.
- PDF previews use matching bundled PDF.js/worker/resources, embedded outline rendering and isolated selectable text geometry; render only the current page with a pixel cap, cancel obsolete work, and scope temporary blobs to the mounted visitor identity. Downloads retain the separately counted preparation action.
