import { formatTime } from "./timer-engine.js";

export class StatsView {
  constructor({
    total,
    best,
    count,
  }) {
    this.total = total;
    this.best = best;
    this.count = count;
  }

  render(elapsed, laps, bestLap) {
    this.total.textContent =
      formatTime(elapsed);

    this.best.textContent =
      bestLap
        ? formatTime(bestLap.duration)
        : "—";

    this.count.textContent =
      String(laps.length);
  }
}
