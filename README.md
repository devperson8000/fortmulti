# Sunny Skirmish

Sunny Skirmish is a static, browser-based multiplayer prototype built for Vercel. The lobby, transport, freefall and canopy sequence use a third-person presentation; landed combat transitions smoothly into first person. Private parties support **2–8 players** with an authoritative leader simulation, online presence and party invites, ready-up, shared building, text chat, optional party voice, reconnect handling and last-player-standing rounds.

The v7.1 playability pass keeps the authoritative 30 Hz host simulation while adapting guest input and snapshot traffic to party size. Host-only latency probes, queued action taps, render-side position/rotation interpolation, stale-socket protection and reconnect cleanup keep larger parties below the Supabase Free Realtime event ceiling without making two-player combat feel delayed. Glider descent is faster and more directed, shortening the final landing phase while preserving a useful steering window.

The v7.2 smooth-motion pass adds short, bounded render prediction for grounded movement and synchronized air velocity, so players keep moving between authoritative snapshots without changing host-owned collisions or hit results. Dynamic geometry now reuses CPU and GPU storage across frames to prevent allocation-related pauses. Automatic canopy deployment happens lower, and the final glide descends faster for a shorter, more responsive landing phase.

The v8 first-person pass preserves the existing third-person lobby and aerial drop, then blends to an eye-level combat camera after landing. It adds a redesigned rounded trail-runner character, mirrored outfit layers, fitted armor and equipment, plus shared detailed AR, shotgun, SMG and sniper models for first- and third-person views. Weapon sway, breathing, recoil, sprint, equip and staged reload motion stay layered over the camera; reloads visibly eject the old magazine, guide in a fresh one, cycle the action and return the support hand to the grip. Crosshair-aligned hitscan combat and a host-authoritative sniper projectile remain responsive. Cosmetic effects use bounded reusable pools, projectile visuals interpolate between network snapshots, and reusable camera matrices and cached sphere topology reduce hot-path allocation and trigonometry. Auto graphics quality adjusts resolution, remote-player detail, shadows, storm detail and effect budgets without changing simulation or network cadence.

Drop physics query nearby terrain and rooftop collision buckets rather than scanning the full island for every airborne player. Before anyone lands, the host skips the grounded-combat setup entirely; event and pickup lists stay bounded without recreating their arrays each frame.

The visuals and game code are original procedural assets. The project is not affiliated with or endorsed by Epic Games.

## Foreground party lobby

The v5.1 lobby is structured around the playable character instead of covering the 3D scene with large blurred panels. It includes a crisp moonlit resort backdrop, luminous party platforms, a centered foreground lineup for up to eight players, compact top navigation, a lower-left mode/play card, an outfit popover and a slide-out **People Online** drawer. Online discovery stays out of the way until the player opens it from the header, play card, party slot or footer.

Lobby characters use a dedicated relaxed idle pose with their arms naturally lowered. The character rig has separate idle, combat, freefall, canopy-opening, glider, equip, aim and reload targets.

The v5.2 framing pass guarantees that the local player occupies the nearest central hero platform whether they create a party or join somebody else. Other players and empty invite platforms are placed behind the local character, preventing holograms from drawing through the model. A closer lobby camera, smaller moon, collapsed-by-default chat and single-row roster keep attention on the character. Limb joins now overlap with matching skin/outfit materials, with rounded knees, ankles and boots replacing the exposed dark connector shapes from the earlier procedural rig.

The v6.2 presentation pass replaces the remaining block-jointed silhouette with a higher-density capsule-and-ovoid character. Rounded shoulders, elbows, hands, hips, knees, ankles, boots, layered hair and curved outfit panels overlap cleanly during the relaxed lobby pose, combat, freefall and canopy poses. Party members now share consistent natural skin materials instead of receiving the old opponent tint. The lobby chrome uses rounded layered cards, softer controls, a curved slide-out social drawer and a compact voice panel while keeping the local character unobstructed at the front.

## First-person combat system v8

The combat pass adds four independent weapon classes: **Striker AR, Thunder Shotgun, Burst SMG and Eagle-Eye Sniper**. Each profile defines damage, cadence, hip/ADS/movement spread, recoil, reload time, magazine size, range, pellet count, automatic mode, equip time and FOV. Magazines persist independently when swapping slots.

- Right mouse smoothly blends the first-person camera from a 75° field of view into each weapon's ADS FOV.
- The sniper blends to 15°, removes the local model from the sight picture and opens a dedicated precision optic with a circular vignette and fine reticle.
- The normal crosshair expands from movement, weapon accuracy, sustained fire and recoil, then settles smoothly.
- Recoil layers camera pitch/yaw kick, weapon translation and recovery without changing movement physics.
- Weapon models have distinct higher-detail procedural silhouettes, layered receiver and barrel shapes, optic and rail details, rarity styling, muzzle positions and firing audio. One shared mesh layout is used for first- and third-person views.
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
- The host remains authoritative for movement, building, damage, ammo, storm damage, eliminations, scoring and the drop phase.
- Late joiners are rejected while a match is in progress and can be invited again from the lobby.

## Island and drop phase

Every round begins aboard the **Skyliner**, an original high-detail procedural airborne transport. Its slower, eased route now crosses the much larger island for roughly 32 seconds at a 240-unit cruising altitude, with animated propulsion, slipstream trails, camera drift, moving vapor wisps and altitude movement that make the flight readable. The higher route provides at least ten seconds of neutral freefall before automatic deployment on flat terrain. A 44-unit base deployment buffer and 7.2-unit canopy descent produce a shorter final approach while retaining roughly six seconds of steering time on flat terrain; manual deployment remains available earlier.

The v7 aerial controller uses authoritative momentum across neutral skydiving, steep diving and gliding. Looking down while moving forward—or holding Shift—blends into a faster dive; looking up eases back to a neutral fall. Space opens the canopy with a staged animation. Once open, Space cuts it back into a dive with a short retract animation. Cutting is disabled inside the terrain-aware forced-deployment safety buffer, and the canopy will automatically reopen if the dive reaches that buffer.

The procedural rig cross-fades the torso pitch, arm spread, leg tuck, riser reach and glider hanging pose from synchronized `diveBlend`, `airPitch`, `airRoll`, `airVelocity`, `airSpeed`, `clearance` and `gliderActive` fields. The camera widens from 78° toward 96° during a fast dive, eases back to 70° under canopy, adds restrained velocity-scaled shake, and renders hand/boot wind trails plus an edge-speed treatment. Glider steering preserves momentum, turns smoothly and banks both the character and canopy.

- Move the mouse to orbit around the Skyliner while aboard; press **Space** to jump.
- Steer during freefall with **WASD** and the mouse.
- Press **Space** again to begin the canopy deployment sequence. It now opens over time instead of appearing instantly.
- While gliding, press **Space** again to cut the canopy and return to diving, when enough altitude remains.
- The canopy automatically deploys near the ground.
- During deployment the canopy expands from the pack, the character reaches for both risers, the arms settle onto the controls, and the legs trail and sway before the descent stabilizes.
- Continue steering under canopy until touchdown.
- The first player can move, build and fight as soon as they land; other players keep their live drop simulation until they touch down.

The Skyliner includes a rounded coach body, cockpit glazing, window panels, reinforced chassis, roof machinery, suspension gantry, lift envelope, structural ribs, propulsion pods, animated fan blades, navigation lights, cargo rails, service panels, landing hardware and moving air trails. The canopy uses a dense curved multi-panel mesh with reinforced edging, stitched radial ribs, suspension lines, risers, harness straps, control toggles and hardware.

The island is now more than three times the playable area of the first drop build. Six named regions—**Suncrest, Harbor Reach, Neon Grove, Crown Citadel, Dusty Depot and Pinewatch**—are linked by cross-island roads. Each region has a distinct skyline and landmark, including a harbor beacon, docks, warehouses, colorful towers, a water tower, a stone clock tower, hangars, silos, cargo yards, timber lodges and a radio lookout. The minimap shows the full island, roads, buildings, region names, storm and nearby players.

## Match modes

- **Build skirmish:** unlimited building material.
- **Town royale:** limited material, pickups and a closing storm.

Rounds are last-player-standing. The first player to 5 round wins takes the match.

## Controls

| Control | Action |
| --- | --- |
| WASD | Move / steer in the air |
| Mouse | Orbit the Skyliner; look after landing |
| Left mouse | Fire / place selected build |
| Right mouse | ADS / sniper scope |
| Space | Jump / deploy canopy / cut canopy back to dive |
| Shift | Sprint / commit to steep dive |
| 1 | Striker AR |
| 2 | Thunder Shotgun |
| 3 | Burst SMG |
| 4 | Eagle-Eye Sniper |
| 5 | Wall blueprint |
| 6 | Ramp blueprint |
| G | Rotate build |
| Q | Toggle last weapon / last blueprint |
| Mouse wheel | Cycle inventory |
| R | Reload |
| Esc | Match menu |

The lobby and all aerial states remain third person. First-person mode begins only after touchdown and a short camera blend.

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

The automated suite covers local multi-client room messaging, targeted signaling metadata, online-player discovery and invite acceptance, neutral/dive/glide blending, velocity synchronization, terrain-aware forced deployment, one-way canopy state, landing and first-person camera transitions, crosshair-aligned hitscan fire, sniper projectile travel and collision, bounded effects, adaptive graphics, procedural weapon/reload motion, disconnect cleanup, multiplayer elimination rules, independent magazines, build validation, waiting-state protection, a 45-second combat soak and first-to-five completion.
