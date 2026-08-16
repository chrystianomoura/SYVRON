"use strict";

/* =========================================================
   SYVRON — AMBIENT PARTICLES
   ---------------------------------------------------------
   Responsabilidade deste módulo:

   - criar o campo de partículas de fundo;
   - distribuir as partículas de forma determinística;
   - separar partículas estáticas das animadas;
   - armazenar a camada estática em um canvas auxiliar;
   - animar somente uma parte das partículas;
   - adaptar densidade e resolução à viewport.

   A criatura principal NÃO é desenhada aqui.

   Este sistema existe apenas para construir a atmosfera
   visual ao redor da interface.
========================================================= */

export class AmbientParticles {
  constructor(canvas) {
    /* Canvas visível utilizado pelo fundo da aplicação. */
    this.canvas = canvas;

    /*
      Contexto 2D principal.

      alpha: true
      → permite transparência.

      desynchronized: true
      → sinaliza ao navegador que baixa latência visual é
        preferível quando houver suporte.
    */
    this.ctx = canvas.getContext("2d", {
      alpha: true,
      desynchronized: true,
    });

    /* =====================================================
       STATIC OFFSCREEN CANVAS
       -----------------------------------------------------
       A maioria das partículas não precisa ser redesenhada
       matematicamente em todos os frames.

       Criamos então um segundo canvas, invisível, onde essa
       camada é desenhada apenas quando acontece um resize.

       Durante a animação basta copiar essa imagem pronta
       para o canvas principal.
    ===================================================== */

    this.staticCanvas = document.createElement("canvas");

    this.staticCtx = this.staticCanvas.getContext("2d", {
      alpha: true,
      desynchronized: true,
    });

    /* Dimensões CSS atuais da viewport. */
    this.width = 1;
    this.height = 1;

    /*
      Device Pixel Ratio utilizado internamente.

      Ele é limitado posteriormente para evitar canvases
      excessivamente grandes em telas de alta densidade.
    */
    this.dpr = 1;

    /* Partículas pré-renderizadas. */
    this.staticParticles = [];

    /* Partículas recalculadas durante a animação. */
    this.movingParticles = [];

    /*
      Seed fixa do gerador pseudoaleatório.

      Isso faz com que a distribuição não seja completamente
      diferente toda vez que o site é carregado ou redimensionado.
    */
    this.seed = 497123;
  }

  /* =======================================================
     RESIZE
     -------------------------------------------------------
     Sincroniza os canvases com o tamanho atual da viewport.
  ======================================================= */

  resize() {
    /*
      Telas Retina podem possuir DPR 2, 3 ou superior.

      Renderizar todo o fundo nessa resolução seria caro,
      especialmente em celulares.

      O teto de 1.25 oferece nitidez suficiente para partículas
      pequenas sem multiplicar excessivamente o número de pixels.
    */
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.25);

    this.width = window.innerWidth;
    this.height = window.innerHeight;

    /*
      O tamanho interno do canvas trabalha em pixels físicos,
      enquanto width/height representam unidades CSS.
    */
    const pixelWidth = Math.max(1, Math.round(this.width * this.dpr));

    const pixelHeight = Math.max(1, Math.round(this.height * this.dpr));

    /* Canvas principal. */
    this.canvas.width = pixelWidth;
    this.canvas.height = pixelHeight;

    /* Canvas auxiliar da camada estática. */
    this.staticCanvas.width = pixelWidth;
    this.staticCanvas.height = pixelHeight;

    /*
      Após aumentar a resolução interna, ajustamos a matriz
      de transformação.

      Assim podemos continuar desenhando usando coordenadas
      CSS normais, sem multiplicar cada posição manualmente
      pelo DPR.
    */
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.staticCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    /*
      Um resize altera a área disponível.

      Por isso recriamos a população, reconstruímos a camada
      estática e produzimos imediatamente um novo frame.
    */
    this.createParticles();
    this.renderStaticLayer();
    this.render(0);
  }

  /* =======================================================
     PARTICLE GENERATION
  ======================================================= */

  createParticles() {
    /*
      mulberry32() produz uma sequência pseudoaleatória
      baseada na seed fixa da classe.
    */
    const rng = mulberry32(this.seed);

    const area = this.width * this.height;

    /*
      Mobile possui uma área visual muito menor.

      Usar a densidade mínima de desktop em celulares fazia
      centenas de partículas ocuparem uma região pequena,
      deixando o fundo visualmente carregado e aumentando
      trabalho gráfico desnecessário.

      O breakpoint acompanha o utilizado pela interface CSS.
    */
    const isMobile = this.width < 800;

    /*
      DESKTOP / TABLET:
      mantém exatamente a densidade original aprovada.

      MOBILE:
      utiliza uma população menor, preservando o mesmo estilo
      visual sem transformar a tela pequena em um campo muito
      congestionado de partículas.
    */
    const count = isMobile
      ? Math.round(Math.max(280, Math.min(520, area / 2300)))
      : Math.round(Math.max(620, Math.min(1180, area / 1750)));

    /*
      Array.from() cria toda a população.

      Cada partícula armazena valores normalizados de posição
      entre 0 e 1. Isso facilita adaptar o mesmo modelo a
      diferentes dimensões de viewport.
    */
    const particles = Array.from({ length: count }, (_, index) => {
      /*
          Aproximadamente 21% das partículas recebem
          características visuais mais intensas.
        */
      const bright = rng() > 0.79;

      /*
          Pequena variação de tonalidade dentro da família
          violeta utilizada pela identidade do SYVRON.
        */
      const hue = lerp(263, 283, rng());

      const saturation = lerp(72, 100, rng());

      const lightness = bright ? lerp(60, 76, rng()) : lerp(48, 66, rng());

      /*
          Partículas brilhantes recebem maior opacidade.

          As demais permanecem discretas para criar profundidade.
        */
      const alpha = bright ? lerp(0.32, 0.68, rng()) : lerp(0.06, 0.23, rng());

      return {
        /*
            Coordenadas normalizadas.

            O valor real em pixels será calculado posteriormente.
          */
        x: rng(),
        y: rng(),

        /*
            Pequenas diferenças de raio impedem que o campo
            pareça artificialmente uniforme.
          */
        radius: bright ? lerp(0.85, 1.8, rng()) : lerp(0.2, 0.78, rng()),

        alpha,

        /*
            Fase inicial da oscilação.

            Sem isso, todas as partículas animadas se moveriam
            sincronizadas.
          */
        phase: rng() * Math.PI * 2,

        /* Velocidade individual de movimento. */
        speed: lerp(0.08, 0.22, rng()),

        /*
            Distância máxima aproximada da oscilação.
          */
        drift: lerp(3, 14, rng()),

        /*
            Fator de profundidade.

            Também influencia quanto a partícula se desloca.
          */
        depth: lerp(0.55, 1, rng()),

        /*
            Controla qual região de atração será utilizada
            pelo sistema de clusters.
          */
        cluster: rng(),

        hue,
        saturation,
        lightness,

        /*
            As cores estáticas já são calculadas durante
            a criação para não precisarmos reconstruí-las
            constantemente.
          */
        fill: `hsla(${hue},${saturation}%,${lightness}%,${alpha})`,

        shadow: `hsla(${hue},95%,68%,${alpha * 0.55})`,

        index,
      };
    });

    /* =====================================================
       STATIC VS MOVING PARTICLES
       -----------------------------------------------------
       Apenas uma fração das partículas precisa se movimentar.

       Isso cria vida no fundo sem obrigar o navegador a
       recalcular centenas de partículas em cada frame.
    ===================================================== */

    const movingCount = isMobile
      ? Math.max(55, Math.round(count * 0.18))
      : Math.max(110, Math.round(count * 0.22));

    this.movingParticles = particles.slice(0, movingCount);

    this.staticParticles = particles.slice(movingCount);
  }

  /* =======================================================
     STATIC LAYER
     -------------------------------------------------------
     Renderizada apenas durante resize/recriação.
  ======================================================= */

  renderStaticLayer() {
    const ctx = this.staticCtx;

    ctx.clearRect(0, 0, this.width, this.height);

    ctx.save();

    /*
      "screen" soma luminosidade entre os pixels e produz
      o aspecto de pontos luminosos sobre o fundo escuro.
    */
    ctx.globalCompositeOperation = "screen";

    for (const particle of this.staticParticles) {
      const position = this.getClusteredPosition(particle);

      ctx.fillStyle = particle.fill;

      /*
        Aplicamos glow somente às partículas maiores.

        shadowBlur é relativamente caro, então partículas
        pequenas não precisam desse efeito.
      */
      if (particle.radius > 0.95) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = particle.shadow;
      } else {
        ctx.shadowBlur = 0;
      }

      ctx.beginPath();

      ctx.arc(position.x, position.y, particle.radius, 0, Math.PI * 2);

      ctx.fill();
    }

    ctx.restore();
  }

  /* =======================================================
     ANIMATED RENDER
     -------------------------------------------------------
     Executado pelo loop principal da aplicação.

     O main.js limita esta camada aproximadamente a 30 FPS.
  ======================================================= */

  render(time) {
    const ctx = this.ctx;

    /* Limpa somente o canvas visível. */
    ctx.clearRect(0, 0, this.width, this.height);

    /*
      Copia a camada estática pronta.

      Essa operação é muito mais barata do que redesenhar
      individualmente todas as partículas estáticas.
    */
    ctx.drawImage(
      this.staticCanvas,
      0,
      0,
      this.staticCanvas.width,
      this.staticCanvas.height,
      0,
      0,
      this.width,
      this.height,
    );

    ctx.save();

    ctx.globalCompositeOperation = "screen";

    /* Agora processamos somente as partículas móveis. */
    for (const particle of this.movingParticles) {
      const base = this.getClusteredPosition(particle);

      /*
        Converte o tempo global em um tempo individual
        baseado na velocidade da partícula.
      */
      const motion = time * particle.speed;

      /*
        Movimento horizontal senoidal.
      */
      const x =
        base.x +
        Math.sin(motion + particle.phase) * particle.drift * particle.depth;

      /*
        Movimento vertical semelhante, porém com frequência
        e amplitude diferentes.

        Isso evita trajetórias perfeitamente circulares.
      */
      const y =
        base.y +
        Math.cos(motion * 0.83 + particle.phase) *
          particle.drift *
          0.55 *
          particle.depth;

      /*
        Oscilação da opacidade.

        O valor fica aproximadamente entre 0.56 e 1,
        criando um efeito discreto de pulsação.
      */
      const pulse = 0.78 + Math.sin(motion * 2 + particle.phase) * 0.22;

      ctx.fillStyle = `hsla(${particle.hue},${particle.saturation}%,${particle.lightness}%,${particle.alpha * pulse})`;

      if (particle.radius > 0.95) {
        ctx.shadowBlur = 8;
        ctx.shadowColor = particle.shadow;
      } else {
        ctx.shadowBlur = 0;
      }

      ctx.beginPath();

      ctx.arc(x, y, particle.radius, 0, Math.PI * 2);

      ctx.fill();
    }

    ctx.restore();
  }

  /* =======================================================
     CLUSTERED POSITION
     -------------------------------------------------------
     As partículas não são distribuídas de forma totalmente
     uniforme.

     Algumas são suavemente atraídas para três regiões
     diferentes da tela, criando áreas de maior densidade.
  ======================================================= */

  getClusteredPosition(particle) {
    /*
      Seleciona uma das três posições de cluster com base
      no valor aleatório armazenado na partícula.
    */
    const clusterX =
      particle.cluster < 0.38
        ? this.width * 0.5
        : particle.cluster < 0.62
          ? this.width * 0.24
          : this.width * 0.77;

    const clusterY =
      particle.cluster < 0.38
        ? this.height * 0.46
        : particle.cluster < 0.62
          ? this.height * 0.62
          : this.height * 0.31;

    /*
      Nem todas as partículas são atraídas para clusters.

      Isso mantém parte da distribuição espalhada pelo fundo
      e evita pontos artificiais de concentração.
    */
    const clusterPull = particle.cluster < 0.72 ? 0.13 : 0;

    /* Converte coordenadas normalizadas para pixels. */
    const baseX = particle.x * this.width;

    const baseY = particle.y * this.height;

    return {
      /*
        Aproxima parcialmente a posição original do centro
        do cluster escolhido.

        clusterPull = 0
        → nenhuma atração.

        clusterPull = 0.13
        → deslocamento de 13% em direção ao cluster.
      */
      x: baseX + (clusterX - baseX) * clusterPull,

      y: baseY + (clusterY - baseY) * clusterPull,
    };
  }
}

/* =========================================================
   LINEAR INTERPOLATION
   ---------------------------------------------------------
   lerp() retorna um valor situado entre a e b.

   t = 0   → a
   t = 0.5 → metade do caminho
   t = 1   → b

   Usamos isso para gerar variações controladas de tamanho,
   cor, velocidade, profundidade e deslocamento.
========================================================= */

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/* =========================================================
   SEEDED RANDOM — MULBERRY32
   ---------------------------------------------------------
   Math.random() produziria uma distribuição diferente em
   cada execução.

   Mulberry32 é um pequeno gerador pseudoaleatório que recebe
   uma seed.

   Com a mesma seed obtemos sempre a mesma sequência,
   permitindo que a composição visual seja reproduzível.
========================================================= */

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);

    t = Math.imul(t ^ (t >>> 15), t | 1);

    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}