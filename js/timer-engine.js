export class TimerEngine {
  constructor() {
    this.state = "idle";
    this.elapsedBeforeRun = 0;
    this.startedAt = null;
    this.laps = [];
  }

  start(now = performance.now()) {
    if (this.state === "running") return;

    this.startedAt = now;
    this.state = "running";
  }

  pause(now = performance.now()) {
    if (this.state !== "running") return;

    this.elapsedBeforeRun = this.getElapsed(now);
    this.startedAt = null;
    this.state = "paused";
  }

  resume(now = performance.now()) {
    if (this.state !== "paused") return;

    this.startedAt = now;
    this.state = "running";
  }

  reset() {
    this.state = "idle";
    this.elapsedBeforeRun = 0;
    this.startedAt = null;
    this.laps = [];
  }

  addLap(now = performance.now()) {
    if (this.state !== "running") return null;

    const total = this.getElapsed(now);
    const previousTotal = this.laps.length
      ? this.laps[this.laps.length - 1].total
      : 0;

    const duration = Math.max(0, total - previousTotal);

    const lap = {
      number: this.laps.length + 1,
      duration,
      total,
    };

    this.laps.push(lap);
    return lap;
  }

  getElapsed(now = performance.now()) {
    if (this.state !== "running" || this.startedAt === null) {
      return this.elapsedBeforeRun;
    }

    return this.elapsedBeforeRun + (now - this.startedAt);
  }

  getBestLap() {
    if (!this.laps.length) return null;

    return this.laps.reduce((best, lap) => {
      return lap.duration < best.duration ? lap : best;
    });
  }
}

export function formatTime(milliseconds) {
  const safe = Math.max(0, milliseconds);

  const totalCentiseconds = Math.floor(safe / 10);
  const centiseconds = totalCentiseconds % 100;

  const totalSeconds = Math.floor(totalCentiseconds / 100);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);

  return `${pad(minutes)}:${pad(seconds)}.${pad(centiseconds)}`;
}

function pad(value) {
  return String(value).padStart(2, "0");
}
