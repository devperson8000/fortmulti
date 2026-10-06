# Horizon

![Horizon logo](public/horizon-logo.webp)

Horizon is a static browser-based multiplayer battle royale built for Vercel. Private parties support **2–8 players** with a party-leader authoritative simulation, online presence and party invites, ready-up, shared building, text chat, optional party voice, reconnect handling and last-player-standing rounds.

The multiplayer runtime keeps the authoritative host simulation while adapting guest input and snapshot traffic to party size. Host-only latency probes, queued action taps, render-side position/rotation interpolation, stale-socket protection and reconnect cleanup keep larger parties below the Supabase Free Realtime event ceiling without making two-player combat feel delayed.

Short, bounded render prediction keeps players moving between authoritative snapshots without changing host-owned collisions or hit results. Dynamic geometry reuses CPU and GPU storage across frames to prevent allocation-related pauses.

The match uses the bundled animated Soldier GLB for third-person players, blending its Idle, Walk and Run clips from authoritative movement states. The first-person player remains in an eye-level view with the existing detailed AR, shotgun, SMG and sniper view models. CC0 third-person weapon GLBs attach to the Soldier rig. Weapon sway, breathing, recoil, equip and staged reload motion stay layered over the camera; first-person reloads visibly eject the old magazine, seat a fresh one, cycle the action and return the support hand to the grip. Crosshair-aligned hitscan combat and a host-authoritative sniper projectile remain responsive. Cosmetic effects use bounded reusable pools, projectile visuals interpolate between network snapshots, and reusable camera matrices and cached sphere topology reduce hot-path allocation and trigonometry. Auto graphics quality adjusts resolution, remote-player detail, shadows, storm detail and effect budgets without changing simulation or network cadence.

Ground queries use nearby terrain and rooftop collision buckets rather than scanning the full island. During deployment the host skips grounded combat; event and pickup lists stay bounded without recreating their arrays each frame.

The island and its gameplay systems are original. Bundled model sources and licenses are documented in [`public/models/ASSET-LICENSES.md`](public/models/ASSET-LICENSES.md). The project is not affiliated with or endorsed by Epic Games.

## Foreground party lobby

The v5.1 lobby is structured around the playable character instead of covering the 3D scene with large blurred panels. It includes a crisp moonlit resort backdrop, luminous party platforms, a centered foreground lineup for up to eight players, compact top navigation, a lower-left mode/play card, an outfit popover and a slide-out **People Online** drawer. Online discovery stays out of the way until the player opens it from the header, play card, party slot or footer.

Lobby characters use the same locally bundled Soldier skeleton as the match, with a relaxed idle pose and naturally lowered arms.

The v5.2 framing pass guarantees that the local player occupies the nearest central hero platform whether they create a party or join somebody else. Other players and empty invite platforms are placed behind the local character, preventing holograms from drawing through the model. A closer lobby camera, smaller moon, collapsed-by-default chat and single-row roster keep attention on the character. Limb joins now overlap with matching skin/outfit materials, with rounded knees, ankles and boots replacing the exposed dark connector shapes from the earlier procedural rig.

The same rigged model and animation set is used for remote players during ship staging, pod transitions and island combat. Local movement remains first-person, while remote position, turn direction, crouch, jump, weapon and locomotion state follow host snapshots with interpolation and animation crossfades.

## First-person combat system v8

The combat pass adds four independent weapon classes: **Striker AR, Thunder Shotgun, Burst SMG and Eagle-Eye Sniper**. Each profile defines damage, cadence, hip/ADS/movement spread, recoil, reload time, magazine size, range, pellet count, automatic mode, equip time and FOV. Magazines persist independently when swapping slots.

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

Walk to an unoccupied lit pod and press **E**. The host reserves that pod, and the player moves into it through a short first-person entry animation. Deployment begins automatically when every connected player has selected a valid landing point and reached a pod; there is no second confirmation screen. A disconnect before launch releases that player's unused pod and does not hold other ready players.

The shared, host-authoritative sequence seals the pods, builds pressure and light inside the capsule, and launches into an approximately three-second first-person descent. Camera vibration and field-of-view changes rise with the launch, then a full-screen fade covers the server-authoritative reposition to the selected map points. The pods land, open, and let players step out before movement, weapons and combat activate. Snapshot interpolation and a locally advancing, server-synchronized sequence clock keep the camera, remote characters and fade smooth when snapshot cadence slows for larger parties.

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
| Shift | Sprint |
| 1 | Striker AR |
| 2 | Thunder Shotgun |
| 3 | Burst SMG |
| 4 | Eagle-Eye Sniper |
| 5 | Wall blueprint |
| 6 | Ramp blueprint |
| C | Crouch after deployment |
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

Every match starts with a pickaxe, 100 health, no shield and empty inventory. Click trees for wood or rocks for stone. Press E to open chests or collect each dropped item. 0 selects the pickaxe; 1–4 select collected firearms; 5/6 select walls/ramps; 7/8 select shield cells/med kits; 9 selects shockwaves. Click to use or throw. B switches building material, G rotates builds, X drops the held stack or weapon, and R reloads. Shield cells take 3 seconds for 25 shield; med kits take 5 seconds for full health. Switching cancels use without consuming the item. Shockwaves launch players without damage and protect their next landing.
