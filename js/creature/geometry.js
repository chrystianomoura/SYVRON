import { ANATOMY } from "./anatomy.js";

const TAU = Math.PI * 2;

export function bump(u, center, width) {
  const raw = Math.abs(u - center);
  const d = Math.min(raw, 1 - raw);
  return Math.exp(-(d * d) / (2 * width * width));
}

function applyMasses(u, masses) {
  return masses.reduce(
    (sum, mass) => sum + mass.amount * bump(u, mass.at, mass.width),
    0
  );
}

export function outerRadius(u) {
  const a = u * TAU;

  return ANATOMY.outerBase
    + 0.035 * Math.sin(a * 2 - 0.25)
    + 0.022 * Math.cos(a * 3 + 0.95)
    + applyMasses(u, ANATOMY.outerMasses);
}

export function innerRadius(u) {
  const a = u * TAU;
  const seam = seamContinuityWeight(u, 0.060);

  return ANATOMY.innerBase
    + 0.022 * Math.sin(a * 2.15 + 0.55) * seam
    - 0.018 * Math.cos(a * 3.1 - 0.30) * seam
    + applyMasses(u, ANATOMY.innerMasses);
}

export function twistAmount(u) {
  return applyMasses(u, ANATOMY.twistZones);
}

export function pinchAmount(u) {
  return Math.max(0, applyMasses(u, ANATOMY.pinchZones));
}

export function pointBetween(cx, cy, base, u, lane, tangentShift = 0) {
  const angle = u * TAU - Math.PI / 2;
  const inner = innerRadius(u);
  const outer = outerRadius(u);

  const pinched = 0.5 + (lane - 0.5) * (1 - pinchAmount(u));
  const radius = lerp(inner, outer, smoothstep(pinched)) * base;
  const tangent = tangentShift * base;

  return {
    x:
      cx +
      Math.cos(angle) * radius * 1.012 +
      Math.cos(angle + Math.PI / 2) * tangent,
    y:
      cy +
      Math.sin(angle) * radius * 0.988 +
      Math.sin(angle + Math.PI / 2) * tangent * 0.86,
  };
}

export function boundaryPath(cx, cy, base, which, samples = 340) {
  const points = [];

  for (let i = 0; i < samples; i += 1) {
    const u = i / samples;
    const angle = u * TAU - Math.PI / 2;
    const radius =
      (which === "outer" ? outerRadius(u) : innerRadius(u)) * base;

    points.push({
      x: cx + Math.cos(angle) * radius * 1.012,
      y: cy + Math.sin(angle) * radius * 0.988,
    });
  }

  return points;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(t) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

// 0 exactly at the technical u=0/1 seam and 1 outside a small local window.
// Quintic smoothing keeps the transition invisible.
// Only non-periodic terms use this weight.
export function seamContinuityWeight(u, width = 0.060) {
  const wrapped = ((u % 1) + 1) % 1;
  const distance = Math.min(wrapped, 1 - wrapped);
  const x = clamp(distance / width, 0, 1);

  return x * x * x * (x * (x * 6 - 15) + 10);
}
