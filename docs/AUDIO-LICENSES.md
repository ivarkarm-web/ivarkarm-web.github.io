# Audio Asset Inventory and Licensing

**Last audited:** 2026-10-13  
**Scope:** audio files and generated audio used by Pionier in this repository.

## Current shipped audio

- **Instrument voices:** synthesized at runtime by JavaScript/Web Audio code in this repository. No handpan note recordings or third-party sample packs are shipped.
- **Bedroom Sessions:** the owner's recordings streamed from Internet Archive via the app's soundscapes player. Availability depends on the external host.
- **No lessons or user uploads.** No external audio license is claimed for the synthesized voices.

## Historical inventory — not shipped

The records below document prior experiments only. Their file paths and licensing notes are historical; they do not describe assets currently included in the app.

### Owner-recorded handpan prototype (2026-10-13)

Owner attestation. The nine handpan one-shots (D3–A4) were recorded by Ivar Karm and mixed in GarageBand using only its built-in effects (EQ, compression, reverb). No Apple Loops, Apple sampled instruments, third-party samples, loops or impulse responses are included. Ivar Karm holds all rights and permits embedding and distribution in this app.

Ring-outs in this prototype pass are truncated (~0.7s sequential takes). Synth fallback remains if a file is missing or fails to decode.

**Third-party plugin / impulse response / preset:** (none)

| File | Note | MIDI | SHA-256 | Creator | License | Commercial / redistribute |
|---|---|---:|---|---|---|---|
| `handpan-app/sounds/notes/owner-notes-9/D3_v1.wav` | D3 | 50 | `de2ac49f37683ff45b3cea73bc060522ac2834c22f2229e2c9cf20ab98028772` | Ivar Karm (owner recording) | Original; owner grants embed in this public app | Yes |
| `handpan-app/sounds/notes/owner-notes-9/A3_v1.wav` | A3 | 57 | `38fc0aa1db8ecc4986cd22d4efa15efe72882b485f0a28ee8e5be819b9c38005` | Ivar Karm (owner recording) | Original; owner grants embed in this public app | Yes |
| `handpan-app/sounds/notes/owner-notes-9/Bb3_v1.wav` | Bb3 | 58 | `26ca1e18ed9fc3abdcf36453cbd13edb58c3518c8e540eeb9425285a423039d0` | Ivar Karm (owner recording) | Original; owner grants embed in this public app | Yes |
| `handpan-app/sounds/notes/owner-notes-9/C4_v1.wav` | C4 | 60 | `3d584969328a84dfc23b378753d078d09a9263031265e3c3186cac7dcffcf3de` | Ivar Karm (owner recording) | Original; owner grants embed in this public app | Yes |
| `handpan-app/sounds/notes/owner-notes-9/D4_v1.wav` | D4 | 62 | `0a44d9352a901154f764c11c538c62e4c2c7e1388ee2ae07605b5bb7c6273d97` | Ivar Karm (owner recording) | Original; owner grants embed in this public app | Yes |
| `handpan-app/sounds/notes/owner-notes-9/E4_v1.wav` | E4 | 64 | `5b66436b328ad3fe6502eac54c72ed694423e644cc3860683fb604ba26cbe2a2` | Ivar Karm (owner recording) | Original; owner grants embed in this public app | Yes |
| `handpan-app/sounds/notes/owner-notes-9/F4_v1.wav` | F4 | 65 | `5b16cf19f0d366d10db43c253f04dc571c0585941875db92ae714f6e2ca10e9c` | Ivar Karm (owner recording) | Original; owner grants embed in this public app | Yes |
| `handpan-app/sounds/notes/owner-notes-9/G4_v1.wav` | G4 | 67 | `56899e2f7eb69a857d1d703b0ddac19631497256b961454c50b7d4a089e75c60` | Ivar Karm (owner recording) | Original; owner grants embed in this public app | Yes |
| `handpan-app/sounds/notes/owner-notes-9/A4_v1.wav` | A4 | 69 | `f4b87fb409768b906d7a7c0bbc7c646710d0ebb3970335adb553b06778aae6c0` | Ivar Karm (owner recording) | Original; owner grants embed in this public app | Yes |

Ambient beds remain procedural (no external recording files).

Do not add a downloaded third-party sound until source, creator, license, commercial-use, redistribution, and attribution are recorded here.

## Removed sample files — provenance record

Prior Haganenote-attributed MP3s were removed because redistribution rights were not established. See repository history and prior audit notes. Those files remain **not cleared**.

Source references (historical):
- Upstream project: https://github.com/haganenote/virtual-handpan
- Official virtual instrument: https://www.haganenote.com/vst/handpan-virtual-instrument.html

## Historical procedural-audio notes (verify against current implementation)

| Engine / sound | Source / author | License | Commercial use | Notes |
|---|---|---|---|---|
| Handpan fallback synthesis | Original code in this repository; Ivar Karm project | No external audio asset | No third-party recording is bundled | Synthetic approximation; not equivalent to a real recorded handpan |
| Backdrop ambient beds | Original Web Audio synthesis in `handpan-app/js/backdrop-player.js` | No external audio asset | No third-party recording is bundled | Procedural beds; generated noise loops use eased boundaries |

## Release blockers and options

- **Realistic handpan recordings:** owner prototype nine-note bank documented (truncated tails). Production path: re-record isolated full ring-outs. Haganenote files still not cleared.
- **External ambient beds:** prefer procedural or CC0 with full license text retained here.

<!-- chop:begin -->
### Chopped per-scale samples (auto-generated)

Cut from one owner-recorded multi-handpan session by `scripts/chop/chop_handpan.py`. Ivar Karm holds all rights and permits embedding and distribution in this app.

| File | Note | MIDI | SHA-256 | Source |
|---|---|---|---|---|
| `handpan-app/sounds/notes/aminor/A2_v1.wav` | A2 | 45 | `d4cabcbef443ddce2ff20a7e2cd751a7045502e569eeac0feae19b49bf84418b` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/aminor/E3_v1.wav` | E3 | 52 | `a1d131f430a34af4ef2cbbbce4408ddebbc04e5eb8b9273d37e6444748515c27` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/aminor/Gb3_v1.wav` | Gb3 | 54 | `e561623ea49d162779bbdab1e920d56a9eb1fb4b740e8bf2d0633c096080d9e1` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/aminor/G3_v1.wav` | G3 | 55 | `18e179de6d96905fbdd75091831c66efc64bfb80db98d50c796ec57cadb86cc5` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/aminor/A3_v1.wav` | A3 | 57 | `8eea9491a8f43b9e28911cacfc6ca223d74760e9314c165ee468abbcbddfe39e` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/aminor/B3_v1.wav` | B3 | 59 | `14a6b2750a370dd5c38da9898324e6c29e1423b1eba505e8dcf271cf316f80a5` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/aminor/C4_v1.wav` | C4 | 60 | `09a984c53d3dad3b3121f4c80c6408fa658232092060d573bd29d2b6d87208f4` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/aminor/D4_v1.wav` | D4 | 62 | `e7dd446a29691f19670bcade7022c54d0d7288f042ee568bb258e49708578f87` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/aminor/E4_v1.wav` | E4 | 64 | `efcfb34138f3704e97c41c78f2e9161a23d872b3f1c7256f56ebed15c431dbd2` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/c-pygmy/B2_v1.wav` | B2 | 47 | `55e19156d22cbf0e453dd4198eefe120af91a869be887ff9dc4d2cb36679031b` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/c-pygmy/Db3_v1.wav` | Db3 | 49 | `828c32724f0169c24677db1830221b67fdf6a44d080df2aaa81af4d5cf4e3f9d` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/c-pygmy/D3_v1.wav` | D3 | 50 | `1c6b386bf52dc1b566f5793bab7fdae8f237295ea7af71c0b9b33b25d3667db4` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/c-pygmy/E3_v1.wav` | E3 | 52 | `20bbe243b19d141246031032f63abd0a4d308b68e589b1c97d4e2bbfa09634ad` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/c-pygmy/Gb3_v1.wav` | Gb3 | 54 | `f05f47534fa4b6abfc2fd52509dae8ea8123e60dc405a843654df289b10f54bc` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/c-pygmy/Ab3_v1.wav` | Ab3 | 56 | `54034701652731b105caa0a220ff9fcccabf7fab7fab7294951b29fac144ff95` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/c-pygmy/A3_v1.wav` | A3 | 57 | `c4f8fc532c969f18dc04f15449a17ac02a71ef7cc969cc2807d20742e7e752ac` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/c-pygmy/Db4_v1.wav` | Db4 | 61 | `6ec6d56cc0597e0f0c12070d4facc2bbecf24f7d991569772c43c24cf7228cc6` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/c-pygmy/E4_v1.wav` | E4 | 64 | `415a197f2462caafce2d29fe8fd1ef831a73652f984404908b167b1bf452d4da` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/c-pygmy/Gb4_v1.wav` | Gb4 | 66 | `8f78e0617079a089efd4cd906fdab807b189a8778f782d29bc6c2c3c4b61edf8` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/c-pygmy/A4_v1.wav` | A4 | 69 | `b61dcd410e13c68f7df75c437f1daa8282acce0b055e25917e3dc9e10cbd931f` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/c-pygmy/E5_v1.wav` | E5 | 76 | `88f4f9d2829fcb9d8963a5b249e641dbf210c527c8d6464c65503eaa2b74a62f` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/chijaz/C3_v1.wav` | C3 | 48 | `669ca4657e7ed45f52f6adb8ee1636d1972b3d3540a60e64615acf11ea0b796f` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/chijaz/D3_v1.wav` | D3 | 50 | `2a424f6f73c9190665bd663fe9e2333f56eb64fece4788f8c994d8672eb084eb` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/chijaz/Eb3_v1.wav` | Eb3 | 51 | `55fe251ca25de80cc2581a6037799b3949c23ebdccb332605072030ee73fdeb3` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/chijaz/G3_v1.wav` | G3 | 55 | `ef0400b8d196df41b194847291cd2a8b24caeb8baaa8ff2b3e09409c4cb2d3ad` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/chijaz/Ab3_v1.wav` | Ab3 | 56 | `8cf2b1b3fb8e39a3fa3c2d0e080d43f8731a5321f3ce4d587da3b3e9baab2cc5` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/chijaz/B3_v1.wav` | B3 | 59 | `210a7aeb6706acfa6368c27cf78d7972e29f3483b5d3eac4a1de337e92b1b559` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/chijaz/C4_v1.wav` | C4 | 60 | `298d2377d6b957986d6749dbba923e6840a283cb95cc41b5dc1422ed63976ee1` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/chijaz/D4_v1.wav` | D4 | 62 | `0b97d266ca6c6354ba7cad8d25d22dbbb4c9a5cd6b6d1ccc66038297470298d0` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/chijaz/Eb4_v1.wav` | Eb4 | 63 | `9fc0d4e5828e1cc8e2eb0877da143d4c53c5159a7decb6c8e27622bbe3b235a4` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/chijaz/F4_v1.wav` | F4 | 65 | `775d68f0f9cbe4e0882a5854cb5aa9cffcd41619a38ac23363a7f14d85f1fd22` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/chijaz/G4_v1.wav` | G4 | 67 | `ca917df4410fb37807b577d38ea293f26016eb00cb2b2e94d29892fac6030f3e` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/chijaz/C5_v1.wav` | C5 | 72 | `9abf630b1a2bea43930505fb450cb6f5dfc944c8f8459d948a836333b5f92a3c` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/eamara/D3_v1.wav` | D3 | 50 | `da8f80a51fb4bd792ed00e342d682e3f0871a57bec1b2b06e3743a36454da7bd` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/eamara/E3_v1.wav` | E3 | 52 | `abec59d0f2a6a272f7749485be3848a0c0023694a817feefb84f81dae879ca02` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/eamara/B3_v1.wav` | B3 | 59 | `1fae868e6f539d237e148418f3954689df69bc2dd3373a2e68b377166efcd279` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/eamara/D4_v1.wav` | D4 | 62 | `9fd9aa890c8d176e11376d222fcca821206e355b2f31bebcf6852fba8d1d8fa6` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/eamara/E4_v1.wav` | E4 | 64 | `8a4ce54d9329b514d144fb5471a6b7e97f9a73e07c9a4d4a93bb54f1e9bd9a96` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/eamara/Gb4_v1.wav` | Gb4 | 66 | `3ea61feb486a82c55ac7ea1bf8e4f0fac2d93c3ec86cfa87502c8930edb004c1` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/eamara/G4_v1.wav` | G4 | 67 | `0c40f941c307b8ce037e713c523e6cac8cecd2c978b1fae207cdfab852ba9eee` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/eamara/A4_v1.wav` | A4 | 69 | `d9e31cc5c4c4294f02ac72eecf3cc559b1f657a132643d699dbbfe6214e3a6f6` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/eamara/B4_v1.wav` | B4 | 71 | `d95852583b423a2110075779fddb9a743a269a348b1557259f68b265c6e03f63` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/eamara/D5_v1.wav` | D5 | 74 | `62a40ea5c8843ef6489b627b61d41079267e0482c1b2a72a6bb00591dc1333d9` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/eamara/Gb5_v1.wav` | Gb5 | 78 | `bb3474581be31869d76e3b62091d950a04e3b292a632d67bf1ff3faf7cd5bf39` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/eamara/G5_v1.wav` | G5 | 79 | `a75104883efe874977128115fedeec2f605657c72c434c96460a57a99eab34a7` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/eamara/A5_v1.wav` | A5 | 81 | `02d29dd8eb4e34778dee83caf21556937249df991c14b3a40f90b387d75b90de` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/elasirena/Eb3_v1.wav` | Eb3 | 51 | `e9c9399150def1820523c49815080bf07fb7fc072c121b84a334cca0e09c74a6` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/elasirena/Bb3_v1.wav` | Bb3 | 58 | `dd34b65ea9566b8e79926fbfbacbcaaa898dfa24f54c83f6712f2c3d9a7264d6` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/elasirena/C4_v1.wav` | C4 | 60 | `e801bdc561240ae226811dc7797399c3b8930d5c15916fd7084174e084ec9a83` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/elasirena/Db4_v1.wav` | Db4 | 61 | `78888320d647e4b61b2bf6c50c0ee12e44a797ece83b329482187cbe4d99aaea` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/elasirena/Eb4_v1.wav` | Eb4 | 63 | `14a762fab42e92ea7170cbe73a01c9beac73e6fd205e06141c5c0c1f31bcf3e6` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/elasirena/F4_v1.wav` | F4 | 65 | `c3ee14452fd8a99daecc1dd5a433d196366c2b1bc91581e38954bcd16bda53b8` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/elasirena/Gb4_v1.wav` | Gb4 | 66 | `c7a8096aef516c40288af56c2cd85c006513ca6f2fe43d24945d2587913c9142` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/elasirena/Bb4_v1.wav` | Bb4 | 70 | `2f3eb61be262ad57a6cabbfe36e15e43c6f7d2316b17cf587ba410879f2d31ab` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/elasirena/C5_v1.wav` | C5 | 72 | `2e92441aad76628a7d8819d382ffda6c5e4a9221d5f7aca827406cb43fd2d64e` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/elasirena/Eb5_v1.wav` | Eb5 | 75 | `59c4083c22035223dfdb23f47d5b10b7b584a6ede73a702ef2e13b4fc1b3a6ea` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/elasirena/Gb5_v1.wav` | Gb5 | 78 | `63e77382328074f444553d8c66f66fedb06e67fb4980630614e43fed8b6944e9` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/esabye/E3_v1.wav` | E3 | 52 | `d55efe378cfdf1263565e667d96ecbb6df830665391abee98bff05ce4db0f70e` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/esabye/A3_v1.wav` | A3 | 57 | `b1750d29aaebfe5ba62e28e3fc55ed73194a2911ef757c8a9087ef1d9f8c4917` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/esabye/B3_v1.wav` | B3 | 59 | `50e48fa73c1b6cdd932bbbad118591e635031da1ab069fc2c2084c1eae566705` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/esabye/Db4_v1.wav` | Db4 | 61 | `c780740eb2c73e9a6d560f9af7121c9715ca2770f1171f397643233248dea472` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/esabye/Eb4_v1.wav` | Eb4 | 63 | `2ae59407fcca420124b5868cc509792ffc4990f2ca9cb697bc81f37ba90be8c5` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/esabye/E4_v1.wav` | E4 | 64 | `a8a835e6cd065f66a060996308d5941a5aeb2caeac9dd18f41dd1396ab413b92` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/esabye/Gb4_v1.wav` | Gb4 | 66 | `d96bb7c7cdc64026b92b35e2e5409cb42e6a4de85e0264292c36531f97008c9c` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/esabye/Ab4_v1.wav` | Ab4 | 68 | `a91cd2e7e69951d0ab1612b2d87e7b21d6bcb70e75f88de7248a1aebeb0cb950` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/esabye/B4_v1.wav` | B4 | 71 | `990f7be76c7d5a276f2e668f4bc212004ff3a03d46ad75f688b1fa61fd9e6f2a` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/esabye/Eb5_v1.wav` | Eb5 | 75 | `7dcab5737064d5e8e95e57c540d63d76c851e57b219f06b4336e0a60e32122fe` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/esabyeextended/E3_v1.wav` | E3 | 52 | `8072284d039a4ecf57892f26779adc2450061bc78c7a3b3678bb6a5d8578dcbb` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/esabyeextended/A3_v1.wav` | A3 | 57 | `c4686415af36d6c8fa9af7d611db8a2dd9f9ea036a6345ae6e0c95a4105662d8` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/esabyeextended/B3_v1.wav` | B3 | 59 | `799d4c678e0f3f453952d6a4438be8381a9d05e456e1126e9837dc776c31aedf` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/esabyeextended/Db4_v1.wav` | Db4 | 61 | `b6b1506f56bac5dfe292d420712b8775d0ac503f98532fb9d77f8f88df91db00` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/esabyeextended/Eb4_v1.wav` | Eb4 | 63 | `7bd27f190b217afcdae199513c8b1c05d0599eefbf608fdaed29bb45d25c9654` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/esabyeextended/E4_v1.wav` | E4 | 64 | `2559b1c080422c366be13935eba8ee41d31509148dedd98e6cdce533a4607258` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/esabyeextended/Gb4_v1.wav` | Gb4 | 66 | `f7890e2aa02e5c9bf1ced100ede43d66f31bcb03c05670e33fa0cdae36a17129` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/esabyeextended/Ab4_v1.wav` | Ab4 | 68 | `adade912581185dcac9c55a0cc742cba2dceaa4bbc9da5cc68244bd8df6a7b64` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/esabyeextended/B4_v1.wav` | B4 | 71 | `bf600a25cf0b049d7d13f2d96cfa19212d1c7daac5ed4166a2f1f0201d292574` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/esabyeextended/Eb5_v1.wav` | Eb5 | 75 | `b06422af006306ef3b669bdb3c8448ad93f45a695313154e3ab281a5cfdc4cf0` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/esabyeextended/E5_v1.wav` | E5 | 76 | `b03d9e583b4d1bd8ce1d2425d8020c4ff2b25fa16e46bfb8507df9c629424e0b` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/flowpygmy/F3_v1.wav` | F3 | 53 | `dea138fcb21204c45bc1547c89e86263ac763e65ce24f61e90f03d0ce064692c` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/flowpygmy/Ab3_v1.wav` | Ab3 | 56 | `e8398c94ff7572bb5b5b574ddb3c995c1279fe0bffc0dd04a6297354dfd48f33` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/flowpygmy/C4_v1.wav` | C4 | 60 | `6716812a64f064edf3fc117e2ca1888c3c4b71e3d29403ac608bf3a4eedef507` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/flowpygmy/F4_v1.wav` | F4 | 65 | `f71bafb428b4e0c132606ff1131811d1cb5b9e1ec5c77ee33075f43363b2259a` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/flowpygmy/G4_v1.wav` | G4 | 67 | `2ecb12ff6fb07cfb12258c8e0f140be1578653b5b9b61d59d046dd7bca4f33eb` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/flowpygmy/C5_v1.wav` | C5 | 72 | `107a2c9dca7c7eba9f19d6e0c05732553f737c9b23a00ab911a71ae22c818f7a` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/flowpygmy/G5_v1.wav` | G5 | 79 | `6c85e33c8ec52c6053e1312c82113ceb6c44f1e5873faec4bfd0ea70d37741f9` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/fmajor/F3_v1.wav` | F3 | 53 | `2b363cf733df6ecfbe8c2e2084899608208497ba8dc1cb31205a13d90ffbd0dc` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/fmajor/C4_v1.wav` | C4 | 60 | `2fa70529d314def69efde89127a1662545c143d9a71b216b75f030cf3d6f1ff9` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/fmajor/D4_v1.wav` | D4 | 62 | `6dc5fa3bb979b0eb2ed6e150c1dbe01e85ab2d4dc07836e77f8cb4e975bc7e78` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/fmajor/F4_v1.wav` | F4 | 65 | `c57e3d9855a3699dc269446468022fe64f2ba0fdb9098aa40b6b85f22d3982b5` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/fmajor/G4_v1.wav` | G4 | 67 | `c33e1e402653babf8565fb274e5726678fe384d16ea837ad004b016431c59acb` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/fmajor/A4_v1.wav` | A4 | 69 | `9a3fc0994acc9ad01e9733a958c4b937815b6208b6d9f034852cbde16cc0c604` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/fmajor/C5_v1.wav` | C5 | 72 | `644028d01fa7291b87367e2fd46b5db5361ffe849356a10b5d2c662e82591f22` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/fmajor/D5_v1.wav` | D5 | 74 | `48e626a7a60d4ed99a49d9e67f72f9d68eb135b7c8f88bb2b697384a2f7e0ec4` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/fmajor/F5_v1.wav` | F5 | 77 | `1992ac15fd6d5954430f4c21d4b7c0acc258d8b2f0ab34f92f000dd1ce8c5653` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/fminor/F3_v1.wav` | F3 | 53 | `f54c52844f26273a86e7cba4bc6af44c5297a3a0c25a8f8fa11366d0ca09fb1f` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/fminor/C4_v1.wav` | C4 | 60 | `f2b2524b327cb7866b93a563a31a650e970617574df0d08663bc96a484c51bcf` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/fminor/D4_v1.wav` | D4 | 62 | `caca685524bbeb7f5ac00f5f85a369d4de3d27be1c6e3ae88b601701eb94c59c` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/fminor/F4_v1.wav` | F4 | 65 | `6eb014e7da6c3c4955ac5482c9975bfbe520e0b18a712c8375e66fce1077157f` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/fminor/A4_v1.wav` | A4 | 69 | `07495d0dde171ef215f67f96d0f1f6433ce3d7d920b91879c18ad6084923f165` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/fminor/Bb4_v1.wav` | Bb4 | 70 | `925356fba0cd96a61aef9afcf5d3213aeb941f7feaf3cc1b7b4b9abf62c0860f` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/fminor/C5_v1.wav` | C5 | 72 | `6e9b5f0a27fc44d717b8bb6b45381611e818b3d8e4ecc5180961d1570bd0c97f` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/gakebono/G3_v1.wav` | G3 | 55 | `0d3f2a989b72c5c28f14053f40b91e779bc1a27922a90a84c1a65f5f8c4f9192` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/gakebono/C4_v1.wav` | C4 | 60 | `9ea3654eb784028379ec581db7ce2e280ec95da47335c3ffa44e4d24db6fd002` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/gakebono/D4_v1.wav` | D4 | 62 | `4bd27c9b2ada7c092324393a4324e54059c9f66f27854da2bc9d8a66e1307b31` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/gakebono/Eb4_v1.wav` | Eb4 | 63 | `1e3bb42b00253c1abb8c264709dc0964f36363ec56078a3b8784b163462d9cd3` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/gakebono/G4_v1.wav` | G4 | 67 | `b8546ed86b7fafc127685fe39179d1638d453d302505ea5e0f3036bda4783df0` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/gakebono/Ab4_v1.wav` | Ab4 | 68 | `b4b94b50dd944fdb1cc23c36e24940d22e1b680737fbe6d37da3ed62b15cc34e` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/gakebono/C5_v1.wav` | C5 | 72 | `3fae6473ee04b9df5146bd46e04642351fa17a843a56dfd7d832cb4d24c9a14f` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/gakebono/D5_v1.wav` | D5 | 74 | `317a663e42345e8b9e52e5d8ffe1e0420e039079782429d803a2d71104be9676` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/gakebono/Eb5_v1.wav` | Eb5 | 75 | `21f7ba83656456ce34fd5df5908e017bed78274e2d51f731ddd725d94835f504` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/gminor/E3_v1.wav` | E3 | 52 | `2079755d52b31bed1b023b6dcce48cb56e14c1ef2e4483e96a56ec9c3a34d34c` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/gminor/G3_v1.wav` | G3 | 55 | `e336259af8b27f2c1a1ebfa18d2025ffa41f28902e2f1aec4e21b8f369c4ee02` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/gminor/A3_v1.wav` | A3 | 57 | `b2bc1b62d17edc91631b646bc2ede9c374e824f9ddc782f1f51e8e32ee54c03d` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/gminor/B3_v1.wav` | B3 | 59 | `da3d72d05d9dc16e744aa144896f28e466ffec26ff7ff7386c9791b0a8891d91` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/gminor/C4_v1.wav` | C4 | 60 | `287e958adcacc5d15ddb19d85882496b6ae6943630d76f54496f72c5047c4bb4` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/gminor/D4_v1.wav` | D4 | 62 | `29c638bb665a5698e5b6168f482040953978700b461c389e07e9840061940dd2` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/gminor/E4_v1.wav` | E4 | 64 | `7be292e4c0da60f8fe300717451e657369fde8aaf2b024147ccf3f4feb56f0ca` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/gminor/Gb4_v1.wav` | Gb4 | 66 | `4e0c23858195303b5b29efbfed8391565f142d456f25b873b52c2a9818349c3c` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/gminor/A4_v1.wav` | A4 | 69 | `5f934a3eb0e7ef2227b0523007d1dec032aec3f7045966f62de6f065b7d7b876` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/gminor/B4_v1.wav` | B4 | 71 | `d26ef0554c2a85fd2d08971e8959552dfadbe41a735c3ef2b30edf0b5820342e` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/gminor/D5_v1.wav` | D5 | 74 | `b3638f793a073815ef0241a0f406a7c565dc277929fbe7a81e90601e14fc2c5f` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/gminor/E5_v1.wav` | E5 | 76 | `9ba5c3a06b0e91c0b0b9a7f7ddc0a0cc6efd19e4461b462b6c74a446f534237a` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/gminor/Gb5_v1.wav` | Gb5 | 78 | `4692d7bed0f01e103e31ad15f8985c73cd3ef06fe0323acb8bb3af7ba7116d2e` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/gminor/G5_v1.wav` | G5 | 79 | `ce301a3ade44d0d3d58b5f196be88534ae84eac8a4f855fb3f0e944d46258a7b` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/gminor/A5_v1.wav` | A5 | 81 | `da736e5fc91502c7c21aa4b0be3c0cf33d195f0458981bcbbb7d0dd5d6d427ca` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/gminor/D6_v1.wav` | D6 | 86 | `54f54c90f3e5a7808bef42a078ec0de0236cdc3ce3217904203fca9af3456f93` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/unknownscale/Bb3_v1.wav` | Bb3 | 58 | `7fd94ab5cef6d058ff034527c6ed8b6c986a5cecd2ea37e368a5f5b91e8199d5` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/unknownscale/C4_v1.wav` | C4 | 60 | `ac2d5f1df25414c297fea6eef7e02e3129f72baa815fd533f988a1c2da5d516d` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/unknownscale/Eb4_v1.wav` | Eb4 | 63 | `fb31328dbc2541abf08d91924429318bba3387fa3e4fef695757ed915e4dc738` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/unknownscale/F4_v1.wav` | F4 | 65 | `9d27492510230f1f4d8b32d3f740af02d063ef638341b7f4564ddc078887fc4b` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/unknownscale/Bb4_v1.wav` | Bb4 | 70 | `16e8fc575ebaf07e9ea1ed1a6cbac309c2e60ae8022d0c258f75f2b95e16de0c` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/unknownscale/C5_v1.wav` | C5 | 72 | `40675ffcdce91b362308cd55d98719ce7d76ddd4c45c99ad27a82dddf604bbd7` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/dkurdextended/D3_v1.wav` | D3 | 50 | `8e2d9bab5f51f594530cff1f45b0564a4e8786fd4133fac30c6a0c677b2f9c9c` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/dkurdextended/A3_v1.wav` | A3 | 57 | `1353d3909cffb86b4dbe881b534881d95ca66d7acbd9c45c78b1ad4e1d757449` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/dkurdextended/Bb3_v1.wav` | Bb3 | 58 | `150f71b8290acc0033205fb8e1da0268c4c5de51f3d80c86312152a4151ea484` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/dkurdextended/C4_v1.wav` | C4 | 60 | `714da3aff52392529bc2223952f70da3f7a004b4c5fb57d79be1659b4cd6056c` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/dkurdextended/D4_v1.wav` | D4 | 62 | `30232ebf3cfb2ae64377385baeebd338beb89700bcb4f55eafb00772e62e47c5` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/dkurdextended/F4_v1.wav` | F4 | 65 | `76d9b1f7d42dfcfeeca084e9aaa5392a754e1c03df562941b14597866f392d24` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/dkurdextended/A4_v1.wav` | A4 | 69 | `cb4829b75c92879b316546909dff940579b1082afc09dfb11848a6ebe0966ea8` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/dkurdextended/C5_v1.wav` | C5 | 72 | `a1368a15d9fb4ef4c3b981d1b7b509b4474b7ca3a5346dbde5989913175eaa75` | Ivar Karm (owner recording) |
| `handpan-app/sounds/notes/dkurdextended/D5_v1.wav` | D5 | 74 | `7302d0a3551e29ede7d718f78c0e98dfcb89a547ad8c0efef2f0102b3111630a` | Ivar Karm (owner recording) |
<!-- chop:end -->
