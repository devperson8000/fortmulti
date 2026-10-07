# Music-synchronized deployment

After every connected operator has entered a pod, doors seal and a 420 ms transition reaches full black. The supplied edited music starts there. HORIZON's existing transparent symbol reveals at the first adlib (10.000 seconds), fades out at “Wait” (20.190), and gives way to a camera orbit around the local operator's pod. The camera faces the actual Soldier character by “When” (23.550). The pod descends continuously to the operator's selected safe destination and touches ground at the beginning of “Big stepper” (25.580). The existing opening and exit restore gameplay. Gameplay overlays are hidden during the edit.

The music player schedules one AudioBufferSource per sequence and drives visual elapsed time from its AudioContext. Authoritative scripted deployment advances with wall time even after a delayed host callback; walking and combat retain the 50 ms physics cap. Crossing the entire landed stage in one delayed callback still emits touchdown once. Combat remains locked until pod exit. Hidden world rendering is skipped during full blackout.

## Audio verification

The uploaded recording independently transcribes as “Game.” Unprompted recognition of the edited opening includes “in this game”; ASR mishears the preserved “stunts” word, which was not edited. The replacement spans 2.540–2.920 seconds with 12 ms crossfades and pitch-preserving time compression. Intermediate WAV duration and samples outside the replacement remain unchanged. The final stereo MP3 decodes to 26.680 seconds with a 650 ms tail fade. Extraction details and cue uncertainty are in `public/audio/README.md`.

Analysis used Whisper.cpp Small/base from CapSoftware's GitHub transcription-models distribution, Small DTW, PocketSphinx phone alignment and waveform measurements. First adlib timing is medium confidence; remaining spoken onsets have approximately 80 ms measurement uncertainty.

## Completed checks

- `npm run check`: syntax checks, 231 Node tests and static build passed.
- `scripts/deployment-cinematic-check.mjs`: two actual BroadcastChannel clients; all six checks passed, with no browser errors. Music starts on full black, title follows the cue, operator is visible by business, each pod reaches its own destination, opening/exit restore gameplay, and each client plays one music source and receives one touchdown.
- Visible touchdown occurred 75 ms after the measured cue on the host and 16 ms after it on the guest in the recorded software-rendered Chromium run. These are observations of that run, rather than a guarantee for other hardware or network conditions.
- Independent Chromium review reproduced and verified fixes for leaving mid-intro and a fresh match reusing `1:1`: no restarted audio or lingering blackout on leave; the next match starts a fresh source with a reset clock.

Artifacts are retained under `/workspace/fortmulti-artifacts/deployment/`: audio-cues.json, deployment-browser-results.json, four screenshots, raw two-client recordings and HORIZON-deployment-preview.mp4. The preview uses the actual guest browser recording with the edited soundtrack and runtime gain envelopes; title fade measurements align the browser recording to the song.
