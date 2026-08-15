export class CreatureMotion {
  constructor() {
    this.state = "idle";
    this.startedAt = performance.now();
    this.lastNow = this.startedAt;

    this.lapStartedAt = null;
    this.lapDuration = 1450;

    this.current = {
      flow: 0.18,
      speed: 0.18,
      shimmer: 0.22,
      membrane: 0.14,
      turbulence: 0.10,
      lapProgress: -1,
      wave: 0,
      contraction: 0,
      ignition: 0,
    };

    this.target = { ...this.current };
  }

  setState(state) {
    if (!["idle", "running", "pause"].includes(state)) return;

    this.state = state;

    if (state === "running") {
      // V15 RUNNING visual intensity is preserved.
      // Only temporal speed is increased.
      this.target = {
        ...this.target,
        flow: 1.55,
        speed: 2.35,
        shimmer: 1.10,
        membrane: 1.20,
        turbulence: 1.25,
      };
    }

    if (state === "idle") {
      this.target = {
        ...this.target,
        flow: 0.18,
        speed: 0.18,
        shimmer: 0.22,
        membrane: 0.14,
        turbulence: 0.10,
      };
    }

    if (state === "pause") {
      this.target = {
        ...this.target,
        flow: 0.025,
        speed: 0.025,
        shimmer: 0.085,
        membrane: 0.028,
        turbulence: 0.018,
      };
    }
  }

  lap(now = performance.now()) {
    this.lapStartedAt = now;
    this.current.lapProgress = 0;
    this.current.wave = 1;
  }

  resume() {
    this.setState("running");
    this.current.ignition = 0.22;
  }

  reset() {
    this.setState("idle");
    this.current.contraction = 0.20;
  }

  update(now) {
    const dt = Math.min(Math.max((now - this.lastNow) / 1000, 0), 0.05);
    this.lastNow = now;

    const response =
      this.state === "idle" ? 0.82 :
      this.state === "pause" ? 0.62 :
      1.32;

    const smoothing = 1 - Math.exp(-dt * response);

    for (const key of ["flow", "speed", "shimmer", "membrane", "turbulence"]) {
      this.current[key] +=
        (this.target[key] - this.current[key]) * smoothing;
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
        const fadeOut = Math.min(1, (1 - progress) / 0.10);
        this.current.wave = Math.min(fadeIn, fadeOut);
      }
    }

    this.current.ignition *= Math.exp(-dt * 2.8);
    this.current.contraction *= Math.exp(-dt * 2.6);

    this.current.time = (now - this.startedAt) / 1000;
    this.current.state = this.state;
  }
}
