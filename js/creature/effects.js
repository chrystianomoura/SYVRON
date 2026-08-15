import { pointBetween, lerp } from "./geometry.js";

const TAU = Math.PI * 2;

const ENERGY_POINTS = [
  { u: 0.018, lane: 0.82, power: 0.34, radius: 0.48 },
  { u: 0.071, lane: 0.41, power: 0.18, radius: 0.33 },
  { u: 0.118, lane: 0.25, power: 0.25, radius: 0.38 },
  { u: 0.168, lane: 0.66, power: 0.16, radius: 0.31 },
  { u: 0.226, lane: 0.77, power: 0.29, radius: 0.42 },
  { u: 0.286, lane: 0.35, power: 0.15, radius: 0.29 },
  { u: 0.348, lane: 0.54, power: 0.22, radius: 0.35 },
  { u: 0.404, lane: 0.30, power: 0.17, radius: 0.30 },
  { u: 0.463, lane: 0.73, power: 0.24, radius: 0.37 },
  { u: 0.519, lane: 0.81, power: 0.30, radius: 0.43 },
  { u: 0.575, lane: 0.45, power: 0.15, radius: 0.28 },
  { u: 0.628, lane: 0.23, power: 0.35, radius: 0.47 },
  { u: 0.681, lane: 0.61, power: 0.18, radius: 0.31 },
  { u: 0.735, lane: 0.75, power: 0.23, radius: 0.36 },
  { u: 0.790, lane: 0.38, power: 0.16, radius: 0.29 },
  { u: 0.844, lane: 0.56, power: 0.21, radius: 0.34 },
  { u: 0.892, lane: 0.29, power: 0.28, radius: 0.41 },
  { u: 0.942, lane: 0.69, power: 0.18, radius: 0.31 },
  { u: 0.978, lane: 0.48, power: 0.22, radius: 0.35 },
];

export function drawAtmosphere(ctx, cx, cy, size, outerPath, strokeClosed) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.filter = `blur(${Math.max(18, size * 0.035)}px)`;
  ctx.lineWidth = size * 0.052;
  ctx.strokeStyle = "rgba(91,31,221,.14)";
  strokeClosed(ctx, outerPath);
  ctx.restore();
}

export function drawHighlights(ctx, cx, cy, size, base, motion = {}) {
  const time = motion.time ?? 0;
  const shimmer = motion.shimmer ?? 0;

  ENERGY_POINTS.forEach((point, index) => {
    const drift =
      Math.sin(time * 0.42 + index * 1.37) *
      0.018 *
      shimmer;

    const u = wrap01(point.u + drift);

    const laneDrift =
      Math.sin(time * 0.34 + index * 0.84) *
      0.052 *
      shimmer;

    const lane = clamp(point.lane + laneDrift, 0.02, 0.98);
    const p = pointBetween(cx, cy, base, u, lane);

    const breathing =
      1 +
      Math.sin(time * 1.05 + index * 0.73) *
      0.30 *
      shimmer;

    const r = size * 0.0165 * point.radius * breathing;

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    glow.addColorStop(
      0,
      `rgba(226,217,255,${0.42 * point.power})`
    );
    glow.addColorStop(
      0.16,
      `rgba(191,153,255,${0.32 * point.power})`
    );
    glow.addColorStop(
      0.44,
      `rgba(120,72,232,${0.16 * point.power})`
    );
    glow.addColorStop(
      0.78,
      `rgba(84,26,200,${0.05 * point.power})`
    );
    glow.addColorStop(1, "rgba(52,16,132,0)");

    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, TAU);
    ctx.fill();
    ctx.restore();
  });
}

export function drawDust(ctx, cx, cy, size, base) {
  const rng = mulberry32(99881);

  ctx.save();
  ctx.globalCompositeOperation = "screen";

  for (let i = 0; i < 92; i += 1) {
    const u = rng();
    const side = rng() > 0.40 ? 1 : -1;
    const lane = side > 0 ? 0.985 : 0.015;
    const p = pointBetween(cx, cy, base, u, lane);

    const angle = u * TAU - Math.PI / 2;
    const push = size * lerp(0.006, 0.062, rng()) * side;

    const x = p.x + Math.cos(angle) * push;
    const y = p.y + Math.sin(angle) * push;
    const radius = lerp(0.35, 1.35, rng());
    const alpha = lerp(0.07, 0.42, rng());

    ctx.fillStyle = `rgba(143,67,255,${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();
  }

  ctx.restore();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function wrap01(value) {
  return ((value % 1) + 1) % 1;
}

function mulberry32(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
