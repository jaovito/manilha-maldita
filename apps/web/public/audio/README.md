# Match result music

Original compositions and arrangements approved on 2026-10-26. These are the approved short previews, copied without further audio changes. Both files last 3.85 seconds, including their final fade/reverb tail.

| File | Cue | SHA-256 |
|---|---|---|
| `match-victory.mp3` | Victory | `2dc8d11f49e04c06695bc75fb33e3fc9859173d7315b24b177e58cee10adfa75` |
| `match-defeat.mp3` | Defeat | `36972be1a6cf04cee7c68843b97fe94fd0c8f215c38b627496c04c8e1ba65097` |

The victory fanfare uses a rising trumpet melody, horns, strings and percussion. The defeat cue uses a descending minor horn melody, low brass and strings. Both were rendered offline using AVAudioUnitSampler and the macOS system General MIDI bank, with medium-hall reverb. The instrument bank itself is not copied/distributed, and no external song was transcribed or sampled. The original arrangement is preserved in [render-results.swift](../../../../docs/audio/render-results.swift). These are synthesized instrumental recordings, not live musicians or music-model output.

Processing: high-pass at 45 Hz, FFmpeg loudnorm target -17 LUFS / -1.5 dBTP / LRA 8, final fade from 3.15 to 3.85 seconds, 44.1 kHz stereo and LAME quality 2 MP3. Other cues continue to use the existing Web Audio synthesizer. Result files preload once per gesture-unlocked AudioContext from same-origin fixed paths, without player data or external audio services.
