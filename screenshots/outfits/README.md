# Working uniform customization

Actual production-browser captures, not concept images: Azure (`408faf.png`), Ember (`dc8255.png`), and two connected clients (`multiplayer.png`). The six menu presets tint the soldier's existing camouflage while keeping the visor and weapon materials unchanged. The same per-player material treatment applies in matches and to local first-person sleeves.

`npm run test:outfit-browser` checks all six presets, Character preview, saved selection after reload, and real two-client propagation with independent uniforms. Set `GAME_TEST_URL` to a running production server (default port 4193). `results.json` records this run. Browser checks use software-rendered Chromium; they do not measure hardware performance.
