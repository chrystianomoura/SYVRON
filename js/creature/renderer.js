"use strict";

import { ANATOMY } from "./anatomy.js";

import { boundaryPath, pointBetween } from "./geometry.js";

import { FiberField } from "./fibers.js";

import { drawAtmosphere, drawDust, drawHighlights } from "./effects.js";

/* =========================================================
   SYVRON — CREATURE RENDERER
   ---------------------------------------------------------
   Este módulo é responsável por transformar todo o estado
   matemático da criatura em pixels no <canvas>.

   Ele funciona como o compositor visual do organismo.

   Responsabilidades:

   - dimensionar o canvas;
   - determinar posição e escala da criatura;
   - construir as bordas anatômicas;
   - desenhar o corpo;
   - desenhar membranas internas;
   - desenhar as fibras;
   - aplicar atmosfera, highlights e poeira;
   - renderizar manifestações de LAP / RESET;
   - converter caminhos paramétricos em curvas suaves.

   IMPORTANTE:

   CreatureRenderer NÃO decide como a criatura deve se
   comportar ao longo do tempo.

   Essa responsabilidade pertence ao CreatureMotion.

   O renderer apenas recebe o estado atual de movimento
   e o transforma em representação visual.
========================================================= */

export class CreatureRenderer {
  constructor(canvas) {
    /* =====================================================
       CANVAS
    ===================================================== */

    this.canvas = canvas;

    /*
      Contexto 2D utilizado para toda a renderização
      da criatura.
    */
    this.ctx = canvas.getContext("2d");

    /*
      Dimensões CSS atuais do canvas.

      Começam com 1 para evitar valores inválidos antes
      do primeiro resize().
    */
    this.width = 1;
    this.height = 1;

    /*
      Device Pixel Ratio utilizado pelo canvas.
    */
    this.dpr = 1;

    /* =====================================================
       FIBER FIELD
       -----------------------------------------------------
       FiberField contém as fibras internas da criatura
       e toda a matemática necessária para produzir seus
       caminhos.
    ===================================================== */

    this.field = new FiberField();

    /* =====================================================
       LAYOUT
       -----------------------------------------------------
       x / y
       → posição normalizada dentro do canvas.

       0.5 / 0.5
       → exatamente no centro.

       scale
       → multiplicador geral do tamanho da criatura.
    ===================================================== */

    this.layout = {
      x: 0.5,
      y: 0.5,
      scale: 1,
    };
  }

  /* =======================================================
     SET LAYOUT
     -------------------------------------------------------
     Permite alterar apenas parte da configuração atual.

     O spread preserva propriedades que não foram fornecidas.
  ======================================================= */

  setLayout(layout = {}) {
    this.layout = {
      ...this.layout,
      ...layout,
    };
  }

  /* =======================================================
     RESIZE
     -------------------------------------------------------
     Sincroniza a resolução interna do canvas com o tamanho
     visual definido pelo CSS.
  ======================================================= */

  resize() {
    /*
      getBoundingClientRect() retorna o tamanho real que o
      elemento ocupa na página após o CSS ser aplicado.
    */
    const rect = this.canvas.getBoundingClientRect();

    /*
      Limitamos o DPR a 2.

      Em telas Retina com DPR 3 ou mais, desenhar o canvas
      na resolução completa aumentaria bastante o número
      de pixels processados sem benefício visual proporcional.
    */
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.width = Math.max(1, rect.width);

    this.height = Math.max(1, rect.height);

    /*
      width / height do elemento canvas representam sua
      resolução interna em pixels físicos.
    */
    this.canvas.width = Math.round(this.width * this.dpr);

    this.canvas.height = Math.round(this.height * this.dpr);

    /*
      A transformação permite continuar desenhando usando
      coordenadas CSS normais.

      O navegador converte automaticamente para a resolução
      física correspondente ao DPR.
    */
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  /* =======================================================
     RENDER
     -------------------------------------------------------
     Monta um frame completo da criatura.

     motion contém o estado produzido por CreatureMotion.
  ======================================================= */

  render(motion = {}) {
    const ctx = this.ctx;

    /* =====================================================
       CREATURE DIMENSIONS
    ===================================================== */

    /*
      A menor dimensão do canvas define a referência
      principal de tamanho.

      Isso mantém a criatura proporcional mesmo quando
      largura e altura disponíveis são diferentes.
    */
    const size = Math.min(this.width, this.height) * 0.94 * this.layout.scale;

    /*
      Centro real da criatura dentro do canvas.
    */
    const cx = this.width * this.layout.x;

    const cy = this.height * this.layout.y;

    /*
      Escala-base utilizada pela anatomia paramétrica.
    */
    const base = size * 0.39;

    /* =====================================================
       CLEAR FRAME
    ===================================================== */

    ctx.clearRect(0, 0, this.width, this.height);

    /* =====================================================
       STATIC ANATOMICAL BOUNDARIES
       -----------------------------------------------------
       Estas são as fronteiras V5 aprovadas.

       Elas vêm diretamente da geometria definida por:

       anatomy.js
       +
       geometry.js

       O movimento das fibras acontece dentro dessa estrutura;
       os limites anatômicos permanecem como referência.
    ===================================================== */

    const outer = boundaryPath(cx, cy, base, "outer");

    const inner = boundaryPath(cx, cy, base, "inner");

    /* =====================================================
       RENDER ORDER
       -----------------------------------------------------
       A ordem importa porque Canvas é imediatamente
       composicional: aquilo que é desenhado depois pode
       aparecer sobre o que veio antes.
    ===================================================== */

    /* Glow difuso externo. */
    drawAtmosphere(ctx, cx, cy, size, outer, strokeClosed);

    /* Massa visual principal do organismo. */
    this.drawBody(ctx, cx, cy, size, base, outer, inner);

    /* Membranas internas largas e discretas. */
    this.drawSheets(ctx, cx, cy, size, base, motion);

    /* Rede principal de fibras. */
    this.drawFibers(ctx, cx, cy, size, base, motion);

    /*
      A antiga camada artificial de costuras transversais
      permanece deliberadamente desativada.

      drawTwistBridges() continua disponível abaixo como
      implementação histórica/experimental, mas não participa
      da composição visual aprovada.
    */

    /* Pontos de energia distribuídos pela anatomia. */
    drawHighlights(ctx, cx, cy, size, base, motion);

    /* Reações específicas de LAP / RESET etc. */
    this.drawBiologicalReaction(ctx, cx, cy, size, base, motion);

    /* Matéria e poeira ao redor da criatura. */
    drawDust(ctx, cx, cy, size, base);
  }

  /* =======================================================
     BIOLOGICAL REACTION
     -------------------------------------------------------
     Renderiza manifestações temporárias produzidas pelas
     ações do cronômetro.

     Atualmente são consideradas:

     wave / lapProgress
     → reação de LAP.

     ignition
     → manifestação luminosa residual compatível.

     contraction
     → manifestação de reorganização / RESET.
  ======================================================= */

  drawBiologicalReaction(ctx, cx, cy, size, base, motion) {
    const wave = motion.wave ?? 0;

    const lapProgress = motion.lapProgress ?? -1;

    const ignition = motion.ignition ?? 0;

    const contraction = motion.contraction ?? 0;

    const time = motion.time ?? 0;

    /*
      `time` permanece disponível para manifestações
      biológicas temporais presentes ou futuras.
    */
    void time;

    /* =====================================================
       LAP WAVE
       -----------------------------------------------------
       Uma concentração luminosa acompanha o progresso
       da onda de LAP ao redor da criatura.
    ===================================================== */

    if (wave > 0.01 && lapProgress >= 0) {
      const center = lapProgress;

      ctx.save();

      ctx.globalCompositeOperation = "screen";

      /*
        42 pequenos pontos formam uma faixa luminosa ao redor
        da posição atual da onda.
      */
      for (let i = 0; i < 42; i += 1) {
        /*
          Os pontos são distribuídos antes e depois
          do centro atual da onda.

          O módulo 1 mantém u dentro da volta fechada.
        */
        const u = (center + (i - 21) * 0.004 + 1) % 1;

        const p = pointBetween(cx, cy, base, u, 0.5);

        /*
          O centro da faixa recebe maior intensidade.

          As extremidades desaparecem gradualmente.
        */
        const alpha = wave * (1 - Math.abs(i - 21) / 21) * 0.22;

        ctx.fillStyle = `rgba(216,165,255,${Math.max(0, alpha)})`;

        ctx.beginPath();

        ctx.arc(p.x, p.y, size * 0.0105, 0, Math.PI * 2);

        ctx.fill();
      }

      ctx.restore();
    }

    /* =====================================================
       IGNITION
       -----------------------------------------------------
       Glow temporário sobre a borda externa.

       Atualmente ignition tende a permanecer em zero,
       mas esta manifestação continua disponível por
       compatibilidade com o sistema de movimento.
    ===================================================== */

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

    /* =====================================================
       CONTRACTION
       -----------------------------------------------------
       Uma linha luminosa discreta aparece sobre a borda
       interna durante reorganizações como RESET.
    ===================================================== */

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

  /* =======================================================
     BODY
     -------------------------------------------------------
     Preenche o espaço existente entre as bordas externa
     e interna.

     O resultado funciona como a massa translúcida sobre
     a qual fibras e membranas são desenhadas.
  ======================================================= */

  drawBody(ctx, cx, cy, size, base, outer, inner) {
    ctx.save();

    /* =====================================================
       BODY GRADIENT
       -----------------------------------------------------
       Um gradiente radial deslocado levemente do centro
       produz iluminação desigual e reforça volume.
    ===================================================== */

    const gradient = ctx.createRadialGradient(
      cx - size * 0.08,
      cy - size * 0.12,
      base * 0.48,

      cx,
      cy,
      base * 1.5,
    );

    gradient.addColorStop(0, "rgba(71,39,156,0)");

    gradient.addColorStop(0.38, "rgba(75,41,159,.24)");

    gradient.addColorStop(0.72, "rgba(55,12,112,.32)");

    gradient.addColorStop(1, "rgba(75,42,159,.10)");

    ctx.fillStyle = gradient;

    ctx.beginPath();

    /*
      Primeiro traçamos a borda externa.
    */
    traceClosed(ctx, outer);

    /*
      A borda interna é percorrida no sentido contrário.

      Com fill("evenodd"), ela funciona como um recorte,
      deixando o centro da criatura vazio.
    */
    traceClosed(ctx, [...inner].reverse());

    ctx.fill("evenodd");

    ctx.restore();
  }

  /* =======================================================
     SHEETS
     -------------------------------------------------------
     Cria sete estruturas largas e translúcidas dentro
     do organismo.

     Elas funcionam como membranas ou camadas internas,
     complementando as fibras finas.
  ======================================================= */

  drawSheets(ctx, cx, cy, size, base, motion) {
    /*
      Posições transversais fixas das membranas.
    */
    const lanes = [0.08, 0.2, 0.34, 0.5, 0.67, 0.82, 0.94];

    const membrane = motion.membrane ?? 0;

    const time = motion.time ?? 0;

    lanes.forEach((lane, index) => {
      /*
          Pequeno deslocamento transversal dependente
          do tempo.

          Cada membrana possui fase própria baseada
          no índice.
        */
      const microDrift =
        Math.sin(time * 0.42 + index * 1.27) * 0.038 * membrane;

      /* =================================================
           SYNTHETIC FIBER
           -------------------------------------------------
           As membranas reutilizam o mesmo algoritmo
           matemático das fibras.

           Em vez de criar uma implementação separada,
           construímos uma "fibra sintética" com parâmetros
           específicos para cada sheet.
        ================================================= */

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

      /*
          FiberField gera o caminho completo da membrana.
        */
      const path = this.field.pathFor(cx, cy, base, synthetic, motion);

      ctx.save();

      ctx.globalCompositeOperation = "screen";

      /*
          Um pequeno blur transforma linhas largas em
          superfícies mais difusas.
        */
      ctx.filter = `blur(${Math.max(1.5, size * 0.0045)}px)`;

      /*
          Membranas alternadas possuem espessuras diferentes.
        */
      ctx.lineWidth = size * (0.018 + (index % 2) * 0.007);

      /*
          A cor também alterna discretamente.
        */
      ctx.strokeStyle =
        index % 2 ? "rgba(122,76,246,.060)" : "rgba(177,128,255,.050)";

      strokeClosed(ctx, path);

      ctx.restore();
    });
  }

  /* =======================================================
     FIBERS
     -------------------------------------------------------
     Desenha a rede principal de fibras do organismo.

     Cada fibra possui:

     - posição transversal;
     - espessura;
     - opacidade;
     - brilho;
     - velocidade;
     - fases procedurais próprias.
  ======================================================= */

  drawFibers(ctx, cx, cy, size, base, motion) {
    this.field.fibers.forEach((fiber, index) => {
      /*
          Calcula o caminho animado da fibra.
        */
      const path = this.field.pathFor(cx, cy, base, fiber, motion);

      ctx.save();

      ctx.globalCompositeOperation = "screen";

      /*
          Cap e join arredondados evitam segmentos visualmente
          rígidos ao longo das curvas.
        */
      ctx.lineCap = "round";

      ctx.lineJoin = "round";

      /*
          Cada fibra possui uma largura própria.

          Math.max() garante visibilidade mínima mesmo em
          canvases menores.
        */
      ctx.lineWidth = Math.max(0.45, size * 0.00094 * fiber.width);

      /* =================================================
           FIBER GRADIENT
           -------------------------------------------------
           Um gradiente diagonal percorre a criatura.

           Isso impede que cada fibra tenha exatamente
           a mesma luminosidade em toda sua extensão.
        ================================================= */

      const gradient = ctx.createLinearGradient(
        cx - size * 0.48,

        cy - size * 0.45,

        cx + size * 0.49,

        cy + size * 0.46,
      );

      const a = fiber.alpha;

      /* =================================================
           COLD PALETTE LOCK
           -------------------------------------------------
           Identidade cromática aprovada:

           deep violet
           → electric violet
           → cold lilac
           → indigo-violet.

           Evitamos:

           - branco quente;
           - bege;
           - cinzas amarelados;
           - cores próximas do amarelo.
        ================================================= */

      if (fiber.brightness > 0.72) {
        /*
            Fibras mais luminosas recebem gradiente
            com highlights frios mais intensos.
          */
        gradient.addColorStop(0.0, `rgba(93,56,226,${a * 0.6})`);

        gradient.addColorStop(0.22, `rgba(154,91,255,${a * 0.9})`);

        gradient.addColorStop(0.46, `rgba(210,177,255,${a})`);

        gradient.addColorStop(0.68, `rgba(126,79,245,${a * 0.76})`);

        gradient.addColorStop(0.86, `rgba(104,71,224,${a * 0.66})`);

        gradient.addColorStop(1.0, `rgba(72,48,184,${a * 0.48})`);
      } else {
        /*
            Fibras comuns permanecem mais profundas
            e discretas.
          */
        gradient.addColorStop(0.0, `rgba(64,40,164,${a * 0.48})`);

        gradient.addColorStop(0.24, `rgba(112,64,224,${a * 0.74})`);

        gradient.addColorStop(0.5, `rgba(165,108,255,${a * 0.82})`);

        gradient.addColorStop(0.72, `rgba(105,68,218,${a * 0.64})`);

        gradient.addColorStop(1.0, `rgba(58,38,150,${a * 0.42})`);
      }

      ctx.strokeStyle = gradient;

      /* =================================================
           OCCASIONAL GLOW
           -------------------------------------------------
           Apenas algumas fibras recebem shadowBlur.

           Isso evita aplicar um efeito relativamente caro
           a todas as 86 fibras.
        ================================================= */

      if (index % 19 === 0) {
        ctx.shadowBlur = size * 0.008;

        ctx.shadowColor = "rgba(180,105,255,.44)";
      }

      strokeClosed(ctx, path);

      ctx.restore();
    });
  }

  /* =======================================================
     TWIST BRIDGES — CURRENTLY DISABLED
     -------------------------------------------------------
     Esta função representa uma antiga camada experimental
     de filamentos transversais nas zonas de torção.

     Ela NÃO é chamada pelo render() atual.

     Foi mantida no código como implementação disponível,
     mas a composição aprovada da criatura utiliza somente
     as fibras longitudinais e membranas.
  ======================================================= */

  drawTwistBridges(ctx, cx, cy, size, base, motion) {
    const time = motion.time ?? 0;

    const flow = motion.flow ?? 0;

    /*
      Cada twistZone vem do DNA definido em anatomy.js.
    */
    for (const [zoneIndex, zone] of ANATOMY.twistZones.entries()) {
      const strands = 9;

      for (let i = 0; i < strands; i += 1) {
        /*
          Posição transversal normalizada do strand.
        */
        const t = i / (strands - 1);

        /*
          Pequena oscilação da região de conexão.
        */
        const localPulse =
          Math.sin(time * 0.4 + zoneIndex * 0.83 + t * 1.7) * 0.042 * flow;

        /*
          Pontos inicial e final ao redor da zona de torção.
        */
        const u0 = wrap(zone.at - zone.width * 0.75 + localPulse);

        const u1 = wrap(zone.at + zone.width * 0.75 + localPulse);

        /*
          Zonas com amount negativo cruzam as lanes
          no sentido oposto.
        */
        const reverse = zone.amount < 0;

        const lane0 = reverse ? t : 1 - t;

        const lane1 = reverse ? 1 - t : t;

        const p0 = pointBetween(cx, cy, base, u0, lane0);

        /*
          Ponto de controle central utilizado pela
          quadraticCurveTo().
        */
        const pm = pointBetween(
          cx,
          cy,
          base,
          wrap(zone.at + localPulse),

          0.5 + Math.sin(t * Math.PI) * (reverse ? -0.15 : 0.15),

          (t - 0.5) * 0.024,
        );

        const p1 = pointBetween(cx, cy, base, u1, lane1);

        ctx.save();

        ctx.globalCompositeOperation = "screen";

        ctx.lineWidth = Math.max(0.45, size * 0.00092);

        /*
          Zonas alternadas recebem cores discretamente
          diferentes.
        */
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

/* =========================================================
   STROKE CLOSED
   ---------------------------------------------------------
   Atalho para:

   1. iniciar um path;
   2. traçar a curva fechada;
   3. aplicar stroke.
========================================================= */

function strokeClosed(ctx, points) {
  ctx.beginPath();

  traceClosed(ctx, points);

  ctx.stroke();
}

/* =========================================================
   TRACE CLOSED
   ---------------------------------------------------------
   Converte um conjunto periódico de pontos em uma curva
   fechada e suave.

   A técnica utilizada é:

   Catmull-Rom periódico
   →
   conversão para curvas Bézier cúbicas.

   O caráter periódico é importantíssimo porque a criatura
   forma um ciclo fechado.

   p0 / p1 / p2 / p3 atravessam o início e o fim do array
   usando módulo (%), mantendo a tangente contínua exatamente
   na emenda.

   Sem isso poderia surgir o antigo efeito de "zipper"
   próximo das 12 horas.
========================================================= */

function traceClosed(ctx, points) {
  /*
    Precisamos de pontos suficientes para calcular
    corretamente a interpolação.
  */
  if (points.length < 4) {
    return;
  }

  const n = points.length;

  ctx.moveTo(points[0].x, points[0].y);

  /*
    Em cada segmento utilizamos quatro pontos:

    p0 → ponto anterior.
    p1 → início do segmento.
    p2 → fim do segmento.
    p3 → ponto seguinte.

    Os índices utilizam módulo para fazer o array se comportar
    como estrutura circular.
  */
  for (let i = 0; i < n; i += 1) {
    const p0 = points[(i - 1 + n) % n];

    const p1 = points[i];

    const p2 = points[(i + 1) % n];

    const p3 = points[(i + 2) % n];

    /* =====================================================
       CATMULL-ROM → CUBIC BÉZIER
       -----------------------------------------------------
       Os pontos de controle são calculados a partir das
       tangentes implícitas da curva Catmull-Rom.

       O divisor 6 é o fator padrão dessa conversão para
       Catmull-Rom uniforme.
    ===================================================== */

    const c1x = p1.x + (p2.x - p0.x) / 6;

    const c1y = p1.y + (p2.y - p0.y) / 6;

    const c2x = p2.x - (p3.x - p1.x) / 6;

    const c2y = p2.y - (p3.y - p1.y) / 6;

    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, p2.x, p2.y);
  }

  ctx.closePath();
}

/* =========================================================
   WRAP
   ---------------------------------------------------------
   Mantém um número dentro do intervalo circular [0, 1).

   Exemplos:

   1.1  → 0.1
   -0.1 → 0.9
========================================================= */

function wrap(value) {
  return ((value % 1) + 1) % 1;
}