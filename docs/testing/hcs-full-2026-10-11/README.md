# Full HCS practice: ship to champion

In the lobby, open **TEST LAB**, enter **12345**, and choose **FULL HCS · SHIP TO CHAMPION**.

The full run uses you and four combat bots, Platform 23, the native five-player final, actual guns and damage, and the normal deployment sequence. The bots can shoot you. This practice session cannot award an official title or change qualification standings.

1. Leave **Open a spectator window** checked to open a real local audience window with the run. Enter **12345** in that window. Allow Chrome pop-ups for Horizon if required. You can add more audience windows using **Open viewer** in the P controls.
2. Return to the player window. Choose a landing zone in the ship briefing if desired, then press **E** at the pod in front of you. Four bots board their own pods. The ship waits for all five operators before launching.
3. HCS deployment displays your uploaded emblem at the original music cue, followed by the existing impact, walkout and salute. Ordinary matches retain the Horizon emblem.
4. Fight in first person. Audience windows follow in third person with a real **20-second delay** and can switch operators. The full run also executes the isolated HCS qualification, scheduling, check-in, reserve, reconnect and delayed-result rule checks.
5. The last living operator wins. Your victory screen shows **HCS VICTORY** if you won; otherwise it names the actual champion. The champion faces the camera and salutes, with a short fanfare and a finite confetti burst. Audiences receive the finish and celebration through the delayed snapshot feed.
6. Press **P** for inspection controls. **Bots fight each other** controls bot gunfire; in the full run it also includes targeting you. Uncheck it if you want to inspect models or the cinematic without being eliminated. **End test final** is an explicitly scripted practice win for your still-living operator, useful for checking celebration and broadcast timing. It cannot revive you or award an official title.
7. Download the report during combat to measure active gameplay, then again with audience windows open. Use **Return to lobby** to finish. The full test has no fixed time limit; ordinary storm and last-survivor rules determine the finish.

These are local bots and browser windows, not remote people. This checks native gameplay, graphics and local broadcast behavior; it does not measure internet latency or the server's audience capacity. On one Mac, several audible viewer windows can overlap with the player's sound. Chrome lets you mute individual viewer sites/windows for the performance comparison.

## Verification

- Shared tournament and native combat unit tests.
- Real Chromium flow: player E boarding, four bots, two spectator windows, uploaded emblem, salute, first-person play, scripted local victory and delayed audience celebration, download and exit.
- Ordinary test-lab and HCS-client regression checks.
- Browser screenshots use the cloud's Linux SwiftShader software renderer; they are not measurements of Apple M3 performance.

The victory branch in the browser test uses the labeled scripted local-final control; native gun damage and bot routing are tested separately. This keeps a deterministic visual check from depending on winning a live bot fight.

Run locally with `npm run dev`, then:

```sh
npm run check
npm run test:hcs-full-browser
npm run test:lab-browser
node scripts/hcs-client-browser-check.mjs
```

## Actual screenshots

[Ship briefing](01-hcs-ship.png) · [HCS emblem](02-hcs-emblem.png) · [Held salute](03-hcs-salute.png) · [First-person gameplay](04-hcs-combat.png) · [Player victory](05-hcs-victory.png) · [Delayed audience champion](06-delayed-champion.png)

[Browser results](results.json) · [Cloud machine report](machine-report.json)
