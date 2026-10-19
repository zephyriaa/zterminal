# Phase 00–11A publication

This release publishes the accumulated browser-terminal repairs from Phase 00 through the partial Phase 11A implementation. The production target is the existing Cloudflare Worker `zterminal-web` at https://zterminal.dpdns.org, using its existing Supabase configuration. No database migration is included.

The candidate starts from production main (`5948ebc9fda8ba8a8579e18b77060f180e9e8c8e`). Phase patches identify the repaired files; required source dependencies and Monaco build scripts are included. Unrelated native Windows changes and unpublished desktop commits remain in the original checkout. Desktop commands and licensing fields retain production-main values.

Repairs cover market identity/provenance, stream readiness/recovery, bounded historical ranges, editor assets and fallback, Helper compatibility/cancellation/dataset ownership, chart/replay boundaries, drawing interaction, indicator calculations and bounded order-flow studies. The archived phase reports describe the evidence and unresolved acceptance boundaries at each point in time; statements that publication was unauthorized are historical and superseded by the user's subsequent publication/deployment instruction. Local artifact paths in those reports refer to retained evidence in the development checkout and are not hosted resources.

The verified Helper candidate is published separately as `helper-v1.1.0-preview.1`. `helper-manifest.json` identifies the exact bytes and required capabilities. The package's ten application modules match the candidate sources after line-ending normalization. It is an unsigned Windows preview; no claim of completed browser pairing/permission acceptance is added by publication.

The obsolete Render/VPS deployment job is removed. The deployment workflow continues to build and publish the existing Cloudflare Worker; CI now generates Prisma before tests, uses Node 22 and bounds test concurrency. The quality workflow additionally assembles the Cloudflare Worker on Linux, where the adapter's required symlinks are supported.

## Acceptance boundaries

The isolated candidate passes all 339 TypeScript tests and typechecking. Full lint, production assembly and remote deployment results are recorded in the publication report retained by the publishing chat. These checks do not certify all product journeys.

Phase 11 remains IN PROGRESS. Sustained browser performance, full market admission, complete session/anchored study semantics, recording/replay and later milestones remain open. The previous production market-health endpoint was unavailable; the long-running Node gateway repaired in source has no identified production deployment target in the Cloudflare-only setup. Publishing the web Worker does not deploy that process. Unsupported live inputs remain explicitly unavailable. No exchange orders or personal workspace/database modifications are part of this release.

Rollback target: the prior Git main commit above and the Cloudflare Worker version recorded immediately before deployment. Helper release records are immutable by hash; rollback restores the previous web manifest rather than replacing package bytes.
