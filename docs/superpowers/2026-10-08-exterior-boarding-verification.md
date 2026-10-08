# Exterior boarding and continuous-song verification — 2026-10-08

Replaces the earlier deployment implementation on main, per the user’s explicit override request. Retains the newer main’s automatic multiplayer input activation and GitHub Actions checks. The final commit is based on origin/main `20582fc`; no force push is needed.

## Result

Pressing E switches to an exterior shot and animates the native Soldier through the front hatch. Side approaches route around the open door wings and armor. Walking finishes before the doors close. The closed capsule stays on camera while waiting for the squad. Both ready players trigger sliding floor hatches and downward acceleration through real deck apertures before blackout. Boarding paths leave 0.42 m body clearance from ship furniture at all eight pods.

The existing sealed-pod descent and bass-drop impact remain at song time 25.285 s. HORIZON visibly fades in over 0.7 s from the measured first “uh” at 9.590 s. After impact, the hatch opens and the operator walks out. A front-facing camera holds a clearly raised native two-finger salute. The supplied 30-second clip plays forward once, fading over the last 0.4 s and handing control to gameplay at 29.835 s. Earlier song sections are never repeated.

## Executed checks

- `npm run check`: syntax, **284 tests passing**, and production build; no failures or skipped tests.
- `scripts/deployment-cinematic-check.mjs`: **14 passing checks** across two real Chromium clients using local BroadcastChannel transport. Real visible-map selections, WASD ship movement, E-key boarding, stationary sealed wait, floor ejection before black, lyric cues, touchdown, frontal salute, and gameplay controls. Zero browser runtime errors.
- `scripts/deployment-framing-check.mjs`: **13 passing checks**, including closed-pod framing and the complete skinned Soldier’s salute at 1280×720, 800×600, 2100×900 and 540×960. Also verifies late snapshot camera handoff and that gameplay waits for authority.
- `scripts/deployment-audio-check.mjs`: **10 native OfflineAudioContext cases** at 44.1 and 48 kHz. Includes full playback, recovery during the walkout and three final-fade recovery offsets. One non-looping source, exact deadline, no clipping, and zero audio samples after the deadline.
- Gameplay regression browser script: **19 passing checks**, including immediate inventory swaps, held-E chest opening, sampled shotgun reloads, crouch toggle and tap-to-slide. Zero runtime errors.
- Source/generated parity verified for all ten changed/dependent production assets, including unchanged original deployment MP3.
- Review issues fixed and regression verified: dead pod owner reused by another player; stale progress after re-entry; entry framing; side-armor intersection; adjacent furniture clearance. The side-path regression failed before the route fix and passes afterwards.

## Measured limits and evidence

Local Chromium uses software WebGL. These checks establish the local two-player workflow; production Supabase transport and a deployed Vercel site were not verified. GitHub Actions repeats the complete browser journey and native audio continuity checks.

Native rendered sample difference from the forward original at gain 0.65: maximum **5.36441803e-08**. Maximum audio peak **0.708382**; post-deadline peak **0**.

Final software-browser visible touchdown delays from the measured bass cue: 63.1 ms, 36.9 ms. The common audible clock drives the scene; visual cue delivery is limited by rendered frame cadence.

Artifacts: `/workspace/fortmulti-artifacts/deployment-boarding/`. The MP4 combines the actual final two-client browser video with the production music factory rendered in native OfflineAudioContext. The measured logo fade aligns the tracks at 25 fps (approximately 40 ms quantization). This review preview includes music; landing impact SFX are excluded. JSON records and screenshots are retained alongside the video.
