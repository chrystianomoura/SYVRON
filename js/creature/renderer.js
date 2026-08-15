import { ANATOMY } from "./anatomy.js";
import { boundaryPath, pointBetween } from "./geometry.js";
import { FiberField } from "./fibers.js";
import {
  drawAtmosphere,
  drawDust,
  drawHighlights,
} from "./effects.js";

export class CreatureRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.width = 1;
    this.height = 1;
    this.dpr = 1;
    this.field = new FiberField();
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  render(motion = {}) {
    const ctx = this.ctx;
    const size =
      Math.min(this.width, this.height) *
      (this.width < 700 ? 0.94 : 0.86);

    const cx = this.width * 0.5;
    const cy = this.height * 0.5;
    const base = size * 0.39;

    ctx.clearRect(0, 0, this.width, this.height);

    // IMPORTANT: these are the exact static V5 boundaries.
    const outer = boundaryPath(cx, cy, base, "outer");
    const inner = boundaryPath(cx, cy, base, "inner");

    drawAtmosphere(ctx, cx, cy, size, outer, strokeClosed);
    this.drawBody(ctx, cx, cy, size, base, outer, inner);
    this.drawSheets(ctx, cx, cy, size, base, motion);
    this.drawFibers(ctx, cx, cy, size, base, motion);
    // Artificial cross-membrane stitch layer disabled.
    drawHighlights(ctx, cx, cy, size, base, motion);
    this.drawBiologicalReaction(ctx, cx, cy, size, base, motion);
    drawDust(ctx, cx, cy, size, base);
  }

  drawBiologicalReaction(ctx, cx, cy, size, base, motion) {
    const wave = motion.wave ?? 0;
    const lapProgress = motion.lapProgress ?? -1;
    const ignition = motion.ignition ?? 0;
    const contraction = motion.contraction ?? 0;
    const time = motion.time ?? 0;

    if (wave > 0.01 && lapProgress >= 0) {
      const center = lapProgress;

      ctx.save();
      ctx.globalCompositeOperation = "screen";

      for (let i = 0; i < 42; i += 1) {
        const u = (center + (i - 21) * 0.0040 + 1) % 1;
        const p = pointBetween(cx, cy, base, u, 0.5);
        const alpha = wave * (1 - Math.abs(i - 21) / 21) * 0.22;

        ctx.fillStyle = `rgba(216,165,255,${Math.max(0, alpha)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size * 0.0105, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    if (ignition > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = ignition * 0.075;
      ctx.filter = `blur(${Math.max(7, size * 0.013)}px)`;
      ctx.strokeStyle = "rgba(184,104,255,.9)";
      ctx.lineWidth = size * 0.0055;
      strokeClosed(ctx, boundaryPath(cx, cy, base, "outer"));
      ctx.restore();
    }

    if (contraction > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = contraction * 0.055;
      ctx.strokeStyle = "rgba(227,193,255,.7)";
      ctx.lineWidth = size * 0.0018;
      strokeClosed(ctx, boundaryPath(cx, cy, base, "inner"));
      ctx.restore();
    }
  }

  drawBody(ctx, cx, cy, size, base, outer, inner) {
    ctx.save();

    const gradient = ctx.createRadialGradient(
      cx - size * 0.08,
      cy - size * 0.12,
      base * 0.48,
      cx,
      cy,
      base * 1.50
    );

    gradient.addColorStop(0, "rgba(71,39,156,0)");
    gradient.addColorStop(0.38, "rgba(75,41,159,.24)");
    gradient.addColorStop(0.72, "rgba(55,12,112,.32)");
    gradient.addColorStop(1, "rgba(75,42,159,.10)");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    traceClosed(ctx, outer);
    traceClosed(ctx, [...inner].reverse());
    ctx.fill("evenodd");
    ctx.restore();
  }

  drawSheets(ctx, cx, cy, size, base, motion) {
    const lanes = [0.08, 0.20, 0.34, 0.50, 0.67, 0.82, 0.94];
    const membrane = motion.membrane ?? 0;
    const time = motion.time ?? 0;

    lanes.forEach((lane, index) => {
      const microDrift =
        Math.sin(time * 0.42 + index * 1.27) *
        0.038 *
        membrane;

      const synthetic = {
        lane: Math.max(0.02, Math.min(0.98, lane + microDrift)),
        phase1: 0.7 + index * 0.81,
        phase2: 1.4 + index * 0.53,
        phase3: 2.1 + index * 0.37,
        migration: 0.034 + index * 0.0032,
        tangent: 0.017,
        family: index,
        speed: 0.78 + index * 0.06,
      };

      const path = this.field.pathFor(cx, cy, base, synthetic, motion);

      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.filter = `blur(${Math.max(1.5, size * 0.0045)}px)`;
      ctx.lineWidth = size * (0.018 + (index % 2) * 0.007);
      ctx.strokeStyle =
        index % 2
          ? "rgba(122,76,246,.060)"
          : "rgba(177,128,255,.050)";

      strokeClosed(ctx, path);
      ctx.restore();
    });
  }

  drawFibers(ctx, cx, cy, size, base, motion) {
    this.field.fibers.forEach((fiber, index) => {
      const path = this.field.pathFor(cx, cy, base, fiber, motion);

      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = Math.max(
        0.45,
        size * 0.00094 * fiber.width
      );

      const gradient = ctx.createLinearGradient(
        cx - size * 0.48,
        cy - size * 0.45,
        cx + size * 0.49,
        cy + size * 0.46
      );

      const a = fiber.alpha;

      // Cold palette lock:
      // deep violet -> electric violet -> cold lilac -> indigo-violet.
      // No warm whites, gray-beige or yellow-adjacent values.
      if (fiber.brightness > 0.72) {
        gradient.addColorStop(0.00, `rgba(93,56,226,${a * 0.60})`);
        gradient.addColorStop(0.22, `rgba(154,91,255,${a * 0.90})`);
        gradient.addColorStop(0.46, `rgba(210,177,255,${a})`);
        gradient.addColorStop(0.68, `rgba(126,79,245,${a * 0.76})`);
        gradient.addColorStop(0.86, `rgba(104,71,224,${a * 0.66})`);
        gradient.addColorStop(1.00, `rgba(72,48,184,${a * 0.48})`);
      } else {
        gradient.addColorStop(0.00, `rgba(64,40,164,${a * 0.48})`);
        gradient.addColorStop(0.24, `rgba(112,64,224,${a * 0.74})`);
        gradient.addColorStop(0.50, `rgba(165,108,255,${a * 0.82})`);
        gradient.addColorStop(0.72, `rgba(105,68,218,${a * 0.64})`);
        gradient.addColorStop(1.00, `rgba(58,38,150,${a * 0.42})`);
      }

      ctx.strokeStyle = gradient;

      if (index % 19 === 0) {
        ctx.shadowBlur = size * 0.008;
        ctx.shadowColor = "rgba(180,105,255,.44)";
      }

      strokeClosed(ctx, path);
      ctx.restore();
    });
  }

  drawTwistBridges(ctx, cx, cy, size, base, motion) {
    const time = motion.time ?? 0;
    const flow = motion.flow ?? 0;

    for (const [zoneIndex, zone] of ANATOMY.twistZones.entries()) {
      const strands = 9;

      for (let i = 0; i < strands; i += 1) {
        const t = i / (strands - 1);
        const localPulse =
          Math.sin(time * 0.40 + zoneIndex * 0.83 + t * 1.7) *
          0.042 *
          flow;

        const u0 = wrap(zone.at - zone.width * 0.75 + localPulse);
        const u1 = wrap(zone.at + zone.width * 0.75 + localPulse);

        const reverse = zone.amount < 0;
        const lane0 = reverse ? t : 1 - t;
        const lane1 = reverse ? 1 - t : t;

        const p0 = pointBetween(cx, cy, base, u0, lane0);
        const pm = pointBetween(
          cx,
          cy,
          base,
          wrap(zone.at + localPulse),
          0.5 + Math.sin(t * Math.PI) * (reverse ? -0.15 : 0.15),
          (t - 0.5) * 0.024
        );
        const p1 = pointBetween(cx, cy, base, u1, lane1);

        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.lineWidth = Math.max(0.45, size * 0.00092);
        ctx.strokeStyle =
          zoneIndex % 2
            ? `rgba(112,78,238,${0.12 + 0.14 * Math.sin(t * Math.PI)})`
            : `rgba(201,167,255,${0.14 + 0.15 * Math.sin(t * Math.PI)})`;

        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.quadraticCurveTo(pm.x, pm.y, p1.x, p1.y);
        ctx.stroke();
        ctx.restore();
      }
    }
  }
}

function strokeClosed(ctx, points) {
  ctx.beginPath();
  traceClosed(ctx, points);
  ctx.stroke();
}

function traceClosed(ctx, points) {
  if (points.length < 4) return;

  const n = points.length;

  // True periodic Catmull-Rom converted to cubic Bezier.
  // Because p0/p1/p2/p3 wrap around the array, the tangent at the seam
  // is continuous and no "zipper" can form at 12 o'clock.
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 0; i < n; i += 1) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];

    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;

    ctx.bezierCurveTo(
      c1x,
      c1y,
      c2x,
      c2y,
      p2.x,
      p2.y
    );
  }

  ctx.closePath();
}

function wrap(value) {
  return ((value % 1) + 1) % 1;
}
