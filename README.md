# Horizon

![Horizon logo](public/horizon-logo.webp)

Horizon is a static browser-based multiplayer battle royale built for Vercel. Private parties support **2–8 players** with a party-leader authoritative simulation, online presence and party invites, ready-up, shared building, text chat, optional party voice, reconnect handling and last-player-standing rounds.

The multiplayer runtime keeps the authoritative host simulation while adapting guest input and snapshot traffic to party size. Host-only latency probes, queued action taps, render-side position/rotation interpolation, stale-socket protection and reconnect cleanup keep larger parties below the Supabase Free Realtime event ceiling without making two-player combat feel delayed.

Short, bounded render prediction keeps players moving between authoritative snapshots without changing host-owned collisions or hit results. Dynamic geometry reuses CPU and GPU storage across frames to prevent allocation-related pauses.

The match uses the bundled animated Soldier GLB for third-person players, blending its Idle, Walk and Run clips from authoritative movement states. The first-person player remains in an eye-level view with the existing detailed AR, shotgun, SMG and sniper view models. CC0 third-person weapon GLBs attach to the Soldier rig. Weapon sway, breathing, recoil, equip and staged reload motion stay layered over the camera; first-person reloads visibly eject the old magazine, seat a fresh one, cycle the action and return the support hand to the grip. Crosshair-aligned hitscan combat and a host-authoritative sniper projectile remain responsive. Cosmetic effects use bounded reusable pools, projectile visuals interpolate between network snapshots, and reusable camera matrices and cached sphere topology reduce hot-path allocation and trigonometry. Auto graphics quality adjusts resolution, remote-player detail, shadows, storm detail and effect budgets without changing simulation or network cadence.

Ground queries use nearby terrain and rooftop collision buckets rather than scanning the full island. During deployment the host skips grounded combat; event and pickup lists stay bounded without recreating their arrays each frame.

The island and its gameplay systems are original. Bundled model sources and licenses are documented in [`public/models/ASSET-LICENSES.md`](public/models/ASSET-LICENSES.md). The project is not affiliated with or endorsed by Epic Games.

## Military lobby

The lobby presents the local operator in front of a compact squad formation. All members hold the actual assault rifle across the torso with both calibrated palms on its real grip and fore-end contacts. Idle animation and occasional staggered salutes preserve the native skeleton. Party framing adapts through eight members and compact/phone viewports; the Character tab fits the full operator and rifle above its matching inspection platform.

Run `GAME_TEST_URL=http://127.0.0.1:4176 npm run test:lobby-browser` against the running app to verify real local-transport parties with two, four and eight connected clients, visible character framing and party removal. Captures and verification notes are in [screenshots/lobby-polish](screenshots/lobby-polish).

## Match maps

The party leader chooses **Ironwood Island** (outdoor military terrain and forests) or **Platform 23** (EmperorJack’s military industrial arena from Unvanquished). Platform 23 replaces the discarded Reactor Facility option; the network map identifier remains `facility` for existing parties. The selection synchronizes across the party and loads before deployment begins. Unselected map assets are never requested.

Eight supported landing regions surround the connected central decks, courtyards, gantries and side bases. Selection reserves native floor space for the pod, exit and exterior camera; overlapping choices receive another clear destination, including full eight-player parties. Source convex brushes provide exact movement, projectile and camera collision, so angled walls do not create invisible bounding-box barriers. Native lower floors and sloped surfaces keep independent support. Twenty-four distributed chests and supply crates use those same floors. The capsule, song, walkout and salute timeline stays unchanged.

The converted map has 27,952 rendered triangles, 46 material batches, roughly 302 KB of compressed geometry and 3.66 MB of WebP textures. Spatial culling submits visible source chunks; Low and Medium offer lighter textured shaders, while High retains physical materials, normal maps and reflections. Assets, pinned source revisions and license terms are recorded in [`public/maps/platform23/ATTRIBUTION.md`](public/maps/platform23/ATTRIBUTION.md). Converted map art remains CC BY-SA 3.0; PK02 textures retain their CC BY 3.0 credit. Performance still depends on GPU and graphics settings; the browser checks report measured frame times rather than promising a universal frame rate.

## Foreground party lobby

The v5.1 lobby is structured around the playable character instead of covering the 3D scene with large blurred panels. It includes a crisp moonlit resort backdrop, luminous party platforms, a centered foreground lineup for up to eight players, compact top navigation, a lower-left mode/play card, an outfit popover and a slide-out **People Online** drawer. Online discovery stays out of the way until the player opens it from the header, play card, party slot or footer.

Lobby characters use the same locally bundled Soldier skeleton as the match, with a relaxed idle pose and naturally lowered arms.

The v5.2 framing pass guarantees that the local player occupies the nearest central hero platform whether they create a party or join somebody else. Other players and empty invite platforms are placed behind the local character, preventing holograms from drawing through the model. A closer lobby camera, smaller moon, collapsed-by-default chat and single-row roster keep attention on the character. Limb joins now overlap with matching skin/outfit materials, with rounded knees, ankles and boots replacing the exposed dark connector shapes from the earlier procedural rig.

The same rigged model and animation set is used for remote players during ship staging, pod transitions and island combat. Local movement remains first-person, while remote position, turn direction, crouch, jump, weapon and locomotion state follow host snapshots with interpolation and animation crossfades.

## First-person combat system v8

The combat system has four weapon families: **Striker AR, Thunder Shotgun, Raptor SMG and Eagle-Eye Sniper**. Each profile defines damage, cadence, hip/ADS/movement spread, recoil, reload time, magazine size, range, pellet count, automatic mode, equip time and FOV. Magazines persist independently when swapping slots. Damage is reduced in both gamemodes (AR 21, SMG 13, shotgun 9 per pellet, sniper 60) to extend fights. Tap Ctrl to toggle crouch; while sprinting with Shift, tap Ctrl to start a slide. Shift only runs. Releasing Shift does not cancel a slide; Ctrl cancels it when there is room to stand.

Four additional CC0 Flat Guns West models join those families: **Sentinel AR (24 damage), Breacher Auto Shotgun (7 × 7 pellets), Viper SMG (11 damage), and Longbow Sniper (70 damage)**. All eight guns enter chest loot and retain independent magazines in the same five freely arranged slots. New shot samples use isolated, faded single shots from the supplied battle video; the Breacher retains the supplied shotgun shot/reload audio. [Models, tuning, audio and verification](docs/weapons/variants.md).

- Right mouse smoothly blends the first-person camera from a 75° field of view into each weapon's ADS FOV.
- The sniper blends to 15°, removes the local model from the sight picture and opens a dedicated precision optic with a circular vignette and fine reticle.
- The normal crosshair expands from movement, weapon accuracy, sustained fire and recoil, then settles smoothly.
- Recoil layers camera pitch/yaw kick, weapon translation and recovery without changing movement physics.
- Weapon models have distinct higher-detail procedural silhouettes, layered receiver and barrel shapes, optic and rail details, rarity styling, muzzle positions and firing audio. The existing first-person weapon models are preserved; CC0 GLB weapons attach to the animated third-person Soldier.
- Reloads animate the weapon tilt, magazine release/ejection, hand retrieval, replacement insertion, action cycle and return to aim. The detached old magazine and fresh magazine are separate animated parts; the support hand follows the exchange and returns to its grip.
- Equip animations lower and rotate the outgoing/incoming weapon. Mouse sway and breathing remain layered over both aiming and reload motion.
- The party leader remains authoritative: sanitized inputs drive weapon selection, firing, ADS and reloads; snapshots carry weapon/ammo/animation state; shot, reload and switch events carry IDs and timing through the existing private Supabase Realtime channel.
- AR, SMG and shotgun fire remains hitscan and converges on the exact world point under the centered crosshair. The sniper alone uses a lightweight simulated projectile with visible travel, mild drop, swept collision and event-driven impact feedback.
- Losing pointer lock clears held inputs and displays a click-to-resume control without resetting or pausing the authoritative round.
- Match settings provide Auto/Low/Medium/High graphics and separate mouse/scope sensitivity. These preferences remain local to the browser.

The v6.1 polish pass resolves third-person crosshair offset by reconstructing the same shoulder camera on the authoritative host. Every shot first resolves the world point under the crosshair, then converges from the visible muzzle toward that point. A second muzzle-side collision check still blocks shots when nearby cover obstructs the weapon. Camera recoil is included in the transmitted aim ray, the dynamic crosshair now recovers correctly during multiplayer play, and selecting a build slot replaces the gun with an animated holographic blueprint for both local and remote players.

## Multiplayer v4

The normal party flow no longer asks players to type or share room codes:

1. Open the lobby and appear in **Online Players**.
2. Create a party or simply press **Invite** on another online player; a party is created automatically when needed.
3. The other player receives an expiring **Accept / Decline** party invite.
4. Accepting joins the private party automatically.
5. Invite up to 7 other players, choose a mode, and ready up.

A room-code join remains only inside **Developer / fallback tools** for recovery and debugging.

Other multiplayer improvements include:

- Up to **8 active players** per party.
- Presence heartbeats and stale-player cleanup.
- Expiring server-validated party invitations.
- Browser anonymous-auth sessions are reused instead of creating a new auth user for every room attempt.
- Guest room slots are released when players leave.
- Disconnecting players are removed before the next round, preventing ghost respawns.
- A disconnect during pre-drop waiting no longer strands the party waiting for a player who left.
- Match-mode changes cancel ready states so a match cannot accidentally launch with stale readiness.
- Party voice uses a small WebRTC mesh for multiple voice-enabled members.
- The host remains authoritative for movement, deployment, building, damage, ammo, storm damage, eliminations and scoring.
- Late joiners are rejected while a match is in progress and can be invited again from the lobby.

## Stationary deployment ship and pod sequence

Each round begins inside a stationary deployment ship above the island. It does not travel over the map. Players can walk and sprint through its collision-bounded interior in first person, but weapons remain locked. The landing panel shows the whole island, six named regions, and the current destination marker. Click any point or choose a named region to set a landing position; players may choose different places.

Walk to an unoccupied lit pod and press **E**. The host reserves that pod, and the camera switches outside to watch the operator walk in. The doors close only after the operator is inside; the exterior view stays fixed while waiting for the rest of the squad. Deployment begins automatically when every connected player has selected a valid landing point and reached a pod; there is no second confirmation screen. A disconnect before launch releases that player's unused pod and does not hold other ready players.

Once every pod is ready, sliding deck hatches open and the capsules accelerate down through the ship floor before the screen fades to black. The supplied 30-second song plays forward once, using the audible Web Audio clock to synchronize camera cues. HORIZON fades in over 0.7 seconds starting at the measured **uh, yeah** cue (9.59 seconds), and fades out when the verse begins. A sealed exterior descent ends with an aggressive landing on the bass drop (25.285 seconds), camera shake and ground debris. The hatch opens, the operator walks out, and a stable front-facing camera shows the native two-finger salute before the final 0.4-second music fade. The camera returns to first person and gameplay unlocks at song time 29.835 seconds. No earlier section is repeated. Snapshot interpolation and per-frame presentation keep boarding, exit and salute smooth between network updates.

The deployment state machine owns destination validation, unique pod reservations, readiness, launch timing, the black reposition window, landing, pod exit and the exact point where combat unlocks. The host remains authoritative for positions and match state. A late or stale packet cannot restart the sequence, duplicate pod entry or expose the map teleport.

The island has six regions—**Suncrest, Harbor Reach, Neon Grove, Crown Citadel, Dusty Depot and Pinewatch**—linked by cross-island roads. Each region has a distinct skyline and landmark, including a harbor beacon, docks, warehouses, colorful towers, a water tower, a stone clock tower, hangars, silos, cargo yards, timber lodges and a radio lookout. The minimap shows the full island, roads, buildings, region names, storm and nearby players.

## Match modes

- **Build skirmish:** harvest wood and stone to construct cover.
- **Town royale:** chest loot, harvesting and a closing storm.

Rounds are last-player-standing. The first player to 5 round wins takes the match.

## Controls

| Control | Action |
| --- | --- |
| WASD | Walk through the deployment ship and the island |
| Mouse | Look around in first person |
| E | Enter a nearby available pod |
| Left mouse | Fire / place selected build after deployment |
| Right mouse | ADS / sniper scope |
| Space | Jump after deployment |
| Shift | Hold to run |
| 1–5 | Select your five freely arranged weapon slots |
| Tab | Open/close inventory; drag to move or swap weapons |
| 0 | Pickaxe |
| Z / V | Wall / ramp blueprint |
| 7 / 8 / 9 | Shield cell / med kit / shockwave |
| Ctrl | Toggle crouch; tap while running for a knee slide that finishes standing |
| G | Rotate build |
| Q | Toggle last weapon / last blueprint |
| Mouse wheel | Cycle inventory |
| R | Reload |
| Esc | Match menu |

The lobby remains third person. Ship staging, pod entry, descent, landing and combat stay first person. Weapons appear once the match becomes active.

## Deploy to Vercel

1. Import this repository into Vercel.
2. Create a Supabase project.
3. In Supabase Authentication settings, enable **Anonymous Sign-Ins**.
4. Open the Supabase SQL editor and run the **entire latest `supabase.sql` file**. The v4 SQL adds online presence and party invitations in addition to the 8-player room schema.
5. In Vercel, add:
   - `SUPABASE_URL` — for example `https://project-ref.supabase.co`
   - `SUPABASE_PUBLISHABLE_KEY` — the public `sb_publishable_...` key
6. Redeploy.

The first-person update does not require a Supabase schema change. Projects already running the latest `supabase.sql` keep the same Auth, Realtime and RLS setup.

Never put a Supabase secret key or service-role key in the browser or Vercel environment for this project. The build and in-game setup reject obvious secret/service-role keys.

## Local invite-flow test

Run:

```bash
npm run dev
```

Open `http://localhost:4173` in several browser tabs. In each tab open **Developer / fallback tools** and enable **Same-browser test**. Tabs discover one another in **Online Players**, so you can test the same invite → accept → party flow without Supabase.

Cross-browser and cross-network parties use Supabase.

## Voice chat

Party voice uses browser WebRTC and requests microphone permission only after the player presses **Voice**. Each enabled player creates peer connections to other voice-enabled party members, while Supabase Realtime carries only the targeted offer/answer/ICE signaling messages. The v6.2 voice pass adds explicit mute state, connected-peer counts, microphone activity feedback, failed-link retries, playback warnings and complete track/audio cleanup. A public STUN server covers ordinary networks. Restrictive networks can still require a TURN relay; optional ICE servers can be provided through `window.SUNNY_CONFIG.iceServers`.

## Security model

- The browser only receives the public Supabase key.
- Anonymous users are authenticated Supabase users with unique user IDs.
- Online-directory RPCs expose display name, outfit and activity state, but do **not** expose private room codes.
- A private room code is returned to the intended recipient only through their pending invite.
- Invitation acceptance is revalidated against room existence, leader presence and the 8-player capacity.
- Active room membership is checked by private Realtime RLS policies.
- The host browser validates player inputs and runs the authoritative match simulation.
- Build placement, hits, structure damage, ammo, health, eliminations and scores are resolved by the host.

## Verification

```bash
npm run check
```

The automated suite covers local multi-client room messaging, targeted signaling metadata, online-player discovery and invite acceptance, stationary-ship movement and collision, landing selection, pod reservation, synchronized launch, black-window reposition, pod exit and first-person presentation, crosshair-aligned hitscan fire, sniper projectile travel and collision, bounded effects, adaptive graphics, procedural weapon/reload motion, disconnect cleanup, multiplayer elimination rules, independent magazines, build validation, waiting-state protection, a 45-second combat soak and first-to-five completion.

## Harvest and loot controls

On Ironwood Island, matches start with a pickaxe, 100 health, no shield and empty inventory. Platform 23 starts with an AR and uses pure gun fighting: construction, the pickaxe, materials and shockwaves are disabled at the server and hidden in the controls. Click trees for wood or rocks for stone. Hold E continuously for 0.7 seconds to open an upright chest without a timer; releasing, changing target or leaving range resets progress. Press E to collect each dropped item. 0 selects the pickaxe; 1–5 select freely arranged firearms; Z/V select walls/ramps; 7/8 select shield cells/med kits; 9 selects shockwaves. Click to use or throw. B switches building material, G rotates builds, X drops the held stack or weapon, and R reloads. Shield cells take 3 seconds for 25 shield; med kits take 5 seconds for full health. Switching cancels use without consuming the item. Shockwaves launch players without damage and protect their next landing.

## Flexible loadout and browser verification

Carry up to five weapon instances in any order, including duplicates with separate magazines. Press Tab to arrange them: drag onto a weapon to swap, or onto an empty slot to move. Changes appear immediately while the party leader validates them. Rearranging preserves the equipped instance and its reload. Pickups fill the first empty slot; when full, drop a weapon with X to make room. Building, pickaxe and consumables remain separate. The inventory releases mouse capture and clears held controls while the match continues; close it and click to resume mouse control. Keyboard users can focus a weapon, press Space, choose a destination with the arrow keys and press Space again.

Ground firearms use the same GLBs and materials as held firearms, slowly rotating and bobbing. Three.js is served from the checksum-verified npm installation in development and copied into `dist/vendor/three` during builds, so browser startup needs no third-party CDN.

Run `npm run dev`, then `npm run test:browser` in another terminal. The default check URL is `http://127.0.0.1:4174`; set `GAME_TEST_URL=http://127.0.0.1:4173` for the default dev port. Set `CHROMIUM_EXECUTABLE` to an installed Chromium binary and `GAME_ARTIFACTS` to your screenshot/result directory. The gameplay and audio checks use `/usr/bin/chromium` when available, otherwise Playwright’s installed Chromium. Browser checks create two isolated local-test party tabs and seed test items through a test-only harness; normal app input, networking and host validation remain in use. They never alter production database state.

The gameplay check covers inventory, chest holds, reloads, Shift-only running, Ctrl crouch/slide, material costs, build rotation and connected-ramp climbing. Run `node scripts/building-check.mjs` to repeat just the real building inputs. Run `node scripts/ar-audio-check.mjs` and `node scripts/shotgun-audio-check.mjs` to verify single-shot voices, opponent audio, gradual tails, suspended-audio recovery and reload synchronization. GitHub Actions runs these alongside the deployment and music-continuity checks.

Run `node scripts/grip-visual-check.mjs` with the same URL/browser/artifact settings for actual Soldier/weapon rendering in hip, ADS, reload and alternate aspect ratios. Inspect the resulting screenshots; numerical palm tests alone do not establish visual correctness.

Run `npm run test:platform23-browser` (also available as `test:facility-browser`) to check two-player map synchronization, native drop choices, full deployment/music/salute, chest holds, gun audio, supported walking, forbidden construction controls, remote knee slides, and actual exterior/interior rendering. Screenshots and frame-time results are saved to `GAME_ARTIFACTS`; `PLATFORM23_FRAME_SAMPLES` controls profiling samples (24 by default). Software-rendered Chromium results are not hardware GPU benchmarks. Set `GAME_TEST_VIDEO=1` to additionally record videos when Playwright’s ffmpeg is installed. These scripts accept the URL/browser/artifact settings above.
