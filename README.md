# Sunny Duel

A static, browser-based third-person 1v1 game built for Vercel. It includes a Fortnite-inspired party lobby, private invite codes, two match modes, ready-up, first-to-five rounds, shared building, party text chat, voice chat, outfit colors, reconnect handling, and rematches.

The game is original and is not affiliated with or endorsed by Epic Games.

## Modes

- **Build fights:** unlimited materials in a compact arena.
- **Town battle:** limited materials, pickups, and a closing storm.

## Controls

| Control | Action |
| --- | --- |
| WASD | Move |
| Mouse | Look |
| Left click | Fire or place selected build |
| Right click | Aim |
| Space | Jump |
| Shift | Sprint |
| 1 | Rifle |
| 2 | Wall |
| 3 | Ramp |
| G | Rotate build |
| Q | Toggle rifle/wall |
| R | Reload |
| Esc | Match menu |

Build previews snap to the direction the player is facing. The host browser runs the authoritative match simulation, validates build placement, resolves hits and structure damage, and sends snapshots to the guest.

## Deploy to Vercel

1. Import this repository into Vercel.
2. Create a Supabase project.
3. In Supabase Authentication settings, enable **Allow anonymous sign-ins**.
4. Run [`supabase.sql`](./supabase.sql) in the Supabase SQL editor.
5. Add these Vercel environment variables:

   - `SUPABASE_URL`: your project URL, such as `https://project-ref.supabase.co`
   - `SUPABASE_PUBLISHABLE_KEY`: the public `sb_publishable_...` key

6. Redeploy.

Never put a Supabase secret key or service-role key in Vercel for this app. The build script rejects keys beginning with `sb_secret_`, and the in-game setup rejects service-role JWTs.

## Local test

Run:

```bash
npm run dev
```

Open `http://localhost:4173` in two Chrome tabs. Tick **Same-browser test**, create a room in one tab, and join with the code in the other. This mode tests the whole lobby and match loop without Supabase. Cross-browser and cross-network rooms use Supabase.

To test production environment output locally:

```bash
SUPABASE_URL=https://project-ref.supabase.co \
SUPABASE_PUBLISHABLE_KEY=sb_publishable_example \
npm run build
```

Vercel serves the generated `dist` directory.

## Voice chat

Voice chat uses browser WebRTC and asks each player for microphone permission only after they press **Voice**. A public STUN server handles ordinary connections. Some restrictive school or corporate networks require a TURN relay; add optional ICE server objects through `window.SUNNY_CONFIG.iceServers` if needed.

## Security model

- Anonymous Supabase accounts identify each browser session.
- Room membership is capped at two players in the database function.
- Realtime channels are private and authorized through Row Level Security.
- Room records expire after two hours.
- The browser only receives the public Supabase key.
- The host validates movement inputs, builds, hits, ammo, health, round wins, and scores.

## Verification

```bash
npm test
npm run build
```

The tests cover facing-based builds, upper-level structures, hits, structure blocking, ammo, round wins, invalid input filtering, and two-client local message delivery.
