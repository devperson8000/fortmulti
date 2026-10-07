# Native weapon grip verification

The AR, shotgun, SMG and sniper now use separate shooting-hand, support-hand and reload calibrations fitted against their shipped GLBs and the Soldier's native finger chains. Shooting palms sit beside the handles, index pads reach the visible trigger surfaces, and support thumbs follow the fore-ends. Reload hands rotate toward the magazine or shotgun loading area and blend their finger shape with the reach. The pickaxe palm and all gripping fingers fit its shaft.

The first-person shoulder frame stays within the reach of both hands. Elbow guides follow the actual hand direction in both perspectives, preventing the backward wrist folds found during review. Native bone translations, lengths, mesh weights, weapon scale, sight alignment and muzzle alignment remain intact.

Fresh verification on 2026-10-08:

- `npm run check` after integrating main at `fbd5679`: syntax checks, all 263 tests and the static production build passed; zero failures or skips.
- `node scripts/browser-check.mjs`: all 19 checks passed through the actual two-tab guest/host transport, including weapon equips, inventory rearrangement, shotgun reload completion/cancellation, chest hold, crouch toggle and tap-to-slide. Zero browser errors.
- `node scripts/grip-visual-check.mjs`: 40 first-person screenshots covering four firearms, hip fire, ADS, three reload stages, compact/wide viewports and utility items. Zero runtime errors.
- `node scripts/grip-contact-check.mjs`: 24 close-ups covering the grip and reload of every firearm from both sides and underneath. Zero runtime errors.
- `node scripts/remote-grip-visual-check.mjs`: 80 third-person screenshots covering four firearms, ten movement/action modes and two camera angles. Zero runtime errors.
- Inspected all firearms' first-person grips and close-ups, plus ADS, reload, pickaxe and third-person movement views. Regression tests measure native palm orientation, trigger contact, finger-pad proximity to actual skinned weapon/magazine triangles, wrist angles and unchanged bone attachments.
- Independent review swept 600 first-person frames per firearm and ten third-person modes with transitions. Maximum forearm/hand-axis angle was 77.7 degrees; no sample exceeded the 95-degree regression limit. Review confirmed the previous wrist-folding and reload-pose findings were resolved and the newer cinematic salute integrates without conflicting with normal weapon posing.

Screenshots and measurement JSON are under `/workspace/fortmulti-artifacts/grips-final/final`; gameplay evidence is under `/workspace/fortmulti-artifacts/grips-final/gameplay`. `weapon-grip-screenshots.zip` packages the rendered images and measurements. Contact measurements sample configured native finger pads and do not exhaustively test every skin vertex for penetration. Browser checks use Chromium and local multiplayer transport; they do not establish production Supabase connectivity or a Vercel deployment.
