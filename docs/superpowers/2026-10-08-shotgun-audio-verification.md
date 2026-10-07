# Shotgun audio and softer shot tails

The AR retains more of its original final-shot decay and fades over 220 ms, with a 360 ms total sample. The shotgun blast is extracted separately from 4.700–6.460 seconds of the second upload and retains its 1.760-second decay with a 240 ms tail fade. A shotgun trigger pull plays one blast for all eight pellets.

The second upload's reload sequence (0–3.600 seconds) is compressed with pitch-preserving `atempo` to 2.700 seconds. The shared weapon profile uses the same 2.700-second reload duration for the server's ammo refill, HUD, animation, and audio. Its final strong pump at approximately 2.100 seconds aligns with the animation's action phase.

Audio is fetched once per asset and decoded once per context. Reload playback uses remaining time from the accepted authoritative snapshot, since events arrive before the next rendered frame. Delayed delivery starts at the corresponding offset. Completed, stale, and locally superseded reload events cannot restart playback. Switching weapons, death, completion, and menu clearing stop an active reload with a 45 ms gain fade. The gain is explicitly anchored at cancellation time so the fade ramps from its current volume.

Fresh validation:

- `npm run check`: syntax, all 223 unit tests, and static build passed; no failures or skips.
- `node scripts/browser-check.mjs`: 19 checks passed over actual two-tab guest/host BroadcastChannel networking, including a real R press, one reload sound, ammo completion, and weapon-switch cancellation. Existing inventory, chest, crouch, and slide checks also passed. No browser errors.
- `node scripts/ar-audio-check.mjs`: five actual AR rounds spent produce five independent sample voices; cached buffer and no continued firing; no browser errors. Real overlapping render remains below clipping.
- `node scripts/shotgun-audio-check.mjs`: eight pellets produce one blast; 180 ms delayed reload delivery starts at the matching offset; audio duration, ammo refill, and animation completion agree; completed events stay silent; weapon switching cancels playback; a delayed event after local switching stays silent. No browser errors.
- Real OfflineAudioContext confirms both full reload mechanics and interrupted output. Cancellation attenuates to about 0.77 then 0.24 of normal output before reaching silence, rather than cutting abruptly.
- Asset tests verify longer AR fade, shotgun decay, separate reload mechanics, exact shared duration, and final pump phase alignment.
- `node scripts/grip-visual-check.mjs`: 40 first-person captures completed without runtime errors using the new reload duration; model contact tests also passed in the full suite.
- Independent review findings about snapshot ordering, gain scheduling, and delayed switching were fixed and rechecked; no actionable issues remain.

Extraction commands are in `public/audio/README.md`. The downloadable archive and audio test results are in `/workspace/fortmulti-artifacts/audio`. Validation covers the local application and production build; it does not establish a production deployment or external multiplayer transport.
