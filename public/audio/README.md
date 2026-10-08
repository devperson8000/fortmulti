# Game samples

`ar-shot.wav` is one shot extracted from the user-supplied `download.mp4` on 2026-10-08. The uploaded clip contains a continuous burst; only the final blast and its decay are included in this asset.

The AR now keeps the remaining source tail, pads silence to 360 ms, and fades out over 220 ms instead of ending with a short 25 ms fade. Its blast retains the original attack. The game plays an independent source per bullet at gain 0.32.

`shotgun-shot.wav` and `shotgun-reload.wav` come from the user-supplied `download (1).mp4` on 2026-10-08. The separate blast is extracted from 4.700–6.460 seconds, with a 240 ms tail fade. The reload sequence is extracted from 0–3.600 seconds and compressed to 2.700 seconds with pitch-preserving `atempo`; its final pump aligns with the weapon animation's action phase. The shotgun's authoritative reload duration is also 2.700 seconds. These are separate samples; a trigger pull plays one blast, while a confirmed reload plays its own sample.

Weapon assets are mono 48 kHz 16-bit PCM. Normal playback has no looping. Reload audio starts at the corresponding offset if the accepted snapshot arrives late. Switching weapons, death, completion, and menus cancel it with a 45 ms fade, without replaying delayed events.

`deployment-intro.mp3` comes from the user-supplied `hunumankind.mp3`, with the spoken word “game” isolated from the supplied screen recording. The original “movie” interval at 2.540–2.920 seconds is replaced in place by the recording's 3.330–3.835 second word. Pitch-preserving time compression (1.328947×), 12 ms crossfades, a 110–6500 Hz voice filter and +3.47 dB gain fit the replacement. The original stereo side signal and center below 100 Hz preserve the underlying bed. The full intermediate WAV retains the original sample count and unchanged samples outside this splice. Independent unprompted Whisper Small recognition identifies “game” in both the recording and the edited opening.

The deployment asset retains the complete 30.000-second edited song, stereo 44.1 kHz at 192 kbps MP3. Runtime playback uses one continuous, non-looping source at gain 0.65, with a 650 ms opening fade. The original verse continues through the hatch opening, walkout and held salute. A 400 ms fade ends at song time 29.835 seconds, when gameplay begins. Recovery during the final fade seeks to the current original-song offset and preserves the fade's remaining quiet level and exact deadline. Native Chromium OfflineAudioContext verification at 44.1 and 48 kHz compares the rendered middle and ending to the original decoded samples and verifies silence after the handoff.

Decoded buffers are reused across rounds. Each sequence is keyed to the same audible clock. Blackout begins before playback. The camera, title and host's scripted deployment follow the same audible clock: valid device output timestamps account for render-ahead latency, with AudioContext time as the fallback. Timestamp jitter never reverses the camera. Suspending the context cancels its frozen voice; recovery seeks to the current deployment cue rather than replaying the missed section. Completed sequences cannot restart from stale snapshots. Leaving resets the player, including for a new match reusing a sequence ID.

Measured song-relative cues are shared in `deployment-cues.js`: first “uh” 9.590, “Wait” 20.190, “When” 23.550, returning bass drop 25.285, “Big” 25.580 and “stepper” 25.770 seconds. The first “uh” uses an accompaniment-subtracted vocal onset (about ±20 ms); the landing uses the returning kick/bass onset (about ±10 ms), rather than the later lyric. The lyric onsets combine ASR and forced alignment with about 80 ms uncertainty. The title starts at the first “uh” and fades at the opening lyric; touchdown, its debris burst and camera punch use the bass-drop cue.

Reproduction with the original upload:

```sh
ffmpeg -i download.mp4 -vn -ac 1 -ar 48000 -c:a pcm_s16le source.wav
ffmpeg -i source.wav -af 'atrim=start=1.928:duration=0.36,asetpts=PTS-STARTPTS,apad=whole_dur=0.36,atrim=duration=0.36,afade=t=in:st=0:d=0.0008,afade=t=out:st=0.14:d=0.22,volume=0.85' -ac 1 -ar 48000 -c:a pcm_s16le ar-shot.wav
ffmpeg -i 'download (1).mp4' -vn -ac 1 -ar 48000 -c:a pcm_s16le shotgun-source.wav
ffmpeg -i shotgun-source.wav -af 'atrim=start=4.7:duration=1.76,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.001,afade=t=out:st=1.52:d=0.24,volume=0.82' -ac 1 -ar 48000 -c:a pcm_s16le shotgun-shot.wav
ffmpeg -i shotgun-source.wav -af 'atrim=start=0:duration=3.6,asetpts=PTS-STARTPTS,atempo=1.333333333333,apad=whole_dur=2.7,atrim=duration=2.7,afade=t=in:st=0:d=0.002,afade=t=out:st=2.65:d=0.05,volume=0.85' -ac 1 -ar 48000 -c:a pcm_s16le shotgun-reload.wav
```
