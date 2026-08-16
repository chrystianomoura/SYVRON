"use strict";

import {
  clamp,
  lerp,
  innerRadius,
  outerRadius,
  pinchAmount,
  twistAmount,
  seamContinuityWeight,
} from "./geometry.js";

/* =========================================================
   SYVRON — FIBER FIELD
   ---------------------------------------------------------
   Responsabilidade deste módulo:

   - criar as fibras internas da criatura;
   - distribuir características individuais entre elas;
   - calcular a posição transversal de cada fibra;
   - aplicar movimento natural, LAP e RESET;
   - transformar a anatomia paramétrica em caminhos 2D;
   - reutilizar cálculos e objetos para reduzir custo por frame.

   Este é um dos módulos matematicamente mais intensivos
   da criatura.

   Uma única fibra é formada por centenas de pontos.
   Como dezenas de fibras são renderizadas a cada frame,
   pequenas otimizações aqui possuem grande impacto.
========================================================= */

/*
  TAU representa uma volta completa:

  2π radianos = 360 graus.
*/
const TAU = Math.PI * 2;

/*
  Quantidade padrão de amostras usadas para construir
  o caminho de cada fibra.

  320 pontos × 86 fibras ≈ 27.500 pontos por frame.
*/
const DEFAULT_SAMPLES = 320;

export class FiberField {
  constructor(count = 86) {
    /*
      Cada fibra recebe características próprias, mas
      determinísticas por causa da seed fixa.
    */
    this.fibers = this.createFibers(count);

    /* =====================================================
       GEOMETRY CACHE
       -----------------------------------------------------
       Grande parte da geometria depende somente de:

       - anatomia;
       - posição u;
       - quantidade de samples.

       Ela NÃO depende:

       - da fibra atual;
       - do tempo;
       - do estado da animação.

       Portanto, recalcular innerRadius(), outerRadius(),
       twistAmount(), pinchAmount(), seno, cosseno etc.
       para todas as fibras em todos os frames seria
       desperdício.

       O Map guarda um cache separado para cada quantidade
       de samples utilizada.
    ===================================================== */

    this.geometryCaches = new Map();

    /*
      Pré-construímos imediatamente o cache mais utilizado.
    */
    this.getGeometryCache(DEFAULT_SAMPLES);
  }

  /* =======================================================
     CREATE FIBERS
     -------------------------------------------------------
     Gera as características permanentes das fibras.

     A seed fixa garante que o "tecido" interno da criatura
     mantenha a mesma identidade entre execuções.
  ======================================================= */

  createFibers(count) {
    const rng = mulberry32(761923);

    const fibers = [];

    for (let i = 0; i < count; i += 1) {
      fibers.push({
        /*
          lane representa a posição transversal original
          da fibra entre as bordas interna e externa.

          0 → região interna.
          1 → região externa.
        */
        lane: i / (count - 1),

        /*
          Fases independentes impedem que todas as fibras
          oscilem exatamente da mesma maneira.
        */
        phase1: rng() * TAU,
        phase2: rng() * TAU,
        phase3: rng() * TAU,

        /*
          Intensidade do deslocamento transversal.
        */
        migration: lerp(0.012, 0.052, rng()),

        /*
          Intensidade do deslocamento tangencial.
        */
        tangent: lerp(0.004, 0.027, rng()),

        /*
          Opacidade individual.

          Math.pow() altera a distribuição aleatória para
          produzir mais variedade visual.
        */
        alpha: lerp(0.08, 0.48, Math.pow(rng(), 0.62)),

        /* Espessura individual da fibra. */
        width: lerp(0.5, 1.42, rng()),

        /*
          Família visual.

          Fibras da mesma família compartilham parte da fase
          de determinadas ondas, criando grupos sutis.
        */
        family: Math.floor(rng() * 7),

        /* Variação luminosa individual. */
        brightness: rng(),

        /* Pequena variação de velocidade. */
        speed: lerp(0.72, 1.24, rng()),

        /* =================================================
           REUSABLE PATHS
           -------------------------------------------------
           Em vez de criar centenas de novos objetos:

           { x, y }

           para cada fibra em todo frame, armazenamos arrays
           reutilizáveis.

           Com 86 fibras × 320 samples, isso evita cerca de
           27 mil novas alocações de objetos por frame.
        ================================================= */

        _paths: new Map(),
      });
    }

    return fibers;
  }

  /* =======================================================
     GEOMETRY CACHE
     -------------------------------------------------------
     Cria ou recupera valores geométricos que são iguais
     para todas as fibras.
  ======================================================= */

  getGeometryCache(samples = DEFAULT_SAMPLES) {
    const existing = this.geometryCaches.get(samples);

    if (existing) {
      return existing;
    }

    const cache = new Array(samples);

    for (let i = 0; i < samples; i += 1) {
      /*
        u percorre a criatura de 0 até quase 1.

        Como a estrutura é fechada, 0 e 1 representam
        essencialmente o mesmo ponto da volta.
      */
      const u = i / samples;

      /*
        -π/2 faz a referência inicial começar na parte
        superior da criatura.
      */
      const angle = u * TAU - Math.PI / 2;

      cache[i] = {
        u,

        /*
          Valor frequentemente reutilizado nas ondas.
        */
        uTau: u * TAU,

        /*
          Seno e cosseno são relativamente caros.

          Como são iguais para todas as fibras neste sample,
          calculamos apenas uma vez.
        */
        cosAngle: Math.cos(angle),

        sinAngle: Math.sin(angle),

        /* Anatomia interna e externa. */
        inner: innerRadius(u),

        outer: outerRadius(u),

        /* Pinçamento local da anatomia. */
        pinch: pinchAmount(u),

        /* Torção local. */
        twist: twistAmount(u),

        /*
          Peso que reduz descontinuidades perto da emenda
          u = 0 / u = 1.
        */
        seam: seamContinuityWeight(u, 0.06),

        /*
          Região inferior que recebe uma deformação extra.
        */
        lowerEnvelope: angularWindow(u, 0.605, 0.155),
      };
    }

    this.geometryCaches.set(samples, cache);

    return cache;
  }

  /* =======================================================
     REUSABLE PATH
     -------------------------------------------------------
     Obtém o array reutilizável de pontos de uma fibra.

     Existe um array separado para cada quantidade de samples.
  ======================================================= */

  getReusablePath(fiber, samples) {
    /*
      Proteção caso uma fibra externa tenha sido criada sem
      o Map utilizado pela implementação atual.
    */
    if (!fiber._paths) {
      fiber._paths = new Map();
    }

    let points = fiber._paths.get(samples);

    if (!points) {
      points = Array.from(
        {
          length: samples,
        },
        () => ({
          x: 0,
          y: 0,
        }),
      );

      fiber._paths.set(samples, points);
    }

    return points;
  }

  /* =======================================================
     LANE AT — REFERENCE IMPLEMENTATION
     -------------------------------------------------------
     Calcula a posição transversal de uma fibra em uma
     posição u específica.

     Esta versão é especialmente útil para compreender a
     matemática completa.

     O caminho de renderização principal utiliza
     laneAtCached(), que reaproveita cálculos compartilhados
     para obter o mesmo comportamento com menor custo.
  ======================================================= */

  laneAt(fiber, u, motion = {}) {
    const time = motion.time ?? 0;

    /*
      movementTime é o relógio procedural real da criatura.

      motion.js pode acelerar temporariamente esse relógio
      durante START e PAUSE sem precisar alterar diretamente
      a geometria aqui.
    */
    const movementTime =
      motion.movementTime ?? time * (motion.speed ?? motion.flow ?? 0);

    const flow = motion.flow ?? 0;

    const turbulence = motion.turbulence ?? 0;

    const wave = motion.wave ?? 0;

    const lapProgress = motion.lapProgress ?? -1;

    const contraction = motion.contraction ?? 0;

    const resetPulse = motion.resetPulse ?? 0;

    const resetTime = motion.resetTime ?? 0;

    const twist = twistAmount(u);

    /*
      Começamos sempre na posição-base individual da fibra.
    */
    let lane = fiber.lane;

    /* =====================================================
       NATURAL MOVEMENT
    ===================================================== */

    /*
      Torção anatômica.

      Quanto mais distante do centro (0.5), maior o efeito.
    */
    lane += twist * (0.5 - lane) * 0.88;

    /*
      Relógio individual da fibra.

      fiber.speed evita sincronização perfeita entre elas.
    */
    const phaseDrift = movementTime * 0.205 * fiber.speed;

    const seam = seamContinuityWeight(u, 0.06);

    /*
      Movimento transversal principal.
    */
    lane +=
      Math.sin(u * TAU * 2.15 + fiber.phase1 + phaseDrift) *
      fiber.migration *
      (1 + turbulence * 1.25) *
      seam;

    /*
      Segunda frequência de movimento.
    */
    lane +=
      Math.sin(u * TAU * 5.0 + fiber.phase2 - phaseDrift * 0.82) *
      fiber.migration *
      (0.48 + turbulence * 0.58);

    /*
      Oscilação associada às famílias de fibras.
    */
    lane +=
      Math.sin(u * TAU * 3.0 + fiber.family * 0.93 + phaseDrift * 0.52) *
      (0.02 + Math.abs(twist) * 0.06) *
      (1 + turbulence * 1.1);

    /*
      Movimento global de fluxo.

      flow controla quanto dessa ondulação aparece.
    */
    lane +=
      Math.sin(
        movementTime * 0.2 * fiber.speed + fiber.family * 0.95 + u * TAU,
      ) *
      0.036 *
      flow;

    /* =====================================================
       START / PAUSE
       -----------------------------------------------------
       Não existe reação geométrica direta aqui.

       START e PAUSE alteram temporariamente a velocidade
       de movementTime em motion.js.

       Isso é deliberado: evita duplicar a reação em duas
       camadas diferentes do sistema.
    ===================================================== */

    /* =====================================================
       LAP
       -----------------------------------------------------
       LAP produz uma onda localizada que percorre a criatura.
    ===================================================== */

    if (lapProgress >= 0) {
      const waveCenter = lapProgress;

      const delta = Math.abs(u - waveCenter);

      /*
        Como a criatura forma um ciclo, calculamos a menor
        distância considerando também a passagem 1 → 0.
      */
      const circularDistance = Math.min(delta, 1 - delta);

      /*
        Envelope gaussiano.

        Quanto mais perto do centro da onda, mais intensa
        será a deformação.
      */
      const envelope = Math.exp(
        -(circularDistance * circularDistance) / 0.0082,
      );

      lane +=
        envelope *
        Math.sin(fiber.phase1 + lapProgress * TAU * 2) *
        0.082 *
        wave;
    }

    /* =====================================================
       RESET
       -----------------------------------------------------
       RESET continua sendo a ação responsável por produzir
       reorganização geométrica direta da criatura.
    ===================================================== */

    lane +=
      Math.sin(u * TAU * 2.0 + fiber.phase2 * 0.3 + resetTime * 0.55) *
      0.145 *
      resetPulse *
      seam;

    lane +=
      Math.sin(u * TAU * 4.0 - fiber.phase1 * 0.2 - resetTime * 0.42) *
      0.055 *
      resetPulse *
      seam;

    /*
      RESET também atrai temporariamente as fibras
      para o centro da faixa.
    */
    lane += (0.5 - lane) * 0.14 * resetPulse;

    /* =====================================================
       LOWER ENVELOPE
       -----------------------------------------------------
       A região inferior recebe uma abertura assimétrica
       adicional.

       Isso ajuda a evitar uma estrutura excessivamente
       uniforme ao redor de toda a volta.
    ===================================================== */

    const lowerEnvelope = angularWindow(u, 0.605, 0.155);

    if (lowerEnvelope > 0) {
      const spread = 1 + 0.17 * lowerEnvelope;

      lane = 0.5 + (lane - 0.5) * spread;

      /*
        Fibras próximas da borda interna recebem deslocamento
        adicional.
      */
      const innerWeight = Math.pow(1 - clamp(lane, 0, 1), 1.65);

      lane -= 0.045 * lowerEnvelope * innerWeight;
    }

    /*
      contraction atualmente fica essencialmente reservada
      ao RESET, já que PAUSE deixou de injetar contração.
    */
    lane += (fiber.lane - lane) * 0.62 * contraction;

    /*
      Nunca permitimos que uma fibra encoste exatamente
      nas extremidades 0 e 1.
    */
    return clamp(lane, 0.012, 0.988);
  }

  /* =======================================================
     LANE AT — CACHED / HOT PATH
     -------------------------------------------------------
     Versão otimizada de laneAt() utilizada durante a geração
     dos caminhos.

     Em vez de recalcular anatomia e diversos fatores em cada
     sample de cada fibra, recebe:

     sample
     → geometria pré-calculada para aquela posição.

     shared
     → valores calculados uma vez por fibra/frame.

     A matemática visual permanece equivalente à versão
     de referência acima.
  ======================================================= */

  laneAtCached(fiber, sample, motion, shared) {
    let lane = fiber.lane;

    /* =====================================================
       NATURAL MOVEMENT
    ===================================================== */

    lane += sample.twist * (0.5 - lane) * 0.88;

    const phaseDrift = shared.phaseDriftBase * fiber.speed;

    lane +=
      Math.sin(sample.uTau * 2.15 + fiber.phase1 + phaseDrift) *
      fiber.migration *
      shared.migrationPrimary *
      sample.seam;

    lane +=
      Math.sin(sample.uTau * 5.0 + fiber.phase2 - phaseDrift * 0.82) *
      fiber.migration *
      shared.migrationSecondary;

    lane +=
      Math.sin(sample.uTau * 3.0 + fiber.family * 0.93 + phaseDrift * 0.52) *
      (0.02 + Math.abs(sample.twist) * 0.06) *
      shared.familyTurbulence;

    lane +=
      Math.sin(
        shared.swimTime * fiber.speed + fiber.family * 0.95 + sample.uTau,
      ) * shared.swimAmplitude;

    /* =====================================================
       LAP
    ===================================================== */

    if (shared.lapActive) {
      const delta = Math.abs(sample.u - shared.lapProgress);

      const circularDistance = Math.min(delta, 1 - delta);

      const envelope = Math.exp(
        -(circularDistance * circularDistance) / 0.0082,
      );

      lane +=
        envelope * shared.lapFiberSine(fiber.phase1) * shared.lapAmplitude;
    }

    /* =====================================================
       RESET
    ===================================================== */

    lane +=
      Math.sin(
        sample.uTau * 2.0 + fiber.phase2 * 0.3 + shared.resetTimePrimary,
      ) *
      shared.resetAmplitudePrimary *
      sample.seam;

    lane +=
      Math.sin(
        sample.uTau * 4.0 - fiber.phase1 * 0.2 - shared.resetTimeSecondary,
      ) *
      shared.resetAmplitudeSecondary *
      sample.seam;

    lane += (0.5 - lane) * shared.resetPull;

    /* =====================================================
       LOWER ENVELOPE
    ===================================================== */

    if (sample.lowerEnvelope > 0) {
      const spread = 1 + 0.17 * sample.lowerEnvelope;

      lane = 0.5 + (lane - 0.5) * spread;

      /*
        Clamp manual nesta região evita o custo de uma
        chamada adicional à função clamp() dentro do
        caminho mais quente da renderização.
      */
      const clampedLane = lane < 0 ? 0 : lane > 1 ? 1 : lane;

      const innerWeight = Math.pow(1 - clampedLane, 1.65);

      lane -= 0.045 * sample.lowerEnvelope * innerWeight;
    }

    lane += (fiber.lane - lane) * shared.contractionFactor;

    /*
      Clamp manual final.

      Como esta função é executada dezenas de milhares
      de vezes, evitar chamadas auxiliares aqui reduz um
      pouco o overhead.
    */
    if (lane < 0.012) {
      return 0.012;
    }

    if (lane > 0.988) {
      return 0.988;
    }

    return lane;
  }

  /* =======================================================
     PATH FOR
     -------------------------------------------------------
     Constrói o caminho 2D completo de uma fibra.

     Retorna um array reutilizável de objetos:

     [
       { x, y },
       { x, y },
       ...
     ]

     Nenhum objeto novo de ponto precisa ser criado durante
     a execução normal.
  ======================================================= */

  pathFor(cx, cy, base, fiber, motion = {}, samples = DEFAULT_SAMPLES) {
    /*
      Geometria compartilhada entre todas as fibras.
    */
    const geometry = this.getGeometryCache(samples);

    /*
      Array de pontos pertencente à própria fibra.
    */
    const points = this.getReusablePath(fiber, samples);

    const time = motion.time ?? 0;

    const movementTime =
      motion.movementTime ?? time * (motion.speed ?? motion.flow ?? 0);

    const flow = motion.flow ?? 0;

    const turbulence = motion.turbulence ?? 0;

    const wave = motion.wave ?? 0;

    const lapProgress = motion.lapProgress ?? -1;

    const contraction = motion.contraction ?? 0;

    const resetPulse = motion.resetPulse ?? 0;

    const resetTime = motion.resetTime ?? 0;

    /* =====================================================
       SHARED FRAME VALUES
       -----------------------------------------------------
       Estes valores não mudam entre samples da mesma fibra
       no mesmo frame.

       Calculá-los aqui evita repetir multiplicações dentro
       do loop principal de 320 pontos.
    ===================================================== */

    const shared = {
      /* ==========================
         CONTINUOUS MOVEMENT
      ========================== */

      phaseDriftBase: movementTime * 0.205,

      migrationPrimary: 1 + turbulence * 1.25,

      migrationSecondary: 0.48 + turbulence * 0.58,

      familyTurbulence: 1 + turbulence * 1.1,

      swimTime: movementTime * 0.2,

      swimAmplitude: 0.036 * flow,

      /* ==========================
         LAP
      ========================== */

      lapActive: lapProgress >= 0,

      lapProgress,

      lapAmplitude: 0.082 * wave,

      lapPhase: lapProgress * TAU * 2,

      /*
        A fase do LAP é compartilhada; somente phase1
        muda entre fibras.
      */
      lapFiberSine(phase1) {
        return Math.sin(phase1 + this.lapPhase);
      },

      contractionFactor: 0.62 * contraction,

      /* ==========================
         RESET
      ========================== */

      resetTimePrimary: resetTime * 0.55,

      resetTimeSecondary: resetTime * 0.42,

      resetAmplitudePrimary: 0.145 * resetPulse,

      resetAmplitudeSecondary: 0.055 * resetPulse,

      resetPull: 0.14 * resetPulse,
    };

    /* =====================================================
       NATURAL TANGENTIAL MOTION
       -----------------------------------------------------
       START e PAUSE não recebem multiplicadores adicionais
       nesta camada.

       A reação dessas ações já aconteceu quando motion.js
       acelerou movementTime.
    ===================================================== */

    const tangentPhase = movementTime * 0.165 * fiber.speed;

    const tangentPrimary = fiber.tangent * (1 + turbulence * 1.15);

    const tangentSecondary = fiber.tangent * 0.32 * (1 + turbulence * 0.9);

    const tangentPhaseSecondary = tangentPhase * 0.76;

    /* =====================================================
       SAMPLE LOOP
       -----------------------------------------------------
       Este é o "hot loop" principal deste módulo.

       Com os valores padrão:

       320 samples × 86 fibras ≈ 27.500 iterações por frame.
    ===================================================== */

    for (let i = 0; i < samples; i += 1) {
      const sample = geometry[i];

      /*
        Calcula a posição transversal da fibra.
      */
      const lane = this.laneAtCached(fiber, sample, motion, shared);

      /* ---------------------------------------------------
         TANGENTIAL MOTION
         ---------------------------------------------------
         Além de mover-se transversalmente, a fibra recebe
         um pequeno deslocamento ao longo da tangente.
      --------------------------------------------------- */

      const tangent =
        (Math.sin(sample.uTau * 2.7 + fiber.phase2 + tangentPhase) *
          tangentPrimary +
          Math.sin(sample.uTau * 7.2 + fiber.phase3 - tangentPhaseSecondary) *
            tangentSecondary) *
        sample.seam;

      /* ---------------------------------------------------
         PINCH
         ---------------------------------------------------
         Regiões anatômicas de pinçamento aproximam a lane
         do centro da faixa.
      --------------------------------------------------- */

      const pinched = 0.5 + (lane - 0.5) * (1 - sample.pinch);

      /*
        Clamp manual dentro do hot loop.
      */
      const clampedPinched = pinched < 0 ? 0 : pinched > 1 ? 1 : pinched;

      /*
        Smoothstep:

        x²(3 - 2x)

        produz interpolação suave entre 0 e 1.
      */
      const smooth = clampedPinched * clampedPinched * (3 - 2 * clampedPinched);

      /*
        Interpolamos entre a borda interna e externa
        de acordo com a posição transversal da fibra.
      */
      const radius =
        (sample.inner + (sample.outer - sample.inner) * smooth) * base;

      const tangentDistance = tangent * base;

      /*
        Reutilizamos o objeto existente.
      */
      const point = points[i];

      /*
        Conversão polar → cartesiana, com pequenas
        assimetrias deliberadas em X e Y.
      */
      point.x =
        cx +
        sample.cosAngle * radius * 1.012 -
        sample.sinAngle * tangentDistance;

      point.y =
        cy +
        sample.sinAngle * radius * 0.988 +
        sample.cosAngle * tangentDistance * 0.86;
    }

    return points;
  }
}

/* =========================================================
   ANGULAR WINDOW
   ---------------------------------------------------------
   Cria uma janela suave ao redor de determinada posição
   circular.

   u
   → posição atual.

   center
   → centro da região.

   halfWidth
   → metade da largura da influência.

   O cálculo considera que 0 e 1 são vizinhos porque a
   anatomia é fechada.
========================================================= */

function angularWindow(u, center, halfWidth) {
  const raw = Math.abs(u - center);

  const distance = Math.min(raw, 1 - raw);

  /*
    Fora da região não existe influência.
  */
  if (distance >= halfWidth) {
    return 0;
  }

  /*
    Normalizamos a distância para 0–1.
  */
  const x = 1 - distance / halfWidth;

  /*
    Smoothstep para evitar bordas abruptas.
  */
  return x * x * (3 - 2 * x);
}

/* =========================================================
   SEEDED RANDOM — MULBERRY32
   ---------------------------------------------------------
   Gerador pseudoaleatório determinístico.

   Ele permite criar fibras diferentes entre si, mas manter
   exatamente o mesmo "DNA" visual em todas as execuções.
========================================================= */

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);

    t = Math.imul(t ^ (t >>> 15), t | 1);

    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}