const BASELINE = {
  flow: 1.55,
  speed: 2.35,
  shimmer: 1.10,
  membrane: 1.20,
  turbulence: 1.25,
};

const RUNNING = {
  ...BASELINE,

  // Same approved RUNNING personality.
  // Only the temporal velocity increases.
  speed: 3.45,
};

export class CreatureMotion {
  constructor() {
    this.state = "idle";
    this.startedAt = performance.now();
    this.lastNow = this.startedAt;

    this.lapStartedAt = null;
    this.lapDuration = 1450;

    // The organism now ENTERS the page already alive using
    // the exact values of the previously approved RUNNING state.
    this.current = {
      ...BASELINE,

      lapProgress: -1,
      wave: 0,
      contraction: 0,
      ignition: 0,
    };

    this.target = {
      ...this.current,
    };
  }

  setState(state) {
    if (
      ![
        "idle",
        "running",
        "pause",
      ].includes(state)
    ) {
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
      // READY / post-RESET returns to the approved old RUNNING values.
      this.target = {
        ...this.target,
        ...BASELINE,
      };

      return;
    }

    if (state === "pause") {
      // PAUSE no longer nearly kills the organism.
      // It settles gently back to its living baseline.
      this.target = {
        ...this.target,
        ...BASELINE,
      };

      // Very small organic response instead of a violent contraction.
      this.current.contraction =
        Math.max(
          this.current.contraction,
          0.045
        );
    }
  }

  lap(now = performance.now()) {
    // LAP behavior intentionally preserved.
    this.lapStartedAt = now;
    this.current.lapProgress = 0;
    this.current.wave = 1;
  }

  resume() {
    this.setState("running");

    // Gentle re-acceleration cue.
    // Previous value: 0.22.
    this.current.ignition =
      Math.max(
        this.current.ignition,
        0.055
      );
  }

  reset() {
    this.setState("idle");

    // Small reorganization, then return to baseline life.
    // Previous value: 0.20.
    this.current.contraction =
      Math.max(
        this.current.contraction,
        0.065
      );
  }

  update(now) {
    const dt = Math.min(
      Math.max(
        (now - this.lastNow) / 1000,
        0
      ),
      0.05
    );

    this.lastNow = now;

    // Smoother biological inertia.
    // RUNNING still responds clearly, but PAUSE / RESET / RESUME
    // no longer snap between radically different energy levels.
    const response =
      this.state === "running"
        ? 1.05
        : this.state === "pause"
          ? 0.72
          : 0.82;

    const smoothing =
      1 -
      Math.exp(
        -dt *
        response
      );

    for (
      const key
      of [
        "flow",
        "speed",
        "shimmer",
        "membrane",
        "turbulence",
      ]
    ) {
      this.current[key] +=
        (
          this.target[key] -
          this.current[key]
        ) *
        smoothing;
    }

    if (
      this.lapStartedAt !==
      null
    ) {
      const progress =
        (
          now -
          this.lapStartedAt
        ) /
        this.lapDuration;

      if (progress >= 1) {
        this.lapStartedAt = null;
        this.current.lapProgress = -1;
        this.current.wave = 0;
      } else {
        this.current.lapProgress =
          progress;

        const fadeIn =
          Math.min(
            1,
            progress / 0.08
          );

        const fadeOut =
          Math.min(
            1,
            (1 - progress) / 0.10
          );

        this.current.wave =
          Math.min(
            fadeIn,
            fadeOut
          );
      }
    }

    // Softer one-shot reactions.
    this.current.ignition *=
      Math.exp(
        -dt *
        2.0
      );

    this.current.contraction *=
      Math.exp(
        -dt *
        1.8
      );

    this.current.time =
      (
        now -
        this.startedAt
      ) /
      1000;

    this.current.state =
      this.state;
  }
}
