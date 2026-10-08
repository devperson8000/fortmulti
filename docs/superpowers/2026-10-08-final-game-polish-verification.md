# Final game polish verification — 2026-10-08

Based on main `cfc47bf`. Implements the requested controls and verifies the existing deployment, grips, gameplay, building and weapon audio.

## Changes

Shift only runs. Ctrl toggles crouch when standing or walking; Ctrl during a run starts a knee slide that continues after releasing every key and finishes standing. Removed the obsolete Shift slide command from the client, authority and network transition handling. A cached client sending that obsolete command cannot initiate a slide.

Ctrl retains its direction and running state at the instant of the press, tied to a sanitized revision. Releasing Shift and movement before the next network sample therefore cannot convert the slide into persistent crouch. R also carries a persistent press revision, preventing short reload taps from disappearing between updates. Both revisions are consumed once, including outside gameplay to prevent a deployment press leaking into combat.

Nearby opponents now play their own weapon sounds with distance attenuation. The AR and shotgun retain the supplied isolated samples and decay tails; SMG and sniper retain their distinct synthesized layers. Suspended audio ignores shots rather than queueing an overlapping burst on resume. Quiet synthesized sounds fade proportionally instead of growing toward a fixed volume floor.

Fixed walking onto a supported ramp whose bottom sits slightly above sloping ground. The floor query accounts for the ramp's rise over normal grounded movement. Extra entry allowance is capped and disabled while rising, preventing a shockwave slide from snapping through an overhead ramp or losing landing immunity. Placement, grid snapping, costs and preview geometry retain their existing behavior.

Updated controls help and development documentation. GitHub Actions now checks gameplay/build inputs and gunshot/reload audio alongside deployment and song continuity. Browser checks can use either system Chromium or Playwright's installed browser.

## Executed verification

- `npm run check`: syntax, **292 passing tests**, zero failures or skipped tests, and production build.
- Full two-player browser gameplay: **22 passing checks**, including both Shift keys, Ctrl toggle and released-key slide, reload completion/cancellation, five-slot inventory and immediate swaps, held-E chest opening, real wood/stone placement, rotation, exact preview/authority agreement and climbing two connected ramps. No browser runtime errors. Largest measured local inventory move: **1.8 ms**.
- Dedicated two-player building check: **2 passing scenarios** using actual keys and mouse through local BroadcastChannel transport.
- Full two-player deployment: **14 passing checks** covering exterior entry, closed waiting pods, floor ejection before blackout, logo fade, sealed descent, touchdown, walkout, front-facing raised salute and gameplay handoff. One continuous non-looping 30-second song source per client. Visible touchdown was **15.7 ms and 14.5 ms** after the measured 25.285-second bass cue. No runtime errors.
- Camera framing: **13 passing checks**, including the whole skinned Soldier's raised salute at desktop, compact, ultrawide and portrait sizes; delayed snapshots and authoritative camera handoff also pass.
- Native deployment audio: **10 OfflineAudioContext cases** at 44.1 and 48 kHz, including recovery during the final fade. Maximum sample difference from the forward original at gain 0.65: **5.36e-8**; maximum peak **0.708382**; audio after the ending deadline **0**.
- Native AR/audio check: five bullets produce five independent sample sources and spend five rounds. All four opponent weapon types produce their own sound. Out-of-range shots schedule no voice. A suspended context queues **zero** voices for the reproduced 22-shot sequence. Real waveform scaling is exact for the tested quarter-volume shot; overlapping AR peak **0.306738**.
- Native shotgun check: eight pellets produce one blast; reload sample, authoritative duration and animation share **2.7 seconds**. Delayed delivery seeks correctly, ammo refills, switching cancels audio with a gradual fade, and late events cannot revive a cancelled reload.
- Captured **40 first-person** and **80 multiplayer** weapon poses. Visually inspected all four hip grips, ADS and representative run, crouch, slide and salute poses. Multiplayer capture now explicitly uses the real running state. No renderer runtime errors.
- Independent review findings were reproduced and fixed: released-run-key Ctrl intent, suspended gunshots and the overhead-ramp shockwave regression. Final review reports no remaining Critical or Important findings.
- Source/generated parity verified for changed production assets and unchanged deployment/audio dependencies.

## Scope and artifacts

All browser checks ran locally using Chromium software WebGL and local BroadcastChannel parties. Production Vercel deployment and Supabase connectivity were not exercised. The isolated 100-frame software benchmark at 1280×720, rendering an 832×468 low-quality canvas without MSAA, measured p50 **50 ms**, p95 **66.7 ms**, and p99 **66.8 ms**. These are software-renderer measurements; they do not establish GPU/device frame rates or zero lag on every connection.

Artifacts are under `/workspace/fortmulti-artifacts/final-game-polish/`. `HORIZON-final-polish-screenshots.zip` contains 35 selected fresh screenshots covering the deployment, visible salute, grips, inventory and building. Detailed JSON records retain the measured timing and audio results. Earlier failing runs are retained separately from the final passing results for diagnosis.
