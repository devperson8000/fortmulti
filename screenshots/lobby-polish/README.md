# Military lobby polish

Verified 2026-10-09 with 369 passing automated tests and a production build. The rig test loads the actual Soldier and AR files and checks both palm contacts and downward/cross-body barrel orientation at three character scales through three native Idle animation poses.

`npm run test:lobby-browser` passes four grouped browser checks with no JavaScript errors. The harness connects eight real clients over the local BroadcastChannel transport and captures the leader's lobby with two, four and eight members. Extra clients pause their rendering so the software GPU can inspect the leader's complete squad scene; this is not an eight-machine FPS benchmark or a live Supabase test. It verifies party removal and the Character tab, checks all helmet/foot projections, and checks that phone controls clear the squad's heads.

- [Solo](solo.png)
- [Two connected players](two-player.png)
- [Four connected players](party-4.png)
- [Eight connected players](party-8.png)
- [Compact eight-player layout](party-8-compact.png)
- [Phone eight-player layout](party-8-phone.png)
- [Full character inspection](character.png)

These are production-engine screenshots. Rifle support contact is no longer clamped toward the magazine. Both hands use calibrated contacts, the native finger rest poses reset before each frame, and leaving members release the character and rifle skeleton resources. Olive/steel panels, restrained contours and square controls replace the louder styling; inactive navigation placeholders are hidden. The inspection platform camera matches the character camera.
