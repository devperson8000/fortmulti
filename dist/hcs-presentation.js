// Presentation consumes the snapshot it is given. Spectator snapshots have
// already passed through DelayedFeed; no live winner lookup is allowed here.
import {
  hcsVictoryCinematic,
  HCS_VICTORY_DURATION,
} from "./hcs-victory-cinematic.js";
let victoryFrame = null,
  victoryOwner = null;
export const getHCSVictoryFrame = () => victoryFrame;
let deploymentBrand = null;
export function setDeploymentBrand(hcs) {
  if (deploymentBrand === hcs) return;
  const mark = document.querySelector("#deployment-cinematic img");
  if (!mark) return;
  deploymentBrand = hcs;
  mark.src = hcs ? "hcs-logo.png" : "horizon-logo-transparent.webp";
  document
    .getElementById("deployment-cinematic")
    .classList.toggle("hcs-deployment", hcs);
}
export function hcsResult(
  state,
  profiles = [],
  identity = null,
  spectator = false,
) {
  if (
    state?.phase !== "done" ||
    !Number.isInteger(state.winner) ||
    state.winner < 0
  )
    return null;
  const player = state.players?.[state.winner];
  if (!player || player.hp <= 0) return null;
  const profile = profiles.find((p) => p.id === player.id);
  return {
    id: player.id,
    name: profile?.name || "Horizon Champion",
    won: !spectator && identity === player.id,
    kills: state.tournamentKills?.[player.id] || 0,
    seconds: Math.max(0, Math.round(state.elapsed || 0)),
    key: `${state.round}:${player.id}`,
  };
}

export function hcsHeroState(state, cinematic = null) {
  const result = hcsResult(state);
  if (!result) return state;
  return {
    ...state,
    players: state.players.map((p) =>
      p.id === result.id
        ? {
            ...p,
            saluteProgress: 1,
            weapon: null,
            slot: 0,
            aim: false,
            reload: 0,
            grounded: true,
            vy: 0,
            crouching: false,
            sliding: false,
            sprinting: false,
            animationState: "idle",
            moveSpeed: 0,
            ...(cinematic
              ? {
                  p: cinematic.actor.slice(),
                  air: cinematic.scene === "ship" ? "ship" : "landed",
                  shipLocal: null,
                  pod: null,
                  yaw: cinematic.yaw,
                  saluteProgress: cinematic.salute,
                  animationState: cinematic.animationState,
                  moveSpeed: cinematic.moveSpeed,
                }
              : {}),
          }
        : p,
    ),
  };
}

export function playHCSFanfare(audio) {
  if (!audio || audio.state !== "running") return () => {};
  const voices = [];
  try {
    for (const [offset, frequency] of [
      [0, 261.63],
      [0.18, 329.63],
      [0.36, 392],
      [0.65, 523.25],
      [0.65, 659.25],
      [0.65, 783.99],
    ]) {
      const oscillator = audio.createOscillator(),
        gain = audio.createGain(),
        start = audio.currentTime + offset;
      oscillator.type = "triangle";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.012, start + 0.045);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.85);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.9);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
      voices.push(oscillator);
    }
  } catch {}
  return () => {
    for (const voice of voices)
      try {
        voice.stop();
      } catch {}
  };
}

export function createHCSCelebration({
  onControls,
  onExit,
  id = "hcs-finale",
  clock = () => performance.now(),
}) {
  const root = document.createElement("section");
  root.id = id;
  root.className = "hcs-finale";
  root.hidden = true;
  root.setAttribute("aria-labelledby", id + "-title");
  root.innerHTML = `<div class="hcs-confetti" aria-hidden="true"></div><div class="hcs-finale-copy"><small data-finale="eyebrow">HORIZON CHAMPIONSHIP SERIES</small><div class="hcs-victory-crest" aria-hidden="true"><img src="hcs-logo.png" alt=""></div><h1 data-finale="title">CHAMPION CROWNED</h1><h2 data-finale="name"></h2><p data-finale="stats"></p><p data-finale="note"></p><div class="hcs-finale-actions"><button data-finale="controls" type="button">TEST CONTROLS / REPORT</button><button data-finale="exit" type="button">RETURN TO LOBBY</button></div></div>`;
  document.body.append(root);
  const fadeLayer = document.createElement("div");
  fadeLayer.className = "hcs-victory-fade";
  fadeLayer.id = id + "-fade";
  fadeLayer.hidden = true;
  fadeLayer.setAttribute("aria-hidden", "true");
  document.body.append(fadeLayer);
  root.querySelector("h1").id = id + "-title";
  const $ = (name) =>
    root.querySelector(
      '[data-finale="' + name.replace("hcs-finale-", "") + '"]',
    );
  $("hcs-finale-controls").onclick = onControls;
  $("hcs-finale-exit").onclick = onExit;
  let key = "",
    cancelFanfare = () => {},
    started = 0,
    lastAge = -1,
    lastSample = 0,
    celebrated = false,
    pickupContext = null;
  return {
    update(
      state,
      profiles,
      identity,
      { spectator = false, testOnly = false } = {},
    ) {
      const result = hcsResult(state, profiles, identity, spectator);
      if (!result) {
        this.reset();
        return null;
      }
      const token = result.key + ":" + testOnly + ":" + result.won;
      const now = clock();
      if (token !== key) {
        cancelFanfare();
        key = token;
        const winner = state.players[state.winner];
        pickupContext = window.Game?.victoryPickup?.(winner) || {
          winner: winner.p.slice(),
          yaw: Number(winner.yaw) || 0,
        };
        started = now;
        lastAge = -1;
        celebrated = false;
        root.hidden = true;
        fadeLayer.hidden = false;
        document.body.classList.add("hcs-celebrating");
        root.dataset.won = String(result.won);
        $("hcs-finale-eyebrow").textContent = testOnly
          ? "LOCAL HCS PRACTICE · NO OFFICIAL TITLE"
          : "HORIZON CHAMPIONSHIP SERIES";
        $("hcs-finale-title").textContent = result.won
          ? "HCS VICTORY"
          : "CHAMPION CROWNED";
        $("hcs-finale-name").textContent = result.name;
        $("hcs-finale-stats").textContent =
          `LAST OPERATOR STANDING · ${result.kills} ELIMINATIONS · ${Math.floor(result.seconds / 60)}:${String(result.seconds % 60).padStart(2, "0")}`;
        $("hcs-finale-note").textContent = testOnly
          ? "Practice champion. Official standings are unchanged."
          : spectator
            ? "20-second delayed championship broadcast."
            : "The Horizon Championship Series final is complete.";
        $("hcs-finale-controls").hidden = !testOnly;
      }
      const age = Number.isFinite(state.victoryElapsed)
        ? state.victoryElapsed
        : (now - started) / 1000;
      if (age !== lastAge) {
        lastAge = age;
        lastSample = now;
      }
      let elapsed = age + (now - lastSample) / 1000;
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced && elapsed >= 0.85) elapsed = HCS_VICTORY_DURATION;
      else
        elapsed = window.Game?.victoryElapsed?.(result.key, elapsed) ?? elapsed;
      victoryFrame = hcsVictoryCinematic(elapsed, pickupContext);
      victoryFrame.sampledAt = now;
      victoryOwner = id;
      fadeLayer.style.opacity = String(victoryFrame.fade);
      document.body.classList.toggle(
        "hcs-victory-running",
        !victoryFrame.showResults,
      );
      if (victoryFrame.showResults && !celebrated) {
        celebrated = true;
        root.hidden = false;
        cancelFanfare = window.Game?.celebrateHCS?.() || (() => {});
        const count = reduced
            ? 0
            : document.body.dataset.quality === "low"
              ? 16
              : 32,
          confetti = root.querySelector(".hcs-confetti");
        confetti.replaceChildren(
          ...Array.from({ length: count }, (_, i) => {
            const piece = document.createElement("i");
            piece.style.cssText = `--x:${(i * 37) % 100}%;--drift:${(i % 2 ? 1 : -1) * (30 + (i % 5) * 22)}px;--spin:${(i % 2 ? 1 : -1) * 360}deg;--wait:${(i % 8) * 0.09}s;--duration:${3.8 + (i % 5) * 0.25}s;--color:${["#ffc94f", "#ff7a3c", "#ff4877", "#f7e6ad"][i % 4]}`;
            return piece;
          }),
        );
      }
      return { ...result, cinematic: victoryFrame };
    },
    reset() {
      if (!key) return;
      key = "";
      cancelFanfare();
      root.hidden = true;
      fadeLayer.hidden = true;
      if (victoryOwner === id) {
        victoryOwner = null;
        victoryFrame = null;
        document.body.classList.remove("hcs-victory-running");
      }
      root.querySelector(".hcs-confetti").replaceChildren();
      document.body.classList.remove("hcs-celebrating");
    },
  };
}
