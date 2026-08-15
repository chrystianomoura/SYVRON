import { CreatureRenderer } from "./creature/renderer.js";
import { CreatureMotion } from "./creature/motion.js";

const canvas = document.querySelector("#organism");
const renderer = new CreatureRenderer(canvas);
const motion = new CreatureMotion();

const controls = {
  idle: document.querySelector('[data-state="idle"]'),
  running: document.querySelector('[data-state="running"]'),
  lap: document.querySelector('[data-state="lap"]'),
  pause: document.querySelector('[data-state="pause"]'),
  resume: document.querySelector('[data-state="resume"]'),
  reset: document.querySelector('[data-state="reset"]'),
};

function resize() {
  renderer.resize();
}

function frame(now) {
  motion.update(now);
  renderer.render(motion.current);
  updateActiveState();
  requestAnimationFrame(frame);
}

function updateActiveState() {
  Object.values(controls).forEach((button) => {
    button?.classList.remove("is-active");
  });

  controls[motion.state]?.classList.add("is-active");
}

controls.idle?.addEventListener("click", () => motion.setState("idle"));
controls.running?.addEventListener("click", () => motion.setState("running"));
controls.lap?.addEventListener("click", () => motion.lap());
controls.pause?.addEventListener("click", () => motion.setState("pause"));
controls.resume?.addEventListener("click", () => motion.resume());
controls.reset?.addEventListener("click", () => motion.reset());

window.addEventListener("keydown", (event) => {
  if (event.key === "1") motion.setState("idle");
  if (event.key === "2") motion.setState("running");
  if (event.key === "3") motion.lap();
  if (event.key === "4") motion.setState("pause");
  if (event.key === "5") motion.resume();
  if (event.key === "6") motion.reset();
});

resize();
window.addEventListener("resize", resize);
requestAnimationFrame(frame);
