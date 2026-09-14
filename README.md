# Sunny Skirmish

Sunny Skirmish is a static, browser-based third-person multiplayer prototype built for Vercel. Private parties support **2–8 players** with an authoritative leader simulation, online presence and party invites, ready-up, shared building, text chat, optional party voice, reconnect handling, a detailed airborne drop route, freefall, steerable canopy deployment, and last-player-standing rounds.

The visuals and game code are original procedural assets. The project is not affiliated with or endorsed by Epic Games.

## Foreground party lobby

The v5.1 lobby is structured around the playable character instead of covering the 3D scene with large blurred panels. It includes a crisp moonlit resort backdrop, luminous party platforms, a centered foreground lineup for up to eight players, compact top navigation, a lower-left mode/play card, an outfit popover and a slide-out **People Online** drawer. Online discovery stays out of the way until the player opens it from the header, play card, party slot or footer.

Lobby characters use a dedicated relaxed idle pose with their arms naturally lowered. The character rig has separate idle, combat, freefall, canopy-opening, glider, equip, aim and reload targets.

The v5.2 framing pass guarantees that the local player occupies the nearest central hero platform whether they create a party or join somebody else. Other players and empty invite platforms are placed behind the local character, preventing holograms from drawing through the model. A closer lobby camera, smaller moon, collapsed-by-default chat and single-row roster keep attention on the character. Limb joins now overlap with matching skin/outfit materials, with rounded knees, ankles and boots replacing the exposed dark connector shapes from the earlier procedural rig.

## Combat system v6

The combat pass adds four independent weapon classes: **Striker AR, Thunder Shotgun, Burst SMG and Eagle-Eye Sniper**. Each profile defines damage, cadence, hip/ADS/movement spread, recoil, reload time, magazine size, range, pellet count, automatic mode, equip time and FOV. Magazines persist independently when swapping slots.

- Right mouse smoothly blends the chase camera from a 75° field of view into each weapon's ADS FOV.
- The sniper blends to 15°, removes the local model from the sight picture and opens a dedicated precision optic with a circular vignette and fine reticle.
- The normal crosshair expands from movement, weapon accuracy, sustained fire and recoil, then settles smoothly.
- Recoil layers camera pitch/yaw kick, weapon translation and recovery without changing movement physics.
- Weapon models have distinct procedural silhouettes, rarity styling, muzzle positions and firing audio.
- Reloads animate the weapon tilt, magazine release/ejection, replacement insertion, action rack and return to aim. The support hand follows the magazine through the sequence.
- Equip animations lower and rotate the outgoing/incoming weapon. Mouse sway and breathing remain layered over both aiming and reload motion.
- The party leader remains authoritative: sanitized inputs drive weapon selection, firing, ADS and reloads; snapshots carry weapon/ammo/animation state; shot, reload and switch events carry IDs and timing through the existing private Supabase Realtime channel.

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

Every round begins aboard the **Skyliner**, an original high-detail procedural airborne transport. Its slower, eased route now crosses the much larger island for roughly 32 seconds, with animated propulsion, slipstream trails, camera drift and altitude movement that make the flight readable.

- Press **Space** (or fire) to jump from the transport.
- Steer during freefall with **WASD** and the mouse.
- Press **Space** again to begin the canopy deployment sequence. It now opens over time instead of appearing instantly.
- The canopy automatically deploys near the ground.
- During deployment the canopy expands from the pack, the character reaches for both risers, the arms settle onto the controls, and the legs trail and sway before the descent stabilizes.
- Continue steering under canopy until touchdown.
- Combat begins after all active players land.

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
| Mouse | Look |
| Left mouse | Fire / place selected build |
| Right mouse | ADS / sniper scope |
| Space | Jump / leave Skyliner / deploy canopy |
| Shift | Sprint / faster freefall |
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

## Deploy to Vercel

1. Import this repository into Vercel.
2. Create a Supabase project.
3. In Supabase Authentication settings, enable **Anonymous Sign-Ins**.
4. Open the Supabase SQL editor and run the **entire latest `supabase.sql` file**. The v4 SQL adds online presence and party invitations in addition to the 8-player room schema.
5. In Vercel, add:
   - `SUPABASE_URL` — for example `https://project-ref.supabase.co`
   - `SUPABASE_PUBLISHABLE_KEY` — the public `sb_publishable_...` key
6. Redeploy.

Never put a Supabase secret key or service-role key in the browser or Vercel environment for this project. The build and in-game setup reject obvious secret/service-role keys.

## Local invite-flow test

Run:

```bash
npm run dev
```

Open `http://localhost:4173` in several browser tabs. In each tab open **Developer / fallback tools** and enable **Same-browser test**. Tabs discover one another in **Online Players**, so you can test the same invite → accept → party flow without Supabase.

Cross-browser and cross-network parties use Supabase.

## Voice chat

Party voice uses browser WebRTC and requests microphone permission only after the player presses **Voice**. Each enabled player creates peer connections to other voice-enabled party members. A public STUN server covers ordinary networks. Restrictive networks can still require a TURN relay; optional ICE servers can be provided through `window.SUNNY_CONFIG.iceServers`.

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

The automated suite covers local multi-client room messaging, targeted signaling metadata, online-player discovery and invite acceptance, drop/freefall/canopy/landing flow, disconnect cleanup, multiplayer elimination rules, four weapon profiles, independent magazines, fire modes, reload timing, spread, shooting, structures, build validation, waiting-state protection and first-to-five completion.
