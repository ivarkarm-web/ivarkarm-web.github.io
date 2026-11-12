# Audio Asset Inventory and Licensing

**Last audited:** 2026-10-30
**Scope:** audio assets shipped or requested by Pionier.

## Owner rights declaration (recorded, not independently verified)

The owner declares/confirms that the audio code and embedded audio assets shipped in Pionier are their own or appropriately cleared for public/commercial distribution, and that any externally streamed/linked owner recordings in scope have the necessary distribution/streaming rights as presented. **This is an owner declaration, not independent legal verification.** Documented evidence, provenance, and any required attribution/terms must still be maintained for assets actually shipped or distributed.

## Current audio architecture

Pionier's playable instruments are generated locally with procedural synthesis using the Web Audio API. No handpan note-sample packs, chopped WAV one-shots, sample manifests, or third-party instrument recordings are shipped.

User-created looper recordings are captured locally in the browser from live app output; they are user-created local content, not bundled or shipped assets.

## Audio categories

- **Procedurally generated Web Audio instruments and ambience:** synthesized at runtime in the browser (no bundled note-sample packs or shipped instrument recordings).
- **Owner-created or owner-controlled material:** where applicable, such material must be identified with its source/provenance and rights status. Do not imply rights beyond what is documented or declared.
- **Externally streamed material (where applicable):** for example, **Bedroom Sessions** is referenced as Ivar Karm's owner-recorded soundscape collection streamed from its archive.org source. Such streams are **not** copied into the app repository, **not** bundled with the Pionier app, and **not** included in the service-worker shell; external streaming is distinct from Pionier's own bundled/local assets and storage.
- **Third-party assets:** no third-party audio assets may be included without appropriate permission, documented license/attribution/redistribution rights, and an explicit product decision. Do not restore or introduce any third-party audio assets.

## Historical note-sample packs

Previous revisions contained owner-recorded handpan one-shots and per-scale chopped recordings under `handpan-app/sounds/notes/`. These assets and their runtime loader were removed in v195 to keep the app synthesized-only and avoid a hidden sample dependency. The files remain available in Git history if the owner ever chooses to revisit that direction.

Earlier third-party Haganenote-attributed samples were removed because redistribution rights were not established. They must not be restored from history.

## Rules for future audio assets

Before adding any prerecorded audio, document its creator, source, license, commercial-use permission, redistribution rights, attribution requirements, and whether it is bundled or streamed. Do not add sample packs or external audio files without an explicit product decision. Do not imply that external streams are part of the bundled app.
