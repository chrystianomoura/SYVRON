import { formatTime } from "./timer-engine.js";

export class LapsView {
  constructor({
    list,
    empty,
    badge,
  }) {
    this.list = list;
    this.empty = empty;
    this.badge = badge;
  }

  render(laps, bestLap) {
    this.badge.textContent = String(laps.length);
    this.empty.hidden = laps.length > 0;
    this.list.replaceChildren();

    [...laps]
      .reverse()
      .forEach((lap) => {
        const item = document.createElement("li");
        const isBest = bestLap?.number === lap.number;

        item.className = `lap-item${isBest ? " is-best" : ""}`;

        const number = document.createElement("span");
        number.className = "lap-item__number";
        number.textContent = String(lap.number).padStart(2, "0");

        const time = document.createElement("span");
        time.className = "lap-item__time";
        time.textContent = formatTime(lap.duration);

        item.append(number, time);
        this.list.append(item);
      });
  }
}
