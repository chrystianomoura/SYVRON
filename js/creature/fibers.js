import {
  clamp,
  lerp,
  pointBetween,
  twistAmount,
  seamContinuityWeight,
} from "./geometry.js";

const TAU = Math.PI * 2;

export class FiberField {
  constructor(count = 86) {
    this.fibers = this.createFibers(count);
  }

  createFibers(count) {
    const rng = mulberry32(761923);
    const fibers = [];

    for (let i = 0; i < count; i += 1) {
      fibers.push({
        lane: i / (count - 1),
        phase1: rng() * TAU,
        phase2: rng() * TAU,
        phase3: rng() * TAU,
        migration: lerp(0.012, 0.052, rng()),
        tangent: lerp(0.004, 0.027, rng()),
        alpha: lerp(0.08, 0.48, Math.pow(rng(), 0.62)),
        width: lerp(0.50, 1.42, rng()),
        family: Math.floor(rng() * 7),
        brightness: rng(),
        speed: lerp(0.72, 1.24, rng()),
      });
    }

    return fibers;
  }

  laneAt(fiber, u, motion = {}) {
    const time = motion.time ?? 0;
    const flow = motion.flow ?? 0;
    const speed = motion.speed ?? flow;
    const turbulence = motion.turbulence ?? 0;
    const wave = motion.wave ?? 0;
    const lapProgress = motion.lapProgress ?? -1;
    const ignition = motion.ignition ?? 0;
    const contraction = motion.contraction ?? 0;

    const twist = twistAmount(u);
    let lane = fiber.lane;

    // Preserve V5 structure.
    lane += twist * (0.5 - lane) * 0.88;

    // Stronger internal travel. Still constrained inside the membrane.
    const phaseDrift = time * 0.205 * speed * fiber.speed;
    const seam = seamContinuityWeight(u, 0.060);

    // This 2.15-frequency term is intentionally damped only at the
    // technical seam because it is not mathematically periodic.
    lane +=
      Math.sin(u * TAU * 2.15 + fiber.phase1 + phaseDrift) *
      fiber.migration *
      (1 + turbulence * 1.25) *
      seam;

    lane +=
      Math.sin(u * TAU * 5.0 + fiber.phase2 - phaseDrift * 0.82) *
      fiber.migration *
      (0.48 + turbulence * 0.58);

    lane +=
      Math.sin(
        u * TAU * 3.0 +
        fiber.family * 0.93 +
        phaseDrift * 0.52
      ) *
      (0.020 + Math.abs(twist) * 0.060) *
      (1 + turbulence * 1.10);

    // A slower secondary drift makes whole fiber families "swim".
    lane +=
      Math.sin(
        time * 0.20 * fiber.speed * speed +
        fiber.family * 0.95 +
        u * TAU
      ) *
      0.036 *
      flow;

    // LAP: one explicit complete revolution around the organism.
    if (lapProgress >= 0) {
      const waveCenter = lapProgress;
      const delta = Math.abs(u - waveCenter);
      const circularDistance = Math.min(delta, 1 - delta);
      const envelope =
        Math.exp(-(circularDistance * circularDistance) / 0.0082);

      lane +=
        envelope *
        Math.sin(fiber.phase1 + lapProgress * TAU * 2) *
        0.082 *
        wave;
    }

    // RESUME: short ignition flutter.
    lane +=
      Math.sin(u * TAU * 6 + fiber.phase3 + time * 2.8) *
      0.030 *
      ignition;

    // --------------------------------------------------------
    // LOWER-SECTOR CONTINUITY REPAIR
    // --------------------------------------------------------
    // The V16 organism leaves a visible low-density band through
    // the bottom/lower-left membrane. Instead of drawing extra
    // repair strands, redistribute the EXISTING fibers only in
    // that angular sector.
    //
    // This is an ordered affine spread around 0.5, so the fibers
    // keep their natural identities and trajectories. The inner
    // half receives a tiny additional inward bias to occupy the
    // specific dead band visible in V16.
    const lowerEnvelope = angularWindow(u, 0.605, 0.155);

    if (lowerEnvelope > 0) {
      const spread = 1 + 0.17 * lowerEnvelope;
      lane = 0.5 + (lane - 0.5) * spread;

      const innerWeight =
        Math.pow(1 - clamp(lane, 0, 1), 1.65);

      lane -=
        0.045 *
        lowerEnvelope *
        innerWeight;
    }

    // RESET: fibers briefly pull toward their original lanes.
    lane += (fiber.lane - lane) * 0.62 * contraction;

    return clamp(lane, 0.012, 0.988);
  }

  pathFor(cx, cy, base, fiber, motion = {}, samples = 320) {
    const points = [];
    const time = motion.time ?? 0;
    const flow = motion.flow ?? 0;
    const speed = motion.speed ?? flow;
    const turbulence = motion.turbulence ?? 0;

    for (let i = 0; i < samples; i += 1) {
      const u = i / samples;
      const lane = this.laneAt(fiber, u, motion);

      const tangentPhase = time * 0.165 * speed * fiber.speed;
      const seam = seamContinuityWeight(u, 0.060);

      // Both 2.7 and 7.2 are non-periodic across u=0/1.
      // Damp only inside the tiny seam window; everywhere else V15 remains.
      const tangent =
        (
          Math.sin(u * TAU * 2.7 + fiber.phase2 + tangentPhase) *
            fiber.tangent *
            (1 + turbulence * 1.15) +
          Math.sin(u * TAU * 7.2 + fiber.phase3 - tangentPhase * 0.76) *
            fiber.tangent *
            0.32 *
            (1 + turbulence * 0.90)
        ) *
        seam;

      points.push(pointBetween(cx, cy, base, u, lane, tangent));
    }

    return points;
  }
}

function angularWindow(u, center, halfWidth) {
  const raw = Math.abs(u - center);
  const distance = Math.min(raw, 1 - raw);

  if (distance >= halfWidth) {
    return 0;
  }

  const x = 1 - distance / halfWidth;

  // Smoothstep from the edges toward the center.
  return x * x * (3 - 2 * x);
}

function mulberry32(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
