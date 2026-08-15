import { CreatureRenderer } from "./creature/renderer.js";
import { CreatureMotion } from "./creature/motion.js";
import { AmbientParticles } from "./ambient-particles.js";
import { TimerEngine, formatTime } from "./timer-engine.js";
import { LapsView } from "./laps-view.js";
import { StatsView } from "./stats-view.js";

const organismCanvas =
  document.querySelector("#organism");

const ambientCanvas =
  document.querySelector("#ambient-particles");

const timerDisplay =
  document.querySelector("#timer-display");

const timerStatus =
  document.querySelector("#timer-status");

const primaryButton =
  document.querySelector("#primary-button");

const primaryLabel =
  document.querySelector("#primary-label");

const pauseButton =
  document.querySelector("#pause-button");

const lapButton =
  document.querySelector("#lap-button");

const resetButton =
  document.querySelector("#reset-button");

const liveStatus =
  document.querySelector("#live-status");

const renderer =
  new CreatureRenderer(
    organismCanvas
  );

const motion =
  new CreatureMotion();

const ambientParticles =
  new AmbientParticles(
    ambientCanvas
  );

const timer =
  new TimerEngine();

const lapsView =
  new LapsView({
    list:
      document.querySelector("#laps-list"),

    empty:
      document.querySelector("#laps-empty"),

    badge:
      document.querySelector("#laps-count-badge"),
  });

const statsView =
  new StatsView({
    total:
      document.querySelector("#stat-total"),

    best:
      document.querySelector("#stat-best"),

    count:
      document.querySelector("#stat-count"),
  });

let lastRenderedCentisecond = -1;

function resizeVisuals() {
  renderer.setLayout({
    x: 0.5,
    y: 0.5,
    scale: 0.90,
  });

  renderer.resize();
  ambientParticles.resize();
}

function frame(now) {
  const time =
    now / 1000;

  ambientParticles.render(time);

  motion.update(now);
  renderer.render(motion.current);

  const elapsed =
    timer.getElapsed(now);

  const centisecond =
    Math.floor(
      elapsed / 10
    );

  if (
    centisecond !==
    lastRenderedCentisecond
  ) {
    lastRenderedCentisecond =
      centisecond;

    timerDisplay.value =
      formatTime(elapsed);

    statsView.render(
      elapsed,
      timer.laps,
      timer.getBestLap()
    );
  }

  requestAnimationFrame(frame);
}

function handleStartOrResume() {
  const now =
    performance.now();

  if (
    timer.state ===
    "idle"
  ) {
    timer.start(now);

    motion.setState(
      "running"
    );

    announce(
      "Stopwatch started."
    );
  } else if (
    timer.state ===
    "paused"
  ) {
    timer.resume(now);

    motion.resume();

    announce(
      "Stopwatch resumed."
    );
  }

  syncControls();
}

function handlePause() {
  if (
    timer.state !==
    "running"
  ) {
    return;
  }

  timer.pause(
    performance.now()
  );

  motion.setState(
    "pause"
  );

  syncControls();

  announce(
    "Stopwatch paused."
  );
}

function handleLap() {
  if (
    timer.state !==
    "running"
  ) {
    return;
  }

  const lap =
    timer.addLap(
      performance.now()
    );

  if (!lap) {
    return;
  }

  motion.lap();

  renderLapData();

  announce(
    `Lap ${lap.number} recorded at ${formatTime(lap.duration)}.`
  );
}

function handleReset() {
  if (
    timer.state === "idle" &&
    timer.getElapsed() === 0
  ) {
    return;
  }

  timer.reset();
  motion.reset();

  lastRenderedCentisecond =
    -1;

  timerDisplay.value =
    "00:00.00";

  renderLapData();
  syncControls();

  announce(
    "Stopwatch reset."
  );
}

function renderLapData() {
  const bestLap =
    timer.getBestLap();

  lapsView.render(
    timer.laps,
    bestLap
  );

  statsView.render(
    timer.getElapsed(),
    timer.laps,
    bestLap
  );
}

function syncControls() {
  const isIdle =
    timer.state ===
    "idle";

  const isRunning =
    timer.state ===
    "running";

  const isPaused =
    timer.state ===
    "paused";

  primaryLabel.textContent =
    isPaused
      ? "Resume"
      : "Start";

  primaryButton.disabled =
    isRunning;

  pauseButton.disabled =
    !isRunning;

  lapButton.disabled =
    !isRunning;

  resetButton.disabled =
    isIdle &&
    timer.getElapsed() === 0 &&
    timer.laps.length === 0;

  timerStatus.textContent =
    isIdle
      ? "READY"
      : isRunning
        ? "RUNNING"
        : "PAUSED";

  timerStatus.dataset.state =
    isIdle
      ? "ready"
      : isRunning
        ? "running"
        : "paused";
}

function announce(message) {
  liveStatus.textContent = "";

  requestAnimationFrame(() => {
    liveStatus.textContent =
      message;
  });
}

primaryButton.addEventListener(
  "click",
  handleStartOrResume
);

pauseButton.addEventListener(
  "click",
  handlePause
);

lapButton.addEventListener(
  "click",
  handleLap
);

resetButton.addEventListener(
  "click",
  handleReset
);

window.addEventListener(
  "keydown",
  (event) => {
    if (event.repeat) {
      return;
    }

    if (
      event.code ===
      "Space"
    ) {
      event.preventDefault();

      if (
        timer.state ===
        "running"
      ) {
        handlePause();
      } else {
        handleStartOrResume();
      }
    }

    if (
      event.key.toLowerCase() ===
      "l"
    ) {
      handleLap();
    }

    if (
      event.key.toLowerCase() ===
      "r"
    ) {
      handleReset();
    }
  }
);

window.addEventListener(
  "resize",
  resizeVisuals
);

resizeVisuals();
renderLapData();
syncControls();

requestAnimationFrame(frame);
