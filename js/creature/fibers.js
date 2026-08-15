import {
  clamp,
  lerp,
  innerRadius,
  outerRadius,
  pinchAmount,
  twistAmount,
  seamContinuityWeight,
} from "./geometry.js";

const TAU = Math.PI * 2;
const DEFAULT_SAMPLES = 320;

export class FiberField {
  constructor(count = 86) {
    this.fibers = this.createFibers(count);

    // Geometry depends only on anatomy + u, not on time or fiber identity.
    // Cache it once instead of recalculating it for every fiber, every frame.
    this.geometryCaches = new Map();

    this.getGeometryCache(DEFAULT_SAMPLES);
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

        // Reused point objects avoid ~27k allocations per frame
        // for the 86 main fibers at 320 samples.
        _paths: new Map(),
      });
    }

    return fibers;
  }

  getGeometryCache(samples = DEFAULT_SAMPLES) {
    const existing = this.geometryCaches.get(samples);

    if (existing) {
      return existing;
    }

    const cache = new Array(samples);

    for (let i = 0; i < samples; i += 1) {
      const u = i / samples;
      const angle = u * TAU - Math.PI / 2;

      cache[i] = {
        u,
        uTau: u * TAU,

        cosAngle: Math.cos(angle),
        sinAngle: Math.sin(angle),

        inner: innerRadius(u),
        outer: outerRadius(u),
        pinch: pinchAmount(u),
        twist: twistAmount(u),
        seam: seamContinuityWeight(u, 0.060),
        lowerEnvelope: angularWindow(u, 0.605, 0.155),
      };
    }

    this.geometryCaches.set(samples, cache);

    return cache;
  }

  getReusablePath(fiber, samples) {
    if (!fiber._paths) {
      fiber._paths = new Map();
    }

    let points = fiber._paths.get(samples);

    if (!points) {
      points = Array.from(
        { length: samples },
        () => ({ x: 0, y: 0 })
      );

      fiber._paths.set(samples, points);
    }

    return points;
  }

  laneAt(fiber, u, motion = {}) {
    // Public/reference path kept mathematically equivalent for any
    // non-sampled caller. pathFor() uses laneAtCached() below.
    const time = motion.time ?? 0;
    const flow = motion.flow ?? 0;
    const speed = motion.speed ?? flow;
    const turbulence = motion.turbulence ?? 0;
    const wave = motion.wave ?? 0;
    const lapProgress = motion.lapProgress ?? -1;
    const ignition = motion.ignition ?? 0;
    const contraction = motion.contraction ?? 0;
    const resetPulse = motion.resetPulse ?? 0;

    const twist = twistAmount(u);
    let lane = fiber.lane;

    lane += twist * (0.5 - lane) * 0.88;

    const phaseDrift = time * 0.205 * speed * fiber.speed;
    const seam = seamContinuityWeight(u, 0.060);

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

    lane +=
      Math.sin(
        time * 0.20 * fiber.speed * speed +
        fiber.family * 0.95 +
        u * TAU
      ) *
      0.036 *
      flow;

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

    lane +=
      Math.sin(u * TAU * 6 + fiber.phase3 + time * 2.8) *
      0.030 *
      ignition;

    // Timed RESET event:
    // coherent inward reorganization + soft secondary ripple.
    lane +=
      Math.sin(
        u * TAU * 2.0 +
        fiber.phase2 * 0.30 +
        time * 0.55
      ) *
      0.145 *
      resetPulse *
      seamContinuityWeight(u, 0.060);

    lane +=
      Math.sin(
        u * TAU * 4.0 -
        fiber.phase1 * 0.20 -
        time * 0.42
      ) *
      0.055 *
      resetPulse *
      seamContinuityWeight(u, 0.060);

    // Gentle inward pull at the middle of the reset.
    lane +=
      (0.5 - lane) *
      0.14 *
      resetPulse;

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

    lane += (fiber.lane - lane) * 0.62 * contraction;

    return clamp(lane, 0.012, 0.988);
  }

  laneAtCached(fiber, sample, motion, shared) {
    let lane = fiber.lane;

    lane +=
      sample.twist *
      (0.5 - lane) *
      0.88;

    const phaseDrift =
      shared.phaseDriftBase *
      fiber.speed;

    lane +=
      Math.sin(
        sample.uTau * 2.15 +
        fiber.phase1 +
        phaseDrift
      ) *
      fiber.migration *
      shared.migrationPrimary *
      sample.seam;

    lane +=
      Math.sin(
        sample.uTau * 5.0 +
        fiber.phase2 -
        phaseDrift * 0.82
      ) *
      fiber.migration *
      shared.migrationSecondary;

    lane +=
      Math.sin(
        sample.uTau * 3.0 +
        fiber.family * 0.93 +
        phaseDrift * 0.52
      ) *
      (0.020 + Math.abs(sample.twist) * 0.060) *
      shared.familyTurbulence;

    lane +=
      Math.sin(
        shared.swimTime *
        fiber.speed +
        fiber.family * 0.95 +
        sample.uTau
      ) *
      shared.swimAmplitude;

    if (shared.lapActive) {
      const delta =
        Math.abs(
          sample.u -
          shared.lapProgress
        );

      const circularDistance =
        Math.min(
          delta,
          1 - delta
        );

      const envelope =
        Math.exp(
          -(
            circularDistance *
            circularDistance
          ) /
            0.0082
        );

      lane +=
        envelope *
        shared.lapFiberSine(fiber.phase1) *
        shared.lapAmplitude;
    }

    lane +=
      Math.sin(
        sample.uTau * 6 +
        fiber.phase3 +
        shared.ignitionTime
      ) *
      shared.ignitionAmplitude;

    // Timed RESET event:
    // guaranteed visible peak halfway through resetDuration.
    lane +=
      Math.sin(
        sample.uTau * 2.0 +
        fiber.phase2 * 0.30 +
        shared.resetTimePrimary
      ) *
      shared.resetAmplitudePrimary *
      sample.seam;

    lane +=
      Math.sin(
        sample.uTau * 4.0 -
        fiber.phase1 * 0.20 -
        shared.resetTimeSecondary
      ) *
      shared.resetAmplitudeSecondary *
      sample.seam;

    lane +=
      (0.5 - lane) *
      shared.resetPull;

    if (sample.lowerEnvelope > 0) {
      const spread =
        1 +
        0.17 *
          sample.lowerEnvelope;

      lane =
        0.5 +
        (lane - 0.5) *
          spread;

      const clampedLane =
        lane < 0
          ? 0
          : lane > 1
            ? 1
            : lane;

      const innerWeight =
        Math.pow(
          1 - clampedLane,
          1.65
        );

      lane -=
        0.045 *
        sample.lowerEnvelope *
        innerWeight;
    }

    lane +=
      (fiber.lane - lane) *
      shared.contractionFactor;

    if (lane < 0.012) {
      return 0.012;
    }

    if (lane > 0.988) {
      return 0.988;
    }

    return lane;
  }

  pathFor(cx, cy, base, fiber, motion = {}, samples = DEFAULT_SAMPLES) {
    const geometry =
      this.getGeometryCache(samples);

    const points =
      this.getReusablePath(
        fiber,
        samples
      );

    const time = motion.time ?? 0;
    const flow = motion.flow ?? 0;
    const speed = motion.speed ?? flow;
    const turbulence = motion.turbulence ?? 0;
    const wave = motion.wave ?? 0;
    const lapProgress = motion.lapProgress ?? -1;
    const ignition = motion.ignition ?? 0;
    const contraction = motion.contraction ?? 0;
    const resetPulse = motion.resetPulse ?? 0;

    const shared = {
      phaseDriftBase:
        time *
        0.205 *
        speed,

      migrationPrimary:
        1 +
        turbulence *
          1.25,

      migrationSecondary:
        0.48 +
        turbulence *
          0.58,

      familyTurbulence:
        1 +
        turbulence *
          1.10,

      swimTime:
        time *
        0.20 *
        speed,

      swimAmplitude:
        0.036 *
        flow,

      lapActive:
        lapProgress >= 0,

      lapProgress,

      lapAmplitude:
        0.082 *
        wave,

      lapPhase:
        lapProgress *
        TAU *
        2,

      lapFiberSine(phase1) {
        return Math.sin(
          phase1 +
          this.lapPhase
        );
      },

      ignitionTime:
        time * 2.8,

      ignitionAmplitude:
        0.030 *
        ignition,

      contractionFactor:
        0.62 *
        contraction,

      resetTimePrimary:
        time * 0.55,

      resetTimeSecondary:
        time * 0.42,

      resetAmplitudePrimary:
        0.145 *
        resetPulse,

      resetAmplitudeSecondary:
        0.055 *
        resetPulse,

      resetPull:
        0.14 *
        resetPulse,
    };

    const tangentPhase =
      time *
      0.165 *
      speed *
      fiber.speed;

    const tangentPrimary =
      fiber.tangent *
      (1 + turbulence * 1.15);

    const tangentSecondary =
      fiber.tangent *
      0.32 *
      (1 + turbulence * 0.90);

    const tangentPhaseSecondary =
      tangentPhase *
      0.76;

    for (let i = 0; i < samples; i += 1) {
      const sample = geometry[i];

      const lane =
        this.laneAtCached(
          fiber,
          sample,
          motion,
          shared
        );

      const tangent =
        (
          Math.sin(
            sample.uTau * 2.7 +
            fiber.phase2 +
            tangentPhase
          ) *
            tangentPrimary +
          Math.sin(
            sample.uTau * 7.2 +
            fiber.phase3 -
            tangentPhaseSecondary
          ) *
            tangentSecondary
        ) *
        sample.seam;

      // Inline the exact pointBetween() math using cached anatomy/trig.
      // This removes innerRadius(), outerRadius(), pinchAmount(),
      // seam math and angle sin/cos from every fiber sample.
      const pinched =
        0.5 +
        (lane - 0.5) *
          (1 - sample.pinch);

      const clampedPinched =
        pinched < 0
          ? 0
          : pinched > 1
            ? 1
            : pinched;

      const smooth =
        clampedPinched *
        clampedPinched *
        (
          3 -
          2 *
            clampedPinched
        );

      const radius =
        (
          sample.inner +
          (
            sample.outer -
            sample.inner
          ) *
            smooth
        ) *
        base;

      const tangentDistance =
        tangent *
        base;

      const point = points[i];

      point.x =
        cx +
        sample.cosAngle *
          radius *
          1.012 -
        sample.sinAngle *
          tangentDistance;

      point.y =
        cy +
        sample.sinAngle *
          radius *
          0.988 +
        sample.cosAngle *
          tangentDistance *
          0.86;
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
