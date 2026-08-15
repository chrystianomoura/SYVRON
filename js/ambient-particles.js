export class AmbientParticles {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");

    this.width = 1;
    this.height = 1;
    this.dpr = 1;

    this.particles = [];
    this.seed = 497123;
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);

    this.ctx.setTransform(
      this.dpr,
      0,
      0,
      this.dpr,
      0,
      0
    );

    this.createParticles();
  }

  createParticles() {
    const rng = mulberry32(this.seed);

    const area =
      this.width *
      this.height;

    const count =
      Math.round(
        Math.max(
          620,
          Math.min(
            1180,
            area / 1750
          )
        )
      );

    this.particles =
      Array.from(
        { length: count },
        (_, index) => {
          const bright =
            rng() > 0.79;

          return {
            x: rng(),
            y: rng(),

            radius:
              bright
                ? lerp(0.85, 1.80, rng())
                : lerp(0.20, 0.78, rng()),

            alpha:
              bright
                ? lerp(0.32, 0.68, rng())
                : lerp(0.060, 0.23, rng()),

            phase:
              rng() *
              Math.PI *
              2,

            speed:
              lerp(
                0.08,
                0.22,
                rng()
              ),

            drift:
              lerp(
                3,
                14,
                rng()
              ),

            depth:
              lerp(
                0.55,
                1,
                rng()
              ),

            cluster:
              rng(),

            hue:
              lerp(
                263,
                283,
                rng()
              ),

            saturation:
              lerp(
                72,
                100,
                rng()
              ),

            lightness:
              bright
                ? lerp(60, 76, rng())
                : lerp(48, 66, rng()),

            index,
          };
        }
      );
  }

  render(time) {
    const ctx =
      this.ctx;

    ctx.clearRect(
      0,
      0,
      this.width,
      this.height
    );

    ctx.save();

    ctx.globalCompositeOperation =
      "screen";

    for (
      const particle
      of this.particles
    ) {
      const motion =
        time *
        particle.speed;

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

      const x =
        baseX +
        (clusterX - baseX) *
          clusterPull +
        Math.sin(
          motion +
          particle.phase
        ) *
          particle.drift *
          particle.depth;

      const y =
        baseY +
        (clusterY - baseY) *
          clusterPull +
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
        ctx.shadowBlur = 10;
        ctx.shadowColor =
          `hsla(${particle.hue},95%,68%,${particle.alpha * 0.55})`;
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
