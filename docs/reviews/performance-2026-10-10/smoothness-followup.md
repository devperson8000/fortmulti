# Frame stutter follow-up — 10 October 2026

The reported symptom is camera and whole-game stutter in Chrome on an M3 MacBook Air with 16 GB RAM. The target is stable 60 FPS (16.7 ms per frame); this cloud environment cannot establish Apple GPU performance.

## Additional fixes

- Keep unchanged party, presence and invitation DOM nodes intact across gameplay snapshots. Actual names, outfits, roles, readiness, invite eligibility and expiration still invalidate their lists. Presence heartbeats do not.
- Auto graphics now responds to a rolling frame average above 18.5 ms after two seconds of sustained pressure. Previously, sustained 50 FPS never triggered a reduction. Cooldown and slower upgrades prevent rapid quality oscillation; stable 60 FPS and isolated loading spikes retain quality.
- Existing pixel caps already bound rendering on Retina screens. Weapon, finger and character geometry remain unchanged by this follow-up.

## Verification and limits

The two-browser native party diagnostic measures 2.1 seconds of actual local match snapshots with GPU frames disabled to isolate DOM behavior. Before: 270 party-list and 62 online-list child mutations; the first party card was replaced. After: see `lobby-updates-after.json`. This is a DOM-work measurement, not an FPS benchmark.

Run `node scripts/lobby-update-check.mjs` to verify list stability, profile and readiness updates, and invitation eligibility and expiration. `npm run check` passed 473 tests, syntax checks and the production build. Quality tests include continuous-clock hysteresis, sustained 50 FPS, stable 60 FPS, isolated stalls, and Retina pixel limits.

For the M3 Chrome playtest: select Auto graphics, enable Chrome “Use graphics acceleration when available” and relaunch Chrome after changing that setting. Hardware FPS, thermal behavior and internet latency still need a real device measurement. These changes reduce unnecessary work; they do not establish zero lag or guaranteed 60 FPS.
