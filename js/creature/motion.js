const BASELINE = {
  flow: 1.55,
  speed: 2.35,
  shimmer: 1.1,
  membrane: 1.2,
  turbulence: 1.25,
};

const RUNNING = {
  ...BASELINE,

  // Same approved movement language, only slightly faster.
  speed: 3.72,
};

export class CreatureMotion {
  constructor() {
    this.state = "idle";

    // Start the organism in a mature motion phase instead of phase zero.
    // The approved baseline values are unchanged; this only prevents the
    // first-load "cold start" from looking unusually slow.
    const now = performance.now();
    const initialPhaseOffsetSeconds = 17.4;

    this.startedAt = now - initialPhaseOffsetSeconds * 1000;

    this.lastNow = now;

    this.lapStartedAt = null;
    this.lapDuration = 1450;

    this.resetStartedAt = null;
    this.resetDuration = 820;

    this.current = {
      ...BASELINE,

      lapProgress: -1,
      wave: 0,
      contraction: 0,
      ignition: 0,
      settle: 0,

      resetProgress: -1,
      resetPulse: 0,
    };

    this.target = {
      ...this.current,
    };
  }

  setState(state) {
    if (!["idle", "running", "pause"].includes(state)) {
      return;
    }

    this.state = state;

    if (state === "running") {
      this.target = {
        ...this.target,
        ...RUNNING,
      };

      return;
    }

    if (state === "idle") {
      this.target = {
        ...this.target,
        ...BASELINE,
      };

      return;
    }

    if (state === "pause") {
      // PAUSE settles back to the living baseline.
      this.target = {
        ...this.target,
        ...BASELINE,
      };

      // Softer than the previous behavior.
      this.current.contraction = Math.max(this.current.contraction, 0.03);

      this.current.settle = Math.max(this.current.settle, 0.028);
    }
  }

  lap(now = performance.now()) {
    // LAP remains untouched.
    this.lapStartedAt = now;
    this.current.lapProgress = 0;
    this.current.wave = 1;
  }

  resume() {
    this.setState("running");

    // Gentle ignition cue.
    this.current.ignition = Math.max(this.current.ignition, 0.04);

    this.current.settle = Math.max(this.current.settle, 0.024);
  }

  reset(now = performance.now()) {
    const wasPaused = this.state === "pause";

    this.setState("idle");

    /*
      RESET must always begin from the same movement base.

      RUNNING uses speed 3.72, while the living baseline
      uses speed 2.35. Without this normalization,
      RUNNING -> RESET carries the faster motion into
      the reset pulse and makes the reaction much more
      aggressive than PAUSE -> RESET.
    */
    this.current.speed = BASELINE.speed;

    this.target.speed = BASELINE.speed;

    // Start a real timed RESET event.
    // Coming from PAUSE makes it slightly more visible,
    // but the animation remains soft and organic.
    this.resetStartedAt = now;

    this.current.resetProgress = 0;
    this.current.resetPulse = 0;

    this.current.contraction = Math.max(
      this.current.contraction,
      wasPaused ? 0.06 : 0.04,
    );

    this.current.settle = Math.max(
      this.current.settle,
      wasPaused ? 0.05 : 0.032,
    );
  }

  update(now) {
    const dt = Math.min(Math.max((now - this.lastNow) / 1000, 0), 0.05);

    this.lastNow = now;

    const response =
      this.state === "running" ? 1.0 : this.state === "pause" ? 0.68 : 0.78;

    const smoothing = 1 - Math.exp(-dt * response);

    for (const key of ["flow", "speed", "shimmer", "membrane", "turbulence"]) {
      this.current[key] += (this.target[key] - this.current[key]) * smoothing;
    }

    if (this.lapStartedAt !== null) {
      const progress = (now - this.lapStartedAt) / this.lapDuration;

      if (progress >= 1) {
        this.lapStartedAt = null;
        this.current.lapProgress = -1;
        this.current.wave = 0;
      } else {
        this.current.lapProgress = progress;

        const fadeIn = Math.min(1, progress / 0.08);

        const fadeOut = Math.min(1, (1 - progress) / 0.1);

        this.current.wave = Math.min(fadeIn, fadeOut);
      }
    }

    if (this.resetStartedAt !== null) {
      const progress = (now - this.resetStartedAt) / this.resetDuration;

      if (progress >= 1) {
        this.resetStartedAt = null;
        this.current.resetProgress = -1;
        this.current.resetPulse = 0;
      } else {
        this.current.resetProgress = progress;

        // Smooth 0 -> 1 -> 0 pulse.
        // sin(pi * progress) guarantees a visible middle peak.
        const pulse = Math.sin(Math.PI * progress);

        // Ease the pulse slightly so the beginning/end feel organic.
        this.current.resetPulse = Math.pow(Math.max(0, pulse), 1.15);
      }
    }

    // Softer decay for action manifestations.
    this.current.ignition *= Math.exp(-dt * 1.85);

    this.current.contraction *= Math.exp(-dt * 1.55);

    this.current.settle *= Math.exp(-dt * 1.45);

    this.current.time = (now - this.startedAt) / 1000;

    this.current.state = this.state;
  }
}