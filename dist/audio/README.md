# Weapon samples

`ar-shot.wav` is one shot extracted from the user-supplied `download.mp4` on 2026-10-08. The uploaded clip contains a continuous burst; only the final blast and its decay are included in this asset.

The AR now keeps the remaining source tail, pads silence to 360 ms, and fades out over 220 ms instead of ending with a short 25 ms fade. Its blast retains the original attack. The game plays an independent source per bullet at gain 0.32.

`shotgun-shot.wav` and `shotgun-reload.wav` come from the user-supplied `download (1).mp4` on 2026-10-08. The separate blast is extracted from 4.700–6.460 seconds, with a 240 ms tail fade. The reload sequence is extracted from 0–3.600 seconds and compressed to 2.700 seconds with pitch-preserving `atempo`; its final pump aligns with the weapon animation's action phase. The shotgun's authoritative reload duration is also 2.700 seconds. These are separate samples; a trigger pull plays one blast, while a confirmed reload plays its own sample.

All assets are mono 48 kHz 16-bit PCM. Normal playback has no looping. Reload audio starts at the corresponding offset if the accepted snapshot arrives late. Switching weapons, death, completion, and menus cancel it with a 45 ms fade, without replaying delayed events.

Reproduction with the original upload:

```sh
ffmpeg -i download.mp4 -vn -ac 1 -ar 48000 -c:a pcm_s16le source.wav
ffmpeg -i source.wav -af 'atrim=start=1.928:duration=0.36,asetpts=PTS-STARTPTS,apad=whole_dur=0.36,atrim=duration=0.36,afade=t=in:st=0:d=0.0008,afade=t=out:st=0.14:d=0.22,volume=0.85' -ac 1 -ar 48000 -c:a pcm_s16le ar-shot.wav
ffmpeg -i 'download (1).mp4' -vn -ac 1 -ar 48000 -c:a pcm_s16le shotgun-source.wav
ffmpeg -i shotgun-source.wav -af 'atrim=start=4.7:duration=1.76,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.001,afade=t=out:st=1.52:d=0.24,volume=0.82' -ac 1 -ar 48000 -c:a pcm_s16le shotgun-shot.wav
ffmpeg -i shotgun-source.wav -af 'atrim=start=0:duration=3.6,asetpts=PTS-STARTPTS,atempo=1.333333333333,apad=whole_dur=2.7,atrim=duration=2.7,afade=t=in:st=0:d=0.002,afade=t=out:st=2.65:d=0.05,volume=0.85' -ac 1 -ar 48000 -c:a pcm_s16le shotgun-reload.wav
```
