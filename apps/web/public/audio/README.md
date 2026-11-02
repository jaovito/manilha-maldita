# Match result music

Original compositions and arrangements approved on 2026-10-26. These are the approved short previews, copied without further audio changes. Both files last 3.85 seconds, including their final fade/reverb tail.

| File | Cue | SHA-256 |
|---|---|---|
| `match-victory.mp3` | Victory | `2dc8d11f49e04c06695bc75fb33e3fc9859173d7315b24b177e58cee10adfa75` |
| `match-defeat.mp3` | Defeat | `36972be1a6cf04cee7c68843b97fe94fd0c8f215c38b627496c04c8e1ba65097` |

The victory fanfare uses a rising trumpet melody, horns, strings and percussion. The defeat cue uses a descending minor horn melody, low brass and strings. Both were rendered offline using AVAudioUnitSampler and the macOS system General MIDI bank, with medium-hall reverb. The instrument bank itself is not copied/distributed, and no external song was transcribed or sampled. The original arrangement is preserved in [render-results.swift](../../../../docs/audio/render-results.swift). These are synthesized instrumental recordings, not live musicians or music-model output.

Processing: high-pass at 45 Hz, FFmpeg loudnorm target -17 LUFS / -1.5 dBTP / LRA 8, final fade from 3.15 to 3.85 seconds, 44.1 kHz stereo and LAME quality 2 MP3. Other cues continue to use the existing Web Audio synthesizer. Result files preload once per gesture-unlocked AudioContext from same-origin fixed paths, without player data or external audio services.

## Asset rights and redistribution review

The owner chose on 2026-10-30 to preserve original artwork/audio without an open reuse license. See [NOTICE](../../../../NOTICE.md) for the rights-reserved scope and exceptions, and the [M6 inventory](../../../../docs/assets-audit-m6.md) for hashes, source notices and unresolved third-party reference/rendering-bank evidence. Separate permission is required where applicable; this notice does not establish ownership or clear third-party rights.

## Rendering-bank review - 2026-10-31

The local CoreAudio `gs_instruments.dls` metadata identifies Roland Corporation (1997). This is attribution evidence, not a license grant; the bank remains part of the operating system and has not been copied into this repository. The reviewed host runs macOS Tahoe 26.6.2. The [macOS Tahoe agreement](https://www.apple.com/legal/sla/docs/macOSTahoe.pdf) and [Apple's Logic Pro/MainStage content explanation](https://support.apple.com/en-mide/101908) were consulted. The latter concerns those applications' content and is not treated as proof of permission for this CoreAudio bank. The applicable recording-distribution evidence remains open in #9; this review does not conclude that use is either cleared or prohibited.
