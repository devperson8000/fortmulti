# Sunny Skirmish

Sunny Skirmish is a static, browser-based third-person multiplayer prototype built for Vercel. Private parties support **2–8 players** with an authoritative leader simulation, online presence and party invites, ready-up, shared building, text chat, optional party voice, reconnect handling, a detailed airborne drop route, freefall, steerable canopy deployment, and last-player-standing rounds.

The visuals and game code are original procedural assets. The project is not affiliated with or endorsed by Epic Games.

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
| Mouse | Look / fire |
| Space | Jump / leave Skyliner / deploy canopy |
| Shift | Sprint / faster freefall |
| 1 | Rifle |
| 2 | Wall |
| 3 | Ramp |
| G | Rotate build |
| Q | Toggle rifle/wall |
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

The automated suite covers local multi-client room messaging, targeted signaling metadata, online-player discovery and invite acceptance, drop/freefall/canopy/landing flow, disconnect cleanup, multiplayer elimination rules, shooting, ammo, structures, build validation, waiting-state protection and first-to-five completion.
