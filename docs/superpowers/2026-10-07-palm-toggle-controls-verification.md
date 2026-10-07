# Palm orientation and tap controls verification

The actual Soldier hand bones have the same inward palm axis, local -X, on both hands. The finger fan mirrors across Z. The previous support pose treated the inward axis and flex direction as mirrored, turning the palm away from the weapon. The shared first-person and remote calibration now rotates the support palm toward the underside and curls the native fingers inward. Shooting-hand trigger calibrations remain intact.

Ctrl (and C) toggles crouch. Release, repeated keydown events, and stale movement input do not undo it. A standing request waits for enough headroom and takes effect when clear. Tapping Shift while moving initiates a slide; it decelerates and stands automatically without holding Shift or movement. Holding Shift still sprints after the slide. The existing sprint-plus-Ctrl slide also works.

Monotonic press revisions preserve a tap whose keydown and keyup happen between network samples. The host consumes each revision once and baselines the counters during deployment. Counters and crouch intent are excluded from player snapshots.

Fresh validation on 2026-10-07:

- `npm run check`: syntax, all 219 unit tests, and static production build passed; zero failures or skips.
- `node scripts/browser-check.mjs`: all 17 checks passed over the actual guest/host BroadcastChannel path. Includes short Ctrl/Shift taps, release persistence, auto-repeat suppression, automatic slide completion, inventory interactions, and chest hold. Zero browser errors.
- `node scripts/grip-visual-check.mjs`: 40 first-person captures, including all four gun models, ADS, reload stages, compact/wide framing, and utility items. Zero runtime errors.
- `node scripts/remote-grip-visual-check.mjs`: 80 captures across four guns, ten animation modes, and two camera angles. Zero runtime errors.
- Inspected the rendered hip/ADS/reload and remote side views. Native palm normals, physical finger flex, exact trigger contact, wrist reach, and original skin attachments are checked against the loaded model skeletons.
- Independent code review found no remaining actionable issues.

Artifacts are under `/workspace/fortmulti-artifacts`; `corrected-grip-screenshots.zip` includes fresh first-person and remote images plus a contact sheet. Browser validation uses the local multiplayer transport; it does not establish production Supabase connectivity or a Vercel deployment.
