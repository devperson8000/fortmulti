# Weapon variants

Four new models from [Flat Guns West](https://opengameart.org/content/cc0-flat-guns-west), distributed under CC0, accompany the existing East models. Source revision and SHA-256 checksums are in [model-manifest.json](model-manifest.json). Each new model has 1,540–4,353 triangles; the four original models have 1,508–3,271. The added models total approximately 1.1 MB. Cloned instances share geometry/materials, keep independent skeletons and reuse cached held mounts and thumbnails. Loading happens before firing, not per shot.

| Family | Existing gun / damage | New gun / damage | New magazine / interval |
| --- | --- | --- | --- |
| AR | Striker AR / 21 | Sentinel AR / 24 | 24 / 0.15 s |
| Shotgun | Thunder Shotgun / 9 × 8 pellets | Breacher Auto Shotgun / 7 × 7 pellets | 8 / 0.55 s |
| SMG | Raptor SMG / 13 | Viper SMG / 11 | 36 / 0.06 s |
| Sniper | Eagle-Eye Sniper / 60 | Longbow Sniper / 70 | 3 / 1.65 s |

Damage values are base damage before hit-location modifiers. Sentinel is a slower automatic rifle; Breacher is automatic with less damage per blast; Viper is faster with lower damage per bullet; Longbow hits harder with slower cycling and a smaller magazine. Both maps use the same authoritative profiles. All eight types appear in chest loot. Five inventory slots remain freely arranged, with individual item IDs, magazines and reloads preserved when moved, swapped, collected or dropped.

The native GLBs are used in first person, on remote players, in loot and in thumbnails. Grip anchors use native trigger/attachment nodes and measured triangle surfaces. Offline finger fitting is reproducible with `node scripts/fit-west-grips.mjs`; runtime does not run the fitting optimizer. Tests check palm and trigger contact, finger pads, wrist direction and unchanged bone lengths during aiming, firing, reloads and movement. Remote contacts are checked for all eight guns in ten poses.

## User-supplied battle audio

The user-uploaded `download (2).mp4` is distinct from the CC0 model pack. Only three edited shots are bundled, not the full video. Sentinel and Viper use separate 0.10-second shots from bursts; Longbow uses a 0.62-second isolated heavier impact. Each has a 2 ms attack fade and a decaying tail. Breacher uses the previous user-supplied shotgun shot/reload, with reload playback fitted to its profile duration. Base guns retain their existing audio.

[Extraction metadata](battle-audio-extraction.json) records source hash, crop times and fades. Reproduce with `python scripts/extract-variant-audio.py /path/to/download.mp4` (FFmpeg and NumPy required). Samples are fetched/decoded once, then each bullet starts its own nonlooping voice. Tests check PCM duration, peak levels, fading tails and correct playback routing. Browser checks verify real Web Audio voices and multiplayer firing; waveform and playback checks do not constitute a subjective listening review.

## Verification

Run `npm run check`. With the built game served locally, run `GAME_TEST_URL=http://127.0.0.1:4193 npm run test:weapon-variants-browser`. Visual scripts support `GAME_WEAPONS=ar_sentinel,shotgun_breacher,smg_viper,sniper_longbow`: `grip-visual-check.mjs`, `grip-contact-check.mjs`, and `remote-grip-visual-check.mjs`. Selected actual in-engine renders are in [screenshots/weapon-variants](../../screenshots/weapon-variants). Chromium uses software rendering in this environment; these checks establish rendering correctness, not hardware FPS guarantees.
