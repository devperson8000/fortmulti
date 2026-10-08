// Seconds in deployment-intro.mp3. Opening speech is replaced in place, so
// these measured waveform / accompaniment-residual onsets retain its timing.
export const DEPLOYMENT_CUES=Object.freeze({
 mainRiff:3.92,
 uhYeahStart:9.59,
 lyricsStart:20.19,
 businessStart:23.55,
 // The returning bass/kick is ahead of the word Big; land on the beat itself.
 impact:25.285,
 bigStart:25.58,
 stepperStart:25.77
});

// Eight beats at 90 BPM, measured as exactly 235200 samples at 44.1 kHz.
// Both boundaries are before the first vocal. Phase follows the song timeline.
export const DEPLOYMENT_RIFF=Object.freeze({start:173578/44100,end:408778/44100,crossfade:.12});
