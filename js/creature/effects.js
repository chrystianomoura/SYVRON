"use strict";

import { pointBetween, lerp } from "./geometry.js";

/* =========================================================
   SYVRON — CREATURE EFFECTS
   ---------------------------------------------------------
   Este módulo concentra os efeitos visuais auxiliares da
   criatura:

   - atmosfera / glow externo;
   - pontos de energia;
   - poeira próxima ao organismo;
   - campo de partículas ao redor da forma.

   Ele NÃO define a anatomia principal da criatura.

   A geometria-base é recebida de outros módulos e usada aqui
   apenas como referência para posicionar efeitos luminosos.
========================================================= */

/*
  TAU representa uma volta completa em radianos.

  2π = 360°

  Usar TAU deixa chamadas como ctx.arc() mais legíveis quando
  queremos desenhar um círculo completo.
*/
const TAU = Math.PI * 2;

/* =========================================================
   ENERGY POINTS
   ---------------------------------------------------------
   Pontos de energia distribuídos ao longo da criatura.

   Cada objeto possui:

   u
   → posição normalizada ao longo da forma.

   lane
   → posição transversal entre as bordas interna e externa.

   power
   → intensidade luminosa.

   radius
   → escala do glow.

   Esses pontos são independentes da anatomia principal para
   permitir iluminação irregular e orgânica.
========================================================= */

const ENERGY_POINTS = [
  { u: 0.018, lane: 0.82, power: 0.34, radius: 0.48 },
  { u: 0.071, lane: 0.41, power: 0.18, radius: 0.33 },
  { u: 0.118, lane: 0.25, power: 0.25, radius: 0.38 },
  { u: 0.168, lane: 0.66, power: 0.16, radius: 0.31 },
  { u: 0.226, lane: 0.77, power: 0.29, radius: 0.42 },
  { u: 0.286, lane: 0.35, power: 0.15, radius: 0.29 },
  { u: 0.348, lane: 0.54, power: 0.22, radius: 0.35 },
  { u: 0.404, lane: 0.3, power: 0.17, radius: 0.3 },
  { u: 0.463, lane: 0.73, power: 0.24, radius: 0.37 },
  { u: 0.519, lane: 0.81, power: 0.3, radius: 0.43 },
  { u: 0.575, lane: 0.45, power: 0.15, radius: 0.28 },
  { u: 0.628, lane: 0.23, power: 0.35, radius: 0.47 },
  { u: 0.681, lane: 0.61, power: 0.18, radius: 0.31 },
  { u: 0.735, lane: 0.75, power: 0.23, radius: 0.36 },
  { u: 0.79, lane: 0.38, power: 0.16, radius: 0.29 },
  { u: 0.844, lane: 0.56, power: 0.21, radius: 0.34 },
  { u: 0.892, lane: 0.29, power: 0.28, radius: 0.41 },
  { u: 0.942, lane: 0.69, power: 0.18, radius: 0.31 },
  { u: 0.978, lane: 0.48, power: 0.22, radius: 0.35 },
];

/* =========================================================
   ATMOSPHERE
   ---------------------------------------------------------
   Desenha um glow difuso ao redor da borda externa.

   outerPath
   → caminho da borda externa da criatura.

   strokeClosed
   → função recebida externamente para desenhar esse caminho.
========================================================= */

export function drawAtmosphere(ctx, cx, cy, size, outerPath, strokeClosed) {
  ctx.save();

  /*
    "screen" soma luminosidade aos pixels existentes.

    É especialmente útil para brilhos em fundos escuros.
  */
  ctx.globalCompositeOperation = "screen";

  /*
    O blur cresce proporcionalmente ao tamanho da criatura,
    mas nunca fica abaixo de 18px.
  */
  ctx.filter = `blur(${Math.max(18, size * 0.035)}px)`;

  ctx.lineWidth = size * 0.052;
  ctx.strokeStyle = "rgba(91,31,221,.14)";

  strokeClosed(ctx, outerPath);

  ctx.restore();
}

/* =========================================================
   ENERGY HIGHLIGHTS
   ---------------------------------------------------------
   Desenha pequenas regiões luminosas sobre a criatura.

   motion pode fornecer:

   time
   → tempo global da animação.

   shimmer
   → intensidade da animação desses pontos.
========================================================= */

export function drawHighlights(ctx, cx, cy, size, base, motion = {}) {
  const time = motion.time ?? 0;
  const shimmer = motion.shimmer ?? 0;

  ENERGY_POINTS.forEach((point, index) => {
    /* -----------------------------------------------------
       LONGITUDINAL DRIFT
       -----------------------------------------------------
       Pequeno deslocamento da posição ao longo da criatura.

       Cada ponto usa uma fase diferente baseada no índice,
       impedindo movimento sincronizado.
    ----------------------------------------------------- */

    const drift = Math.sin(time * 0.42 + index * 1.37) * 0.018 * shimmer;

    /*
      wrap01() garante que u permaneça no intervalo [0, 1),
      permitindo atravessar o fim e continuar no início.
    */
    const u = wrap01(point.u + drift);

    /* -----------------------------------------------------
       LANE DRIFT
       -----------------------------------------------------
       Pequena oscilação transversal entre as bordas.
    ----------------------------------------------------- */

    const laneDrift = Math.sin(time * 0.34 + index * 0.84) * 0.052 * shimmer;

    /*
      Evitamos aproximar demais o highlight das extremidades
      internas/externas da faixa.
    */
    const lane = clamp(point.lane + laneDrift, 0.02, 0.98);

    /*
      pointBetween() converte u + lane em uma coordenada
      concreta dentro da geometria da criatura.
    */
    const p = pointBetween(cx, cy, base, u, lane);

    /* -----------------------------------------------------
       BREATHING
       -----------------------------------------------------
       Faz o tamanho do glow pulsar suavemente.
    ----------------------------------------------------- */

    const breathing = 1 + Math.sin(time * 1.05 + index * 0.73) * 0.3 * shimmer;

    const r = size * 0.0165 * point.radius * breathing;

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    /* -----------------------------------------------------
       RADIAL GLOW
       -----------------------------------------------------
       O gradiente possui várias camadas de cor e opacidade,
       criando um núcleo claro e bordas violetas suaves.
    ----------------------------------------------------- */

    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);

    glow.addColorStop(0, `rgba(226,217,255,${0.42 * point.power})`);

    glow.addColorStop(0.16, `rgba(191,153,255,${0.32 * point.power})`);

    glow.addColorStop(0.44, `rgba(120,72,232,${0.16 * point.power})`);

    glow.addColorStop(0.78, `rgba(84,26,200,${0.05 * point.power})`);

    glow.addColorStop(1, "rgba(52,16,132,0)");

    ctx.fillStyle = glow;

    ctx.beginPath();

    ctx.arc(p.x, p.y, r, 0, TAU);

    ctx.fill();

    ctx.restore();
  });
}

/* =========================================================
   DUST
   ---------------------------------------------------------
   Cria duas famílias diferentes de partículas:

   1. matéria próxima à superfície da criatura;
   2. campo ambiente distribuído ao redor do organismo.

   A seed fixa faz a poeira permanecer visualmente estável
   entre frames.
========================================================= */

export function drawDust(ctx, cx, cy, size, base) {
  /*
    Como o gerador sempre começa com a mesma seed, os mesmos
    pontos são produzidos em cada chamada.

    Isso evita "flicker" aleatório entre frames.
  */
  const rng = mulberry32(99881);

  ctx.save();

  ctx.globalCompositeOperation = "screen";

  /* =======================================================
     SURFACE DUST
     -------------------------------------------------------
     Matéria liberada perto das bordas da criatura.
  ======================================================= */

  for (let i = 0; i < 160; i += 1) {
    /*
      Posição aleatória ao longo da anatomia.
    */
    const u = rng();

    /*
      Decide se a partícula nasce próxima da borda externa
      ou interna.
    */
    const side = rng() > 0.42 ? 1 : -1;

    /*
      lane próxima de 1 → borda externa.
      lane próxima de 0 → borda interna.
    */
    const lane = side > 0 ? 0.985 : 0.015;

    const p = pointBetween(cx, cy, base, u, lane);

    /*
      Ângulo aproximado correspondente à posição circular.
    */
    const angle = u * TAU - Math.PI / 2;

    /*
      Distância da partícula em relação à superfície.

      side também define se o deslocamento acontece para fora
      ou para dentro.
    */
    const push = size * lerp(0.008, 0.12, rng()) * side;

    const x = p.x + Math.cos(angle) * push;

    const y = p.y + Math.sin(angle) * push;

    const radius = lerp(0.3, 1.3, rng());

    const alpha = lerp(0.055, 0.32, rng());

    ctx.fillStyle = `rgba(143,67,255,${alpha})`;

    ctx.beginPath();

    ctx.arc(x, y, radius, 0, TAU);

    ctx.fill();
  }

  /* =======================================================
     AMBIENT FIELD
     -------------------------------------------------------
     Partículas mais espalhadas ao redor da criatura e
     também dentro de sua região negativa.
  ======================================================= */

  for (let i = 0; i < 250; i += 1) {
    const angle = rng() * TAU;

    /*
      sqrt() muda a distribuição radial.

      Sem isso, muitos pontos ficariam concentrados de forma
      diferente ao longo do raio.
    */
    const radial = Math.sqrt(rng());

    const distance = size * lerp(0.1, 0.65, radial);

    /*
      Pequenos fatores aleatórios em X e Y quebram a simetria
      circular perfeita.
    */
    const x = cx + Math.cos(angle) * distance * lerp(0.84, 1.18, rng());

    const y = cy + Math.sin(angle) * distance * lerp(0.82, 1.14, rng());

    /*
      Cerca de 5% recebem raio maior.
    */
    const radius =
      rng() > 0.95 ? lerp(1.0, 1.8, rng()) : lerp(0.22, 0.78, rng());

    /*
      Uma pequena parcela também recebe maior intensidade.
    */
    const alpha =
      rng() > 0.9 ? lerp(0.18, 0.44, rng()) : lerp(0.035, 0.17, rng());

    ctx.fillStyle = `rgba(137,63,255,${alpha})`;

    ctx.beginPath();

    ctx.arc(x, y, radius, 0, TAU);

    ctx.fill();
  }

  ctx.restore();
}

/* =========================================================
   CLAMP
   ---------------------------------------------------------
   Restringe um número ao intervalo informado.

   clamp(12, 0, 10) → 10
   clamp(-2, 0, 10) → 0
   clamp(6, 0, 10)  → 6
========================================================= */

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/* =========================================================
   WRAP 0–1
   ---------------------------------------------------------
   Mantém um número dentro de um intervalo cíclico [0, 1).

   Exemplos:

   1.1  → 0.1
   -0.1 → 0.9

   É útil para posições que percorrem uma estrutura fechada.
========================================================= */

function wrap01(value) {
  return ((value % 1) + 1) % 1;
}

/* =========================================================
   SEEDED RANDOM — MULBERRY32
   ---------------------------------------------------------
   Gerador pseudoaleatório determinístico.

   A mesma seed produz sempre a mesma sequência.

   Isso é importante para efeitos estáticos como a poeira:
   sem uma seed fixa, cada frame produziria posições novas
   e as partículas pareceriam piscar aleatoriamente.
========================================================= */

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);

    t = Math.imul(t ^ (t >>> 15), t | 1);

    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}