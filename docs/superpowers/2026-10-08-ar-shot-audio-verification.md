# AR audio verification

The uploaded `download.mp4` contains a 2.26-second burst. The AR uses only its final shot, extracted at 1.928 seconds with a 300 ms duration. The PCM sample retains the blast and decay, adds short boundary fades, and leaves amplitude headroom. Extraction settings are in `public/audio/README.md`. The original video and full burst are not shipped.

The engine preloads the encoded sample and decodes it when audio is enabled. A successful AR shot event creates one non-looping source using the cached buffer. Each bullet has its own voice, so automatic fire overlaps decay tails without restarting, queuing, or replaying the burst. Completed sources disconnect. Existing sounds remain the fallback if loading fails; other guns retain their sounds.

Validation on 2026-10-08:

- `npm run check`: syntax, all 220 unit tests, and static build passed; zero failures or skipped tests.
- `node scripts/ar-audio-check.mjs`: actual held-fire simulation spent five AR rounds and emitted five shot events; the real browser engine played five independent 300 ms sample sources. Exactly one fetch and decode during gameplay; shared decoded buffer; no looping or continued playback; other weapons do not use the AR sample. No browser errors.
- Real OfflineAudioContext rendered overlapping AR shots at the weapon's fire interval with audible output, complete cessation afterward, and peak amplitude 0.3084 (below clipping).
- Asset test verifies mono 48 kHz/16-bit WAV, 300 ms duration, one dominant opening blast, quieter decay, amplitude headroom, and click-free boundaries.
- Production WAV and module match source files byte for byte. Build checks require both deployment assets.
- Independent code review found no actionable issues.

The isolated shot and browser results are available in `/workspace/fortmulti-artifacts/audio`. Validation covers the local browser and static build, not a production deployment or external multiplayer transport.
