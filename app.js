/* Simple Timer (no dependencies) */

const els = {
  time: document.getElementById("time"),
  status: document.getElementById("status"),
  minutes: document.getElementById("minutes"),
  seconds: document.getElementById("seconds"),
  startPause: document.getElementById("startPause"),
  reset: document.getElementById("reset"),
  progress: document.querySelector(".progress"),
  progressBar: document.getElementById("progressBar"),
  controls: document.getElementById("controls"),
};

/** @type {{ running: boolean; durationMs: number; remainingMs: number; endTimeMs: number | null; intervalId: number | null; }} */
const state = {
  running: false,
  durationMs: 5 * 60 * 1000,
  remainingMs: 5 * 60 * 1000,
  endTimeMs: null,
  intervalId: null,
};

function clampInt(value, min, max) {
  const n = Number.parseInt(String(value), 10);
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function updateUI() {
  els.time.textContent = formatTime(state.remainingMs);

  const duration = Math.max(0, state.durationMs);
  const done = duration > 0 ? (duration - state.remainingMs) / duration : 0;
  const pct = Math.max(0, Math.min(1, done));
  const pct100 = Math.round(pct * 100);

  els.progressBar.style.width = `${pct100}%`;
  els.progress.setAttribute("aria-valuenow", String(pct100));

  if (state.running) {
    els.status.textContent = "Running…";
    els.startPause.textContent = "Pause";
  } else if (state.remainingMs === 0 && state.durationMs > 0) {
    els.status.textContent = "Done";
    els.startPause.textContent = "Start";
  } else if (state.remainingMs !== state.durationMs) {
    els.status.textContent = "Paused";
    els.startPause.textContent = "Resume";
  } else {
    els.status.textContent = "Ready";
    els.startPause.textContent = "Start";
  }
}

function setInputsFromMs(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  els.minutes.value = String(m);
  els.seconds.value = String(s);
}

function syncDurationFromInputs() {
  const m = clampInt(els.minutes.value, 0, 999);
  const s = clampInt(els.seconds.value, 0, 59);
  els.minutes.value = String(m);
  els.seconds.value = String(s);

  const ms = (m * 60 + s) * 1000;
  state.durationMs = ms;
  state.remainingMs = ms;
  state.endTimeMs = null;
  updateUI();
}

function stopTicker() {
  if (state.intervalId !== null) {
    window.clearInterval(state.intervalId);
    state.intervalId = null;
  }
}

function beep() {
  // WebAudio beep (no external files). Safe to fail silently.
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.0001;

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

    osc.start(now);
    osc.stop(now + 0.26);

    osc.onended = () => {
      ctx.close().catch(() => {});
    };
  } catch {
    // ignore
  }
}

function tick() {
  if (!state.running || state.endTimeMs === null) return;
  const now = Date.now();
  const remaining = Math.max(0, state.endTimeMs - now);
  state.remainingMs = remaining;
  updateUI();

  if (remaining === 0) {
    state.running = false;
    state.endTimeMs = null;
    stopTicker();
    beep();
    updateUI();
  }
}

function start() {
  if (state.durationMs <= 0) {
    syncDurationFromInputs();
  }
  if (state.remainingMs <= 0) {
    // If it finished, restart using the current inputs.
    syncDurationFromInputs();
  }
  if (state.remainingMs <= 0) {
    updateUI();
    return;
  }

  state.running = true;
  state.endTimeMs = Date.now() + state.remainingMs;
  stopTicker();
  state.intervalId = window.setInterval(tick, 100);
  tick();
}

function pause() {
  if (!state.running) return;
  state.running = false;
  if (state.endTimeMs !== null) {
    state.remainingMs = Math.max(0, state.endTimeMs - Date.now());
  }
  state.endTimeMs = null;
  stopTicker();
  updateUI();
}

function reset() {
  state.running = false;
  stopTicker();

  // Reset back to whatever the inputs are set to.
  const m = clampInt(els.minutes.value, 0, 999);
  const s = clampInt(els.seconds.value, 0, 59);
  const ms = (m * 60 + s) * 1000;
  state.durationMs = ms;
  state.remainingMs = ms;
  state.endTimeMs = null;

  updateUI();
}

function toggleStartPause() {
  if (state.running) pause();
  else start();
}

// Events
els.startPause.addEventListener("click", toggleStartPause);
els.reset.addEventListener("click", reset);

els.minutes.addEventListener("change", () => {
  if (!state.running) syncDurationFromInputs();
});
els.seconds.addEventListener("change", () => {
  if (!state.running) syncDurationFromInputs();
});
els.minutes.addEventListener("blur", () => {
  if (!state.running) syncDurationFromInputs();
});
els.seconds.addEventListener("blur", () => {
  if (!state.running) syncDurationFromInputs();
});

els.controls.addEventListener("click", (e) => {
  const target = /** @type {HTMLElement} */ (e.target);
  if (!(target instanceof HTMLButtonElement)) return;
  if (!target.classList.contains("chip")) return;
  const m = clampInt(target.dataset.min, 0, 999);
  const s = clampInt(target.dataset.sec, 0, 59);
  els.minutes.value = String(m);
  els.seconds.value = String(s);
  if (!state.running) syncDurationFromInputs();
});

document.addEventListener("keydown", (e) => {
  // Don't hijack typing in inputs.
  const active = document.activeElement;
  const typing =
    active &&
    (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.getAttribute("contenteditable") === "true");
  if (typing) return;

  if (e.code === "Space") {
    e.preventDefault();
    toggleStartPause();
  } else if (e.key.toLowerCase() === "r") {
    reset();
  }
});

// Init
syncDurationFromInputs();
