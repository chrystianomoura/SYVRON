export class AmbientParticles {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", {
      alpha: true,
      desynchronized: true,
    });

    this.staticCanvas = document.createElement("canvas");
    this.staticCtx = this.staticCanvas.getContext("2d", {
      alpha: true,
      desynchronized: true,
    });

    this.width = 1;
    this.height = 1;
    this.dpr = 1;

    this.staticParticles = [];
    this.movingParticles = [];

    this.seed = 497123;
  }

  resize() {
    this.dpr = Math.min(
      window.devicePixelRatio || 1,
      1.25
    );

    this.width = window.innerWidth;
    this.height = window.innerHeight;

    const pixelWidth = Math.max(
      1,
      Math.round(this.width * this.dpr)
    );

    const pixelHeight = Math.max(
      1,
      Math.round(this.height * this.dpr)
    );

    this.canvas.width = pixelWidth;
    this.canvas.height = pixelHeight;

    this.staticCanvas.width = pixelWidth;
    this.staticCanvas.height = pixelHeight;

    this.ctx.setTransform(
      this.dpr,
      0,
      0,
      this.dpr,
      0,
      0
    );

    this.staticCtx.setTransform(
      this.dpr,
      0,
      0,
      this.dpr,
      0,
      0
    );

    this.createParticles();
    this.renderStaticLayer();
    this.render(0);
  }

  createParticles() {
    const rng = mulberry32(this.seed);

    const area = this.width * this.height;

    const count = Math.round(
      Math.max(
        620,
        Math.min(
          1180,
          area / 1750
        )
      )
    );

    const particles = Array.from(
      { length: count },
      (_, index) => {
        const bright = rng() > 0.79;

        const hue = lerp(
          263,
          283,
          rng()
        );

        const saturation = lerp(
          72,
          100,
          rng()
        );

        const lightness = bright
          ? lerp(60, 76, rng())
          : lerp(48, 66, rng());

        const alpha = bright
          ? lerp(0.32, 0.68, rng())
          : lerp(0.060, 0.23, rng());

        return {
          x: rng(),
          y: rng(),

          radius: bright
            ? lerp(0.85, 1.80, rng())
            : lerp(0.20, 0.78, rng()),

          alpha,

          phase:
            rng() *
            Math.PI *
            2,

          speed: lerp(
            0.08,
            0.22,
            rng()
          ),

          drift: lerp(
            3,
            14,
            rng()
          ),

          depth: lerp(
            0.55,
            1,
            rng()
          ),

          cluster: rng(),

          hue,
          saturation,
          lightness,

          fill:
            `hsla(${hue},${saturation}%,${lightness}%,${alpha})`,

          shadow:
            `hsla(${hue},95%,68%,${alpha * 0.55})`,

          index,
        };
      }
    );

    const movingCount = Math.max(
      110,
      Math.round(count * 0.22)
    );

    this.movingParticles = particles.slice(
      0,
      movingCount
    );

    this.staticParticles = particles.slice(
      movingCount
    );
  }

  renderStaticLayer() {
    const ctx = this.staticCtx;

    ctx.clearRect(
      0,
      0,
      this.width,
      this.height
    );

    ctx.save();

    ctx.globalCompositeOperation = "screen";

    for (const particle of this.staticParticles) {
      const position =
        this.getClusteredPosition(particle);

      ctx.fillStyle = particle.fill;

      if (particle.radius > 0.95) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = particle.shadow;
      } else {
        ctx.shadowBlur = 0;
      }

      ctx.beginPath();

      ctx.arc(
        position.x,
        position.y,
        particle.radius,
        0,
        Math.PI * 2
      );

      ctx.fill();
    }

    ctx.restore();
  }

  render(time) {
    const ctx = this.ctx;

    ctx.clearRect(
      0,
      0,
      this.width,
      this.height
    );

    ctx.drawImage(
      this.staticCanvas,
      0,
      0,
      this.staticCanvas.width,
      this.staticCanvas.height,
      0,
      0,
      this.width,
      this.height
    );

    ctx.save();

    ctx.globalCompositeOperation = "screen";

    for (const particle of this.movingParticles) {
      const base =
        this.getClusteredPosition(particle);

      const motion =
        time *
        particle.speed;

      const x =
        base.x +
        Math.sin(
          motion +
          particle.phase
        ) *
          particle.drift *
          particle.depth;

      const y =
        base.y +
        Math.cos(
          motion * 0.83 +
          particle.phase
        ) *
          particle.drift *
          0.55 *
          particle.depth;

      const pulse =
        0.78 +
        Math.sin(
          motion * 2 +
          particle.phase
        ) *
          0.22;

      ctx.fillStyle =
        `hsla(${particle.hue},${particle.saturation}%,${particle.lightness}%,${particle.alpha * pulse})`;

      if (particle.radius > 0.95) {
        ctx.shadowBlur = 8;
        ctx.shadowColor = particle.shadow;
      } else {
        ctx.shadowBlur = 0;
      }

      ctx.beginPath();

      ctx.arc(
        x,
        y,
        particle.radius,
        0,
        Math.PI * 2
      );

      ctx.fill();
    }

    ctx.restore();
  }

  getClusteredPosition(particle) {
    const clusterX =
      particle.cluster < 0.38
        ? this.width * 0.50
        : particle.cluster < 0.62
          ? this.width * 0.24
          : this.width * 0.77;

    const clusterY =
      particle.cluster < 0.38
        ? this.height * 0.46
        : particle.cluster < 0.62
          ? this.height * 0.62
          : this.height * 0.31;

    const clusterPull =
      particle.cluster < 0.72
        ? 0.13
        : 0;

    const baseX =
      particle.x *
      this.width;

    const baseY =
      particle.y *
      this.height;

    return {
      x:
        baseX +
        (clusterX - baseX) *
          clusterPull,

      y:
        baseY +
        (clusterY - baseY) *
          clusterPull,
    };
  }
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mulberry32(seed) {
  return function() {
    let t =
      seed +=
        0x6D2B79F5;

    t =
      Math.imul(
        t ^ (t >>> 15),
        t | 1
      );

    t ^=
      t +
      Math.imul(
        t ^ (t >>> 7),
        t | 61
      );

    return (
      (
        t ^
        (t >>> 14)
      ) >>>
      0
    ) /
      4294967296;
  };
}
