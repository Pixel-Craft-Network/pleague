import { createMatch, formatClock, getMatchResult, stepMatch, clamp } from "./physics.js";
import { create3DScene } from "./scene3d.js";
import { SoundKit } from "./sound.js";

const $ = (selector) => document.querySelector(selector);
const canvas = $("#game-canvas");
const viewport = $("#viewport");
const menuScreen = $("#menu-screen");
const matchUI = $("#match-ui");
const centerCallout = $("#center-callout");
const pauseModal = $("#pause-modal");
const resultModal = $("#result-modal");
const helpModal = $("#help-modal");
const toast = $("#toast");
const touchControls = $("#touch-controls");
const keys = new Set();
const touchInput = { throttle: 0, steer: 0, boost: false };
function readStorage(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function writeStorage(key, value) {
  try { localStorage.setItem(key, value); } catch { /* Storage is optional. */ }
}
const soundPref = readStorage("pixelLeagueSound", "on") !== "off";
const sound = new SoundKit(soundPref);
const touchDevice = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;

const ARENA_NAMES = { neon: "NEON DOME", sunset: "SUNSET CIRCUIT", frost: "FROSTBYTE FIELD" };
let settings = readSettings();
let state = createMatch(settings);
let visuals = create3DScene(canvas, state);
let visualArena = settings.arena;
let screen = "menu";
let paused = false;
let jumpPulse = false;
let accumulator = 0;
let previousFrame = performance.now();
let lastPhase = state.phase;
let lastCountdownNumber = null;
let goCalloutUntil = 0;
let lastGoalCopy = "";
let resultShown = false;
let lastHitSoundTime = -1;
let lastPickupBoost = 0;
let toastTimeout = 0;

function readSettings() {
  let stored = {};
  try { stored = JSON.parse(readStorage("pixelLeagueSettings", "{}")); } catch { stored = {}; }
  return {
    mode: stored.mode === "2v2" ? "2v2" : "1v1",
    arena: ["neon", "sunset", "frost"].includes(stored.arena) ? stored.arena : "neon",
    duration: Number(stored.duration) === 90 ? 90 : 180,
    difficulty: ["rookie", "pro", "ace"].includes(stored.difficulty) ? stored.difficulty : "pro",
    team: stored.team === "orange" ? "orange" : "blue",
  };
}

function saveSettings() {
  writeStorage("pixelLeagueSettings", JSON.stringify(settings));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove("show"), 2100);
}

function syncSettingsControls() {
  $("#mode-select").value = settings.mode;
  $("#arena-select").value = settings.arena;
  $("#time-select").value = String(settings.duration);
  $("#skill-select").value = settings.difficulty;
  document.querySelectorAll(".team-choice").forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.team === settings.team);
    button.setAttribute("aria-pressed", String(button.dataset.team === settings.team));
  });
  const callout = $(".arena-callout");
  callout.querySelector("b").textContent = ARENA_NAMES[settings.arena];
  if (screen === "menu") state = createMatch(settings);
  if (visuals && visualArena !== settings.arena) {
    visuals.setArena(settings.arena);
    visualArena = settings.arena;
  }
}

$("#mode-select").addEventListener("change", (event) => {
  settings.mode = event.target.value === "2v2" ? "2v2" : "1v1";
  saveSettings();
  if (screen === "menu") state = createMatch(settings);
  sound.play("click");
});
$("#arena-select").addEventListener("change", (event) => {
  settings.arena = event.target.value;
  saveSettings();
  syncSettingsControls();
  sound.play("click");
});
$("#time-select").addEventListener("change", (event) => {
  settings.duration = Number(event.target.value) === 90 ? 90 : 180;
  saveSettings();
  sound.play("click");
});
$("#skill-select").addEventListener("change", (event) => {
  settings.difficulty = event.target.value;
  saveSettings();
  sound.play("click");
});
document.querySelectorAll(".team-choice").forEach((button) => {
  button.addEventListener("click", () => {
    settings.team = button.dataset.team;
    saveSettings();
    syncSettingsControls();
    sound.play("click");
  });
});
syncSettingsControls();

function setScreen(next) {
  screen = next;
  const inMatch = screen === "match";
  viewport.classList.toggle("in-match", inMatch);
  menuScreen.classList.toggle("is-hidden", inMatch);
  matchUI.classList.toggle("is-hidden", !inMatch);
  touchControls.classList.toggle("is-hidden", !inMatch || !touchDevice);
  $("#match-label").innerHTML = `<span class="live-dot"></span> LIVE MATCH <small>·</small> ${ARENA_NAMES[settings.arena]}`;
}

function startMatch() {
  settings = {
    mode: $("#mode-select").value === "2v2" ? "2v2" : "1v1",
    arena: $("#arena-select").value,
    duration: Number($("#time-select").value) === 90 ? 90 : 180,
    difficulty: $("#skill-select").value,
    team: settings.team,
  };
  saveSettings();
  state = createMatch(settings);
  if (visualArena !== settings.arena) {
    visuals.setArena(settings.arena);
    visualArena = settings.arena;
  }
  keys.clear();
  touchInput.throttle = 0;
  touchInput.steer = 0;
  touchInput.boost = false;
  jumpPulse = false;
  resetStick();
  paused = false;
  resultShown = false;
  lastPhase = state.phase;
  lastCountdownNumber = null;
  lastGoalCopy = "";
  goCalloutUntil = 0;
  lastHitSoundTime = -1;
  accumulator = 0;
  pauseModal.classList.add("is-hidden");
  resultModal.classList.add("is-hidden");
  setScreen("match");
  lastPickupBoost = state.cars.find((car) => car.player)?.boost ?? 0;
  syncGameUI(performance.now());
  sound.play("click");
}

function backToMenu() {
  paused = false;
  jumpPulse = false;
  keys.clear();
  touchInput.throttle = 0;
  touchInput.steer = 0;
  touchInput.boost = false;
  resetStick();
  pauseModal.classList.add("is-hidden");
  resultModal.classList.add("is-hidden");
  centerCallout.classList.add("is-hidden");
  state = createMatch(settings);
  lastPhase = state.phase;
  lastCountdownNumber = null;
  setScreen("menu");
}

function restartMatch() {
  startMatch();
}

function setPaused(value) {
  if (screen !== "match" || state.phase === "finished") return;
  paused = Boolean(value);
  pauseModal.classList.toggle("is-hidden", !paused);
  if (paused) {
    keys.clear();
    touchInput.boost = false;
    touchInput.throttle = 0;
    touchInput.steer = 0;
    jumpPulse = false;
  }
  accumulator = 0;
  syncGameUI(performance.now());
  sound.play("click");
}

$("#play-button").addEventListener("click", startMatch);
$("#pause-button").addEventListener("click", () => setPaused(true));
$("#brand-home").addEventListener("click", (event) => {
  event.preventDefault();
  if (screen === "match") backToMenu();
});
$("#sound-toggle").addEventListener("click", () => {
  sound.setEnabled(!sound.enabled);
  writeStorage("pixelLeagueSound", sound.enabled ? "on" : "off");
  $("#sound-label").textContent = sound.enabled ? "SOUND ON" : "SOUND OFF";
  $("#sound-toggle").setAttribute("aria-pressed", String(sound.enabled));
  if (sound.enabled) sound.play("click");
});
$("#sound-label").textContent = sound.enabled ? "SOUND ON" : "SOUND OFF";
$("#sound-toggle").setAttribute("aria-pressed", String(sound.enabled));

function openHelp() {
  helpModal.classList.remove("is-hidden");
}
function closeHelp() {
  helpModal.classList.add("is-hidden");
}
$("#how-to-play").addEventListener("click", openHelp);
$("#help-close").addEventListener("click", closeHelp);
$("#help-done").addEventListener("click", closeHelp);
helpModal.addEventListener("click", (event) => { if (event.target === helpModal) closeHelp(); });

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.dataset.action;
    sound.play("click");
    if (action === "resume") setPaused(false);
    else if (action === "restart" || action === "rematch") startMatch();
    else if (action === "leave") backToMenu();
  });
});

function toggleSound() {
  sound.setEnabled(!sound.enabled);
  writeStorage("pixelLeagueSound", sound.enabled ? "on" : "off");
  $("#sound-label").textContent = sound.enabled ? "SOUND ON" : "SOUND OFF";
  $("#sound-toggle").setAttribute("aria-pressed", String(sound.enabled));
  showToast(sound.enabled ? "SOUND ENABLED" : "SOUND MUTED");
}

window.addEventListener("keydown", (event) => {
  if (event.code === "Escape" || event.code === "KeyP") {
    if (!helpModal.classList.contains("is-hidden")) {
      closeHelp();
      return;
    }
    if (screen === "match" && state.phase !== "finished" && !event.repeat) setPaused(!paused);
    return;
  }
  if (event.code === "KeyM" && !event.repeat) {
    toggleSound();
    return;
  }
  if (event.code === "KeyF" && !event.repeat) {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else viewport.requestFullscreen?.().catch(() => {});
  }
  if (screen === "match" && ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) event.preventDefault();
  if (event.repeat) return;
  keys.add(event.code);
  if (screen === "match" && !paused && event.code === "Space") jumpPulse = true;
  if (screen === "match" && !paused && event.code === "KeyR") restartMatch();
});
window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});
window.addEventListener("blur", () => {
  keys.clear();
  if (screen === "match" && !paused && state.phase !== "finished") setPaused(true);
});

function normalizedInput() {
  const forward = Number(keys.has("KeyW") || keys.has("ArrowUp")) - Number(keys.has("KeyS") || keys.has("ArrowDown"));
  const steer = Number(keys.has("KeyD") || keys.has("ArrowRight")) - Number(keys.has("KeyA") || keys.has("ArrowLeft"));
  const throttle = clamp(forward + touchInput.throttle, -1, 1);
  const turn = clamp(steer + touchInput.steer, -1, 1);
  return {
    throttle,
    steer: turn,
    boost: keys.has("ShiftLeft") || keys.has("ShiftRight") || touchInput.boost,
    jumpPressed: false,
  };
}

// The analog control is a true pointer-driven stick, so it also works with a mouse in dev tools.
const stick = $("#touch-stick");
const knob = $("#stick-knob");
let activeStickPointer = null;
function updateStick(event) {
  const rect = stick.getBoundingClientRect();
  const radius = rect.width * 0.36;
  const dx = event.clientX - (rect.left + rect.width / 2);
  const dy = event.clientY - (rect.top + rect.height / 2);
  const length = Math.hypot(dx, dy) || 1;
  const scale = Math.min(1, radius / length);
  const boundedX = dx * scale;
  const boundedY = dy * scale;
  knob.style.transform = `translate(calc(-50% + ${boundedX}px), calc(-50% + ${boundedY}px))`;
  touchInput.steer = clamp(boundedX / radius, -1, 1);
  touchInput.throttle = clamp(-boundedY / radius, -1, 1);
}
function resetStick() {
  activeStickPointer = null;
  touchInput.steer = 0;
  touchInput.throttle = 0;
  knob.style.transform = "translate(-50%,-50%)";
}
stick.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  activeStickPointer = event.pointerId;
  stick.setPointerCapture(event.pointerId);
  updateStick(event);
});
stick.addEventListener("pointermove", (event) => {
  if (event.pointerId === activeStickPointer) updateStick(event);
});
stick.addEventListener("pointerup", resetStick);
stick.addEventListener("pointercancel", resetStick);

function bindHoldButton(button, onDown, onUp) {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    button.classList.add("is-active");
    onDown();
  });
  const end = () => {
    button.classList.remove("is-active");
    onUp();
  };
  button.addEventListener("pointerup", end);
  button.addEventListener("pointercancel", end);
  button.addEventListener("lostpointercapture", end);
}
bindHoldButton($("#touch-boost"), () => { touchInput.boost = true; }, () => { touchInput.boost = false; });
bindHoldButton($("#touch-jump"), () => { jumpPulse = true; }, () => {});

const segments = $("#boost-segments");
for (let i = 0; i < 10; i += 1) segments.append(document.createElement("i"));

function setCallout(eyebrow, title, subtitle, team = "") {
  centerCallout.classList.remove("is-hidden", "goal-blue", "goal-orange");
  if (team) centerCallout.classList.add(`goal-${team}`);
  $("#callout-eyebrow").textContent = eyebrow;
  $("#callout-title").textContent = title;
  $("#callout-subtitle").textContent = subtitle;
}

function updateCallout(now) {
  if (state.phase === "kickoff") {
    const number = Math.max(1, Math.ceil(state.countdown));
    if (number !== lastCountdownNumber) {
      lastCountdownNumber = number;
      setCallout("KICKOFF", String(number), "FIRST TO THE BALL");
      if (number <= 3) sound.play("count");
    }
  } else if (state.phase === "goal") {
    const team = state.lastGoal?.team || "blue";
    const scoreKey = `${state.scores.blue}-${state.scores.orange}`;
    if (scoreKey !== lastGoalCopy) {
      lastGoalCopy = scoreKey;
      const teamName = team === "blue" ? "SKY" : "SUN";
      setCallout(`${teamName} SCORES`, "GOAL!", state.overtime ? "GOLDEN GOAL" : "NICE FINISH", team);
      sound.play("goal");
    }
  } else if (state.phase === "live") {
    if (lastPhase === "kickoff") {
      setCallout("KICKOFF", "GO!", "MAKE YOUR MOVE");
      goCalloutUntil = now + 700;
      sound.play("go");
      lastCountdownNumber = null;
    } else if (now >= goCalloutUntil && state.lastGoal?.team !== "") {
      centerCallout.classList.add("is-hidden");
    }
  } else if (state.phase === "finished") {
    centerCallout.classList.add("is-hidden");
    if (!resultShown) showResults();
  }
}

function showResults() {
  resultShown = true;
  const winner = getMatchResult(state);
  const playerWon = winner === settings.team;
  $("#final-blue").textContent = String(state.scores.blue);
  $("#final-orange").textContent = String(state.scores.orange);
  if (winner === "draw") {
    $("#result-title").textContent = "DEAD EVEN.";
    $("#result-copy").textContent = "A perfect tie. Take it to overtime next time.";
  } else if (playerWon) {
    $("#result-title").textContent = "YOU TAKE THE WIN.";
    $("#result-copy").textContent = "A top-tier performance. Run it back?";
  } else {
    $("#result-title").textContent = "THEY GOT THIS ONE.";
    $("#result-copy").textContent = "Every touch counts. Ready for a rematch?";
  }
  $("#result-kicker").textContent = state.overtime ? "OVERTIME · FINAL WHISTLE" : "MATCH COMPLETE";
  pauseModal.classList.add("is-hidden");
  resultModal.classList.remove("is-hidden");
  sound.play("whistle");
}

function syncGameUI(now) {
  $("#blue-score").textContent = String(state.scores.blue);
  $("#orange-score").textContent = String(state.scores.orange);
  $("#clock").textContent = state.overtime ? "OT" : formatClock(state.timeLeft);
  const phaseLabel = paused ? "PAUSED" : state.overtime ? "OVERTIME" : state.phase === "kickoff" ? "KICKOFF" : state.phase === "goal" ? "GOAL" : state.phase === "finished" ? "FINAL" : "LIVE";
  $("#clock-state").textContent = phaseLabel;
  const player = state.cars.find((car) => car.player);
  if (player) {
    const level = Math.round(player.boost);
    $("#boost-number").textContent = String(level).padStart(2, "0");
    [...segments.children].forEach((segment, index) => segment.classList.toggle("filled", level >= (index + 1) * 10));
    if (player.boost > lastPickupBoost + 8 && state.phase === "live") sound.play("pickup");
    lastPickupBoost = player.boost;
  }
  updateCallout(now);
}

function animationFrame(now) {
  const elapsed = Math.min(0.08, Math.max(0, (now - previousFrame) / 1000));
  previousFrame = now;
  if (screen === "match" && !paused && state.phase !== "finished") {
    accumulator += elapsed;
    const jumpPending = jumpPulse;
    let jumpConsumed = false;
    let steps = 0;
    while (accumulator >= 1 / 60 && steps < 5) {
      const input = normalizedInput();
      if (jumpPending && !jumpConsumed) {
        input.jumpPressed = true;
        jumpConsumed = true;
      }
      const oldTouchTime = state.lastTouch?.time ?? -1;
      stepMatch(state, input, 1 / 60);
      const newTouchTime = state.lastTouch?.time ?? -1;
      if (newTouchTime > oldTouchTime && newTouchTime - lastHitSoundTime > 0.24) {
        sound.play("hit");
        lastHitSoundTime = newTouchTime;
      }
      accumulator -= 1 / 60;
      steps += 1;
    }
    if (jumpConsumed) jumpPulse = false;
    if (steps >= 5) accumulator = 0;
    syncGameUI(now);
  }
  visuals.render(state, now, screen === "menu");
  lastPhase = state.phase;
  requestAnimationFrame(animationFrame);
}

// Keep the preview alive and don't let the canvas blur when a display changes size.
window.addEventListener("resize", () => visuals.resize());

if (touchDevice) touchControls.classList.add("is-hidden");
$("#match-label").innerHTML = `<span class="live-dot"></span> LIVE MATCH <small>·</small> ${ARENA_NAMES[settings.arena]}`;
requestAnimationFrame(animationFrame);
