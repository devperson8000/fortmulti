# Beat-synced sealed-pod landing

The capsule accelerates into the returning bass drop, compresses its landing gear, and throws earth chunks and expanding dust upward. A downward camera punch, damped vibration, a short FOV kick and fading ground rings accompany the hit. Reduced-motion mode suppresses the camera punch, vibration, FOV kick and gear compression. The burst reuses the effect pool and respects each quality preset's remaining particle budget.

The capsule remains fully opaque through descent and impact. Rear armor now sits behind the operator; continuous back, side, roof and floor plates enclose the interior. The opaque front doors reveal the operator only after opening. Camera framing uses the entire 3.82 m capsule, including its roof, and landing reservations include the enlarged exterior camera radius.

After touchdown, the sequence holds for 1.05 s, opens the hatch over 1.45 s, walks the operator out over 2.40 s and holds/lowers the native two-finger salute over 2.20 s. The camera returns over the last 850 ms. Scripted movement clears stale ship locomotion. Each client keeps combat locked until its own audible ending completes, including when an early host gameplay snapshot or a buffered audio ending arrives.

## Audio measurements and continuity

The latest uploaded `hunumankind.mp3` is identical to the original source (SHA-256 `25854edb2b1d44347ee4bf3197fe2135d7dee547726867a28ec87373d340a6da`). The complete 30 s edited WAV was re-encoded at 192 kbps, retaining the existing “the stunts in this game” replacement. Song-relative cues are shared by audio, camera and authoritative deployment timing.

| Event | Cue | Measurement |
| --- | ---: | --- |
| First “uh” / HORIZON reveal | 9.590 s | Accompaniment-subtracted vocal onset, approximately ±20 ms |
| Opening lyric / logo dissolve | 20.190 s | Existing lyric onset, approximately ±80 ms |
| “When” / exterior camera established | 23.550 s | Existing lyric onset, approximately ±80 ms |
| Returning kick/bass / pod impact | 25.285 s | Waveform onset, approximately ±10 ms |
| “Big” | 25.580 s | Lyric onset after the musical drop |
| “stepper” | 25.770 s | Lyric onset |
| Fade complete / gameplay handoff | 32.385 s | Shared release timeline |

All 30 s of the supplied song play before a 120 ms crossfade into an instrumental continuation. The loop is exactly eight beats at 90 BPM, source samples 173578–408778 exclusive at 44.1 kHz. Its 20 ms end blend preserves the 5.333333 s period. Late recovery follows the remaining global fade level and stops at the original deadline. Final render completion retains the audible clock through speaker output latency.

The salute solves the shipped Soldier's actual Index3/Middle3 fingertip geometry onto a measured head-relative helmet target using the existing arm solver. It preserves native bone lengths and blends from the current mixer pose; no Index4/Middle4 bones are assumed.

## Fresh verification

- `npm run check`: syntax, 276 unit/integration tests and static build passed.
- `scripts/deployment-framing-check.mjs`: 9 browser checks passed. The complete closed capsule fits desktop, compact, ultrawide and portrait views; opening, walkout and salute remain visible; delayed snapshots and authoritative gameplay handoff pass. No browser errors.
- `scripts/deployment-cinematic-check.mjs`: 8 checks passed with two actual local network clients and native WebAudio. Closed descent/impact, title onset, hatch reveal, walkout, salute, finite music sources and continuous return to first person were checked. Final-run first logo frames were 9.601/9.608 s; visible impact frames were 25.324/25.329 s, 39/44 ms after the measured bass cue. These delays include headless frame scheduling.
- `npm run test:browser`: all 19 existing inventory, chest, reload, crouch and slide checks passed. No browser errors. Slowest measured local inventory move was 3.3 ms.
- Native OfflineAudioContext renders at 44.1/48 kHz preserve the loop period, contain no clipping and end at the cue. Eight late-start cases contain no nonzero samples after the deadline. The 44.1 kHz preview soundtrack peaks at 0.88 and ends with exactly one second of silence.
- Regression tests were observed failing before the fixes for full-verse playback, finite descent/impact effects, concealed operator, stale locomotion, helmet contact, late fade recovery and buffered audio completion. Actual Soldier geometry is checked at three headings and repeated zero-time poses.
- Independent code review found and verified the native-finger and buffered-ending fixes; its final 51 focused tests and replacement/cancellation/suspension lifecycle probes passed.

Evidence is under `/workspace/fortmulti-artifacts/deployment-impact/`: timing plots/JSON in `audio`, phase screenshots and two-client diagnostics in `cinematic`, four-aspect framing and handoff results in `framing`, and the existing-feature browser results in `regression`. The downloadable MP4 uses captured browser video plus a native OfflineAudioContext render of the runtime music; it excludes impact SFX. Its logo alignment uses 25 fps recorded frames, with approximately 40 ms quantization uncertainty.

These checks use local BroadcastChannel networking and software-rendered Chromium. They do not verify a production Vercel deployment, Supabase credentials or performance on every device.
