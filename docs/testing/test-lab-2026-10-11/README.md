# Temporary Horizon test lab

Open **TEST LAB** near the bottom-right of the lobby and enter **12345**. The gate unlocks for that page only; reloading locks it again. This is a local practice gate, not administrator access.

## Test on your M3 MacBook Air

1. Enable Chrome **Settings → System → Use graphics acceleration when available**. Relaunch Chrome if you change that setting.
2. Open the lab, leave graphics on **Auto**, choose a map and eight operators, then select **PLAY FIELD TEST**. You control one operator; seven bots move, sprint, crouch, slide and shoot into the air. Enable **Bots fight each other** to test combat between bots.
3. Press **P** during a test to open its controls. Choose **New variants → EQUIP KIT**, then resume. Use **1–5**, **Tab**, **Shift**, **Ctrl**, **E** and **R** to inspect the actual weapon models, grips, inventory, movement, pickups and reloads.
4. **PLACE ALL GUNS** puts the eight weapon types on the floor near you. Aim at the exact gun and press E. **GO TO A CHEST** moves you near a native chest; resume and hold E to open it. Tick the manual checklist only for things you personally verified.
5. **POD DEPLOYMENT** runs the actual boarding, intro audio, impact, exit and salute with the selected roster. Test both maps. Platform 23 always uses its existing gun-only map rules; Ironwood offers the ordinary Build Skirmish and Town Royale modes.
6. **PLAY HCS TEST** uses Platform 23, you plus four bots, and the actual last-survivor final. Enable the full pod intro if desired. **WATCH HCS TEST** automates all five operators and follows them in third person after a real 20-second buffer. Use the target selector to change operators.
7. During a host test, choose **OPEN LOCAL VIEWER** in the P menu. Enter 12345 in the new viewer window. Open more viewer windows to test concurrent local rendering. Chrome may require you to allow pop-ups for Horizon. Each viewer receives only the delayed feed and cannot control the host.
8. **RUN HCS RULE CHECKS** exercises the shared production tournament logic: nickname validation, ten-game qualification, rankings and locks, check-in, ranks 6–9 filling absent slots, postponement, Sunday 7pm Sydney / three-week scheduling, delayed champion publication, broadcast delay and reconnect expiry. These checks use isolated fixture standings.
9. In an HCS player test, **DISCONNECT OPERATOR 2** and **RECONNECT OPERATOR 2** exercise the real 60-second deadline. **END TEST FINAL** keeps your living operator as the last survivor; viewers see the finish and champion after the delay.
10. Play for at least a minute, turn around and explore, then **DOWNLOAD TEST REPORT**. Compare maps and Auto/Medium/Low settings. The report includes frame-time percentiles, slow frames, simulation cost, actual GPU renderer, quality, render dimensions, available JS heap readings, detected errors and your inspection checklist. **END TEST / RETURN TO LOBBY** closes the local session and its viewers.

60 FPS corresponds to about **16.7 ms per frame**. Stable frame times matter as well as average FPS. Report downloads work without DevTools.

## What these tests establish

The lab uses the actual `Match`, final referee, map collision, weapon profiles, character renderer, audio, deployment sequence and `DelayedFeed`. The server and lab import the same pure championship/referee modules. Practice traffic uses a separate local BroadcastChannel; the lab makes no requests to record results, check in real contestants, or start the official championship.

Bots are not remote human clients. Local viewer windows test graphics and local browser transport, not internet latency or Northflank audience capacity. The host also runs its bots and referee on this Mac; official games run referee simulation on the server. For a real maximum-player network test, have eight people join a normal private party from their own Macs. Ordinary online match results follow the ordinary qualification rules.

The temporary lab does not replace the official HCS tab, schedule, standings, Watch HCS button or tournament invitations.

## Verification

- `npm run check`: syntax, full test suite, production build.
- `npm run test:lab-browser`: password rejection/unlock, responsive panel, eight native players, variant kit and floor arsenal, five-player final, separate password-gated viewer, 20-second delay, third-person switching, delayed champion, report download and clean lobby return.
- `node scripts/test-lab-map-check.mjs`: eight-pod deployment on both maps, held salute screenshots, gameplay/chest inspection and watch-only HCS with five automated operators.

The captured browser runs use Linux Chromium with **SwiftShader software graphics**. The example report is a cloud measurement, not M3 performance. Apple GPU performance still needs your machine's report.

## Actual screenshots

[Desktop panel](test-panel-desktop.png) · [Phone panel](test-panel-phone.png) · [Eight-player field test](eight-player-test.png) · [HCS player](hcs-player-test.png) · [Delayed spectator](hcs-delayed-spectator-test.png) · [Delayed champion](hcs-delayed-champion-test.png)

[Ironwood pod entry](island-pod-entry.png) · [Ironwood held salute](island-salute.png) · [Platform 23 pod entry](facility-pod-entry.png) · [Platform 23 held salute](facility-salute.png) · [Watch-only HCS](host-hcs-watch-test.png)

[Browser results](browser-results.json) · [Map/pod results](map-browser-results.json) · [Example cloud report](cloud-test-report.json)
