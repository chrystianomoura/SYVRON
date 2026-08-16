"use strict";

import { ANATOMY } from "./anatomy.js";

/* =========================================================
   SYVRON — CREATURE GEOMETRY
   ---------------------------------------------------------
   Este módulo transforma os parâmetros definidos em
   anatomy.js em geometria matemática utilizável.

   Responsabilidades principais:

   - calcular o raio externo da criatura;
   - calcular o raio interno;
   - aplicar massas locais;
   - calcular regiões de torção;
   - calcular regiões de pinçamento;
   - converter posições paramétricas em coordenadas 2D;
   - gerar caminhos das bordas;
   - suavizar a emenda técnica u = 0 / u = 1.

   Este módulo NÃO controla animação.

   Ele descreve a forma matemática da criatura.
========================================================= */

/*
  TAU representa uma volta completa:

  2π radianos = 360°.
*/
const TAU = Math.PI * 2;

/* =========================================================
   BUMP
   ---------------------------------------------------------
   Cria uma influência localizada e suave ao redor de um
   determinado ponto da anatomia.

   u
   → posição atual ao longo da criatura.

   center
   → centro da deformação.

   width
   → largura da região influenciada.

   O resultado segue uma curva gaussiana:

   próximo do centro → valor próximo de 1;
   longe do centro   → valor próximo de 0.

   Como a criatura é fechada, u = 0 e u = 1 representam
   posições vizinhas. Por isso usamos distância circular.
========================================================= */

export function bump(u, center, width) {
  const raw = Math.abs(u - center);

  /*
    Em uma estrutura circular existem dois caminhos possíveis
    entre dois pontos.

    Escolhemos sempre o menor.
  */
  const d = Math.min(raw, 1 - raw);

  /*
    Função gaussiana.

    O sinal negativo faz a influência cair suavemente conforme
    aumenta a distância em relação ao centro.
  */
  return Math.exp(-(d * d) / (2 * width * width));
}

/* =========================================================
   APPLY MASSES
   ---------------------------------------------------------
   Soma todas as deformações locais descritas em anatomy.js.

   Cada massa possui:

   at
   → posição da deformação.

   width
   → área de influência.

   amount
   → intensidade e direção.

   amount positivo
   → expande.

   amount negativo
   → contrai.
========================================================= */

function applyMasses(u, masses) {
  return masses.reduce(
    (sum, mass) => sum + mass.amount * bump(u, mass.at, mass.width),
    0,
  );
}

/* =========================================================
   OUTER RADIUS
   ---------------------------------------------------------
   Calcula a borda externa da criatura em uma posição u.

   O raio final é formado por:

   1. raio-base;
   2. ondulações senoidais suaves;
   3. massas anatômicas locais.

   As frequências diferentes impedem que a silhueta pareça
   um círculo matematicamente perfeito.
========================================================= */

export function outerRadius(u) {
  const a = u * TAU;

  return (
    ANATOMY.outerBase +
    /*
      Ondulação estrutural de baixa frequência.
    */
    0.035 * Math.sin(a * 2 - 0.25) +
    /*
      Segunda frequência para quebrar a simetria.
    */
    0.022 * Math.cos(a * 3 + 0.95) +
    /*
      Deformações específicas definidas no DNA da criatura.
    */
    applyMasses(u, ANATOMY.outerMasses)
  );
}

/* =========================================================
   INNER RADIUS
   ---------------------------------------------------------
   Calcula a borda interna da criatura.

   Ela é completamente independente da borda externa.

   Essa independência é fundamental para criar variações
   orgânicas de espessura.
========================================================= */

export function innerRadius(u) {
  const a = u * TAU;

  /*
    Algumas ondas internas não são perfeitamente periódicas.

    seamContinuityWeight() reduz essas oscilações próximo da
    emenda técnica u = 0 / u = 1 para impedir um salto visual.
  */
  const seam = seamContinuityWeight(u, 0.06);

  return (
    ANATOMY.innerBase +
    0.022 * Math.sin(a * 2.15 + 0.55) * seam -
    0.018 * Math.cos(a * 3.1 - 0.3) * seam +
    applyMasses(u, ANATOMY.innerMasses)
  );
}

/* =========================================================
   TWIST
   ---------------------------------------------------------
   Retorna a intensidade de torção anatômica na posição u.

   A interpretação geométrica dessa torção acontece em outros
   módulos, especialmente fibers.js.
========================================================= */

export function twistAmount(u) {
  return applyMasses(u, ANATOMY.twistZones);
}

/* =========================================================
   PINCH
   ---------------------------------------------------------
   Calcula a intensidade de pinçamento da criatura.

   Math.max(0, ...) impede que uma combinação de massas
   produza pinçamento negativo.
========================================================= */

export function pinchAmount(u) {
  return Math.max(0, applyMasses(u, ANATOMY.pinchZones));
}

/* =========================================================
   POINT BETWEEN
   ---------------------------------------------------------
   Converte uma posição paramétrica da criatura em uma
   coordenada cartesiana { x, y }.

   cx / cy
   → centro da criatura.

   base
   → escala geral.

   u
   → posição ao longo da volta.

   lane
   → posição entre borda interna e externa.

      0 → borda interna.
      1 → borda externa.

   tangentShift
   → pequeno deslocamento na direção tangencial.
========================================================= */

export function pointBetween(cx, cy, base, u, lane, tangentShift = 0) {
  /*
    -π/2 faz u = 0 começar visualmente no topo.
  */
  const angle = u * TAU - Math.PI / 2;

  const inner = innerRadius(u);

  const outer = outerRadius(u);

  /* -------------------------------------------------------
     PINCH
     -------------------------------------------------------
     O pinçamento aproxima lane de 0.5.

     Quanto maior pinchAmount(), mais a faixa local se
     comprime em direção ao centro de sua espessura.
  ------------------------------------------------------- */

  const pinched = 0.5 + (lane - 0.5) * (1 - pinchAmount(u));

  /*
    smoothstep() evita interpolação visualmente rígida entre
    as bordas interna e externa.
  */
  const radius = lerp(inner, outer, smoothstep(pinched)) * base;

  /*
    Deslocamento tangencial convertido para a escala atual.
  */
  const tangent = tangentShift * base;

  /*
    Conversão polar → cartesiana.

    Os fatores 1.012 e 0.988 introduzem uma assimetria
    elíptica extremamente discreta.

    O deslocamento tangencial usa o ângulo + 90°.
  */
  return {
    x:
      cx +
      Math.cos(angle) * radius * 1.012 +
      Math.cos(angle + Math.PI / 2) * tangent,

    y:
      cy +
      Math.sin(angle) * radius * 0.988 +
      Math.sin(angle + Math.PI / 2) * tangent * 0.86,
  };
}

/* =========================================================
   BOUNDARY PATH
   ---------------------------------------------------------
   Gera uma sequência de pontos representando uma das bordas
   completas da criatura.

   which:

   "outer"
   → borda externa.

   qualquer outro valor
   → borda interna.

   samples determina quantos pontos compõem a curva.

   Mais samples:
   → curva mais suave;
   → maior custo de cálculo.
========================================================= */

export function boundaryPath(cx, cy, base, which, samples = 340) {
  const points = [];

  for (let i = 0; i < samples; i += 1) {
    const u = i / samples;

    const angle = u * TAU - Math.PI / 2;

    const radius = (which === "outer" ? outerRadius(u) : innerRadius(u)) * base;

    points.push({
      x: cx + Math.cos(angle) * radius * 1.012,

      y: cy + Math.sin(angle) * radius * 0.988,
    });
  }

  return points;
}

/* =========================================================
   CLAMP
   ---------------------------------------------------------
   Mantém um número dentro de um intervalo.

   clamp(12, 0, 10) → 10
   clamp(-3, 0, 10) → 0
   clamp(5, 0, 10)  → 5
========================================================= */

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/* =========================================================
   LINEAR INTERPOLATION — LERP
   ---------------------------------------------------------
   Retorna um valor situado entre a e b.

   t = 0
   → a

   t = 0.5
   → metade do caminho.

   t = 1
   → b.
========================================================= */

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/* =========================================================
   SMOOTHSTEP
   ---------------------------------------------------------
   Produz uma interpolação suave entre 0 e 1.

   Fórmula:

   x²(3 - 2x)

   Diferente de uma interpolação linear, a curva entra e sai
   suavemente, reduzindo mudanças bruscas de inclinação.
========================================================= */

function smoothstep(t) {
  const x = clamp(t, 0, 1);

  return x * x * (3 - 2 * x);
}

/* =========================================================
   SEAM CONTINUITY WEIGHT
   ---------------------------------------------------------
   A criatura é paramétrica e fechada:

   u = 0
   e
   u = 1

   representam o mesmo ponto.

   Entretanto, algumas ondas usadas na anatomia interna não
   possuem frequência perfeitamente inteira. Isso poderia
   produzir uma pequena descontinuidade exatamente na emenda.

   Esta função cria uma janela suave:

   na emenda:
   → peso = 0.

   fora da pequena região:
   → peso = 1.

   Somente termos não perfeitamente periódicos precisam usar
   esse peso.
========================================================= */

export function seamContinuityWeight(u, width = 0.06) {
  /*
    Garante que qualquer valor de u seja convertido para
    o intervalo [0, 1).
  */
  const wrapped = ((u % 1) + 1) % 1;

  /*
    Distância circular até a emenda.
  */
  const distance = Math.min(wrapped, 1 - wrapped);

  /*
    Converte a distância para 0–1 dentro da região de
    suavização.
  */
  const x = clamp(distance / width, 0, 1);

  /*
    Quintic smoothstep:

    6x⁵ - 15x⁴ + 10x³

    Possui derivadas suaves nas extremidades e torna a
    transição praticamente invisível.
  */
  return x * x * x * (x * (x * 6 - 15) + 10);
}