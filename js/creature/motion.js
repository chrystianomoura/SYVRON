const BASELINE = {
  flow: 1.55,
  speed: 2.35,
  shimmer: 1.1,
  membrane: 1.2,
  turbulence: 1.25,
};

const RUNNING = {
  ...BASELINE,

  // Approved RUNNING speed.
  speed: 4.0,
};

/* ==========================
   LOCAL REACTION SETTINGS
========================== */

const START_REACTION = {
  duration: 420,

  /*
    Strong START / RESUME burst.
  */
  speedBoost: 3.0,
};

const PAUSE_REACTION = {
  duration: 460,

  /*
    PAUSE keeps its approved opposite-direction burst.
  */
  speedBoost: 1.5,
};

export class CreatureMotion {
  constructor() {
    this.state = "idle";

    const now = performance.now();
    const initialPhaseOffsetSeconds = 17.4;

    /*
      Original visual clock.
    */
    this.startedAt = now - initialPhaseOffsetSeconds * 1000;

    this.lastNow = now;

    /*
      Stable continuous movement clock.

      State speed changes affect only future phase progression.
    */
    this.movementTime = initialPhaseOffsetSeconds * BASELINE.speed;

    /* ==========================
       START / RESUME
    ========================== */

    this.startReactionStartedAt = null;
    this.startReactionDuration = START_REACTION.duration;

    /* ==========================
       PAUSE
    ========================== */

    this.pauseReactionStartedAt = null;
    this.pauseReactionDuration = PAUSE_REACTION.duration;

    /* ==========================
       LAP
    ========================== */

    this.lapStartedAt = null;
    this.lapDuration = 1450;

    /* ==========================
       RESET
    ========================== */

    this.resetStartedAt = null;
    this.resetDuration = 820;

    this.current = {
      ...BASELINE,

      movementTime: this.movementTime,

      /* START / RESUME */
      startPulse: 0,

      /* PAUSE */
      pausePulse: 0,

      /* LAP */
      lapProgress: -1,
      wave: 0,

      /* Compatibility manifestations */
      contraction: 0,
      ignition: 0,
      settle: 0,

      /* RESET */
      resetProgress: -1,
      resetPulse: 0,
    };

    this.target = {
      ...this.current,
    };
  }

  /* ==========================
     STATE
  ========================== */

  setState(state, now = performance.now()) {
    if (!["idle", "running", "pause"].includes(state)) {
      return;
    }

    const previousState = this.state;

    this.state = state;

    /* ==========================
       RUNNING
    ========================== */

    if (state === "running") {
      this.target = {
        ...this.target,
        ...RUNNING,
      };

      if (previousState !== "running") {
        this.beginStartReaction(now);
      }

      return;
    }

    /* ==========================
       READY / IDLE
    ========================== */

    if (state === "idle") {
      this.target = {
        ...this.target,
        ...BASELINE,
      };

      this.clearStartReaction();
      this.clearPauseReaction();

      return;
    }

    /* ==========================
       PAUSE
    ========================== */

    if (state === "pause") {
      this.target = {
        ...this.target,
        ...BASELINE,
      };

      if (previousState !== "pause") {
        this.beginPauseReaction(now);
      }
    }
  }

  /* ==========================
     START / RESUME REACTION
  ========================== */

  beginStartReaction(now = performance.now()) {
    /*
      Reactions never stack.
    */
    this.clearPauseReaction();

    this.startReactionStartedAt = now;

    this.current.startPulse = 0;
  }

  clearStartReaction() {
    this.startReactionStartedAt = null;

    this.current.startPulse = 0;
  }

  /* ==========================
     PAUSE REACTION
  ========================== */

  beginPauseReaction(now = performance.now()) {
    this.clearStartReaction();

    this.pauseReactionStartedAt = now;

    this.current.pausePulse = 0;
  }

  clearPauseReaction() {
    this.pauseReactionStartedAt = null;

    this.current.pausePulse = 0;
  }

  /* ==========================
     LAP
  ========================== */

  lap(now = performance.now()) {
    // Approved LAP remains untouched.
    this.lapStartedAt = now;

    this.current.lapProgress = 0;

    this.current.wave = 1;
  }

  /* ==========================
     RESUME
  ========================== */

  resume(now = performance.now()) {
    /*
      Moving from PAUSE -> RUNNING automatically:

      - restores the normal direction;
      - starts the START / RESUME burst.
    */
    this.setState("running", now);
  }

  /* ==========================
     RESET
  ========================== */

  reset(now = performance.now()) {
    const wasPaused = this.state === "pause";

    /*
      Returning to IDLE restores
      the organism's normal movement direction.
    */
    this.setState("idle", now);

    /*
      RESET immediately returns movement speed
      to baseline.
    */
    this.current.speed = BASELINE.speed;

    this.target.speed = BASELINE.speed;

    /*
      START / PAUSE reactions never leak
      into RESET.
    */
    this.clearStartReaction();
    this.clearPauseReaction();

    /*
      RESET keeps its own geometric manifestation.
    */
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

  /* ==========================
     UPDATE
  ========================== */

  update(now) {
    const dt = Math.min(Math.max((now - this.lastNow) / 1000, 0), 0.05);

    this.lastNow = now;

    /* ==========================
       STATE TRANSITION
    ========================== */

    const response =
      this.state === "running" ? 1.0 : this.state === "pause" ? 0.68 : 0.78;

    const smoothing = 1 - Math.exp(-dt * response);

    for (const key of ["flow", "speed", "shimmer", "membrane", "turbulence"]) {
      this.current[key] += (this.target[key] - this.current[key]) * smoothing;
    }

    /* ==========================
       START / RESUME PULSE
    ========================== */

    if (this.startReactionStartedAt !== null) {
      const progress =
        (now - this.startReactionStartedAt) / this.startReactionDuration;

      if (progress >= 1) {
        this.clearStartReaction();
      } else {
        const pulse = Math.sin(Math.PI * progress);

        this.current.startPulse = Math.pow(Math.max(0, pulse), 0.82);
      }
    }

    /* ==========================
       PAUSE PULSE
    ========================== */

    if (this.pauseReactionStartedAt !== null) {
      const progress =
        (now - this.pauseReactionStartedAt) / this.pauseReactionDuration;

      if (progress >= 1) {
        this.clearPauseReaction();
      } else {
        const pulse = Math.sin(Math.PI * progress);

        this.current.pausePulse = Math.pow(Math.max(0, pulse), 0.9);
      }
    }

    /* ==========================
       LAP
    ========================== */

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

    /* ==========================
       RESET
    ========================== */

    if (this.resetStartedAt !== null) {
      const progress = (now - this.resetStartedAt) / this.resetDuration;

      if (progress >= 1) {
        this.resetStartedAt = null;

        this.current.resetProgress = -1;

        this.current.resetPulse = 0;
      } else {
        this.current.resetProgress = progress;

        const pulse = Math.sin(Math.PI * progress);

        this.current.resetPulse = Math.pow(Math.max(0, pulse), 1.15);
      }
    }

    /* ==========================
       EXISTING DECAY
    ========================== */

    this.current.ignition *= Math.exp(-dt * 1.85);

    this.current.contraction *= Math.exp(-dt * 1.55);

    this.current.settle *= Math.exp(-dt * 1.45);

    /* ==========================
       ORIGINAL VISUAL TIME
    ========================== */

    this.current.time = (now - this.startedAt) / 1000;

    /* ==========================
       REACTION SPEED
       ---------------------------------------------------------
       START / RESUME:
       strong forward burst.

       PAUSE:
       opposite-direction burst.
    ========================== */

    const reactionSpeed =
      1 +
      this.current.startPulse * START_REACTION.speedBoost +
      this.current.pausePulse * PAUSE_REACTION.speedBoost;

    /* ==========================
       MOVEMENT DIRECTION
       ---------------------------------------------------------
       READY / RUNNING:
       normal anti-clockwise visual movement.

       PAUSE:
       reverses the procedural movement.
    ========================== */

    const direction = this.state === "pause" ? -1 : 1;

    /* ==========================
       STABLE CONTINUOUS MOVEMENT
    ========================== */

    this.movementTime += dt * this.current.speed * reactionSpeed * direction;

    this.current.movementTime = this.movementTime;

    this.current.state = this.state;
  }
}