# Compass and live scope range verification

Actual production-browser captures: `compass-east.png` shows the rendered view facing E / 90°. `scope-20m.png` and `scope-40m.png` show the same test wall at two measured distances on an unobstructed island sightline. The browser harness injects a controlled match snapshot and test wall, then uses the game's normal camera, input, HUD and renderer.

Run `npm run test:aim-hud-browser` against a production server with `GAME_TEST_URL` (default port 4193). Checks cover all four cardinal turns, both sides of north, numeric distance updates, sky clearing and scope exit. `results.json` records this run. The browser uses software-rendered Chromium; this does not establish hardware frame rates.

Compass markers update every render frame without DOM reconstruction or easing across north. Range sampling runs only while scoped, at most 20 times per second, and checks the same native collision faces, build planes and shot terrain used by gameplay. Living player bounds follow standing/crouching/sliding height; the local character is excluded. Empty sightlines and surfaces beyond the optic's 360 m measurement limit show a dash.
