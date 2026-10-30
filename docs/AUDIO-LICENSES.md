# Audio Asset Inventory and Licensing

**Last audited:** 2026-10-30  
**Scope:** audio assets shipped or requested by Pionier.

## Current audio architecture

Pionier's playable instruments are generated locally with procedural synthesis using the Web Audio API. No handpan note-sample packs, chopped WAV one-shots, sample manifests, or third-party instrument recordings are shipped.

The only prerecorded music content is **Bedroom Sessions**, Ivar Karm's owner-recorded soundscape collection streamed from its archive.org source. Those tracks are not copied into the app repository or included in the service-worker shell.

The looper records the user's live app output locally in the browser; loop recordings are user-created content, not bundled assets.

## Historical note-sample packs

Previous revisions contained owner-recorded handpan one-shots and per-scale chopped recordings under `handpan-app/sounds/notes/`. These assets and their runtime loader were removed in v195 to keep the app synthesized-only and avoid a hidden sample dependency. The files remain available in Git history if the owner ever chooses to revisit that direction.

Earlier third-party Haganenote-attributed samples were removed because redistribution rights were not established. They must not be restored from history.

## Rules for future audio assets

Before adding any prerecorded audio, document its creator, source, license, commercial-use permission, redistribution rights, attribution requirements, and whether it is bundled or streamed. Do not add sample packs or external audio files without an explicit product decision.
