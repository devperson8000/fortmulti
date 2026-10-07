# AR single-shot sample

`ar-shot.wav` is one shot extracted from the user-supplied `download.mp4` on 2026-10-08. The uploaded clip contains a continuous burst; only the final blast and its decay are included in this asset.

Extraction: mono 48 kHz PCM; source interval 1.928–2.228 seconds; 0.8 ms fade-in, 25 ms fade-out, and 0.85 amplitude multiplier. Duration: 300 ms. The game plays one independent buffer source per AR bullet at gain 0.32. No looping or complete-video playback.

Reproduction with the original upload:

```sh
ffmpeg -i download.mp4 -vn -ac 1 -ar 48000 -c:a pcm_s16le source.wav
ffmpeg -i source.wav -af 'atrim=start=1.928:duration=0.3,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.0008,afade=t=out:st=0.275:d=0.025,volume=0.85' -ac 1 -ar 48000 -c:a pcm_s16le ar-shot.wav
```
