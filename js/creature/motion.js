"use strict";

/* =========================================================
   SYVRON — CREATURE MOTION
   ---------------------------------------------------------
   Este módulo controla o COMPORTAMENTO temporal da criatura.

   Ele não desenha no canvas e não calcula diretamente
   os caminhos das fibras.

   Em vez disso, produz um objeto chamado `current` contendo
   parâmetros que outros módulos utilizam para construir
   a manifestação visual da criatura.

   Responsabilidades:

   - definir o comportamento-base;
   - controlar o estado RUNNING;
   - produzir reação de START / RESUME;
   - produzir reação de PAUSE;
   - controlar a onda de LAP;
   - controlar a reorganização de RESET;
   - avançar o relógio procedural da criatura;
   - suavizar transições entre estados.

   IMPORTANTE:
   os valores deste arquivo fazem parte do comportamento
   visual aprovado da criatura.

   Pequenas alterações podem mudar significativamente sua
   personalidade, velocidade e resposta às interações.
========================================================= */

/* =========================================================
   BASELINE / READY STATE
   ---------------------------------------------------------
   Parâmetros utilizados como comportamento natural da
   criatura quando ela não está no estado RUNNING.

   Eles também servem como base para outros estados.
========================================================= */

const BASELINE = {
  /*
    Intensidade do deslocamento contínuo das fibras.
  */
  flow: 1.55,

  /*
    Velocidade-base do relógio procedural da criatura.
  */
  speed: 2.35,

  /*
    Intensidade dos efeitos luminosos animados.
  */
  shimmer: 1.1,

  /*
    Intensidade destinada ao comportamento da membrana.
  */
  membrane: 1.2,

  /*
    Quantidade de irregularidade aplicada ao movimento
    natural das fibras.
  */
  turbulence: 1.25,
};

/* =========================================================
   RUNNING STATE
   ---------------------------------------------------------
   RUNNING herda todos os valores de BASELINE e sobrescreve
   apenas aquilo que realmente muda nesse estado.

   A velocidade abaixo corresponde ao comportamento aprovado
   da criatura durante a execução do cronômetro.
========================================================= */

const RUNNING = {
  ...BASELINE,

  /*
    Approved RUNNING speed.

    Preservar este valor mantém o comportamento-base que foi
    aprovado durante os testes visuais do SYVRON.
  */
  speed: 4.0,
};

/* =========================================================
   LOCAL REACTION SETTINGS
   ---------------------------------------------------------
   START e PAUSE não modificam diretamente a geometria.

   Eles aceleram temporariamente o relógio procedural
   `movementTime`.

   Isso permite que as próprias ondas naturais da criatura
   respondam às ações, em vez de aplicar uma deformação
   artificial adicional.
========================================================= */

/* =========================================================
   START / RESUME REACTION
========================================================= */

const START_REACTION = {
  /*
    Duração total da reação em milissegundos.
  */
  duration: 420,

  /*
    Multiplicador adicional temporário da velocidade.

    Produz o burst forte aprovado em START / RESUME.
  */
  speedBoost: 3.0,
};

/* =========================================================
   PAUSE REACTION
========================================================= */

const PAUSE_REACTION = {
  duration: 460,

  /*
    PAUSE utiliza um boost menor.

    Como o sentido do movementTime é invertido posteriormente,
    esse boost se manifesta como um burst na direção oposta.
  */
  speedBoost: 1.5,
};

/* =========================================================
   CREATURE MOTION
========================================================= */

export class CreatureMotion {
  constructor() {
    /* =====================================================
       INITIAL STATE
    ===================================================== */

    this.state = "idle";

    const now = performance.now();

    /*
      A criatura não começa visualmente na fase zero.

      Esse offset posiciona o movimento inicial em uma fase
      previamente escolhida da animação procedural.

      Assim, a primeira renderização já apresenta a composição
      desejada em vez de começar de uma posição arbitrária.
    */
    const initialPhaseOffsetSeconds = 17.4;

    /* =====================================================
       ORIGINAL VISUAL CLOCK
       -----------------------------------------------------
       Mantido como relógio visual contínuo baseado no tempo
       real transcorrido desde a criação da instância.
    ===================================================== */

    this.startedAt = now - initialPhaseOffsetSeconds * 1000;

    /*
      lastNow é usado para calcular o delta entre frames.
    */
    this.lastNow = now;

    /* =====================================================
       STABLE MOVEMENT CLOCK
       -----------------------------------------------------
       Este é o relógio procedural realmente utilizado pelo
       movimento das fibras.

       Diferentemente de simplesmente usar o tempo absoluto,
       ele é acumulado frame a frame.

       Isso permite:

       - mudar velocidade sem saltar de fase;
       - inverter direção no PAUSE;
       - acelerar temporariamente START / RESUME;
       - preservar continuidade entre estados.
    ===================================================== */

    this.movementTime = initialPhaseOffsetSeconds * BASELINE.speed;

    /* =====================================================
       START / RESUME
    ===================================================== */

    /*
      null significa que nenhuma reação está ativa.
    */
    this.startReactionStartedAt = null;

    this.startReactionDuration = START_REACTION.duration;

    /* =====================================================
       PAUSE
    ===================================================== */

    this.pauseReactionStartedAt = null;

    this.pauseReactionDuration = PAUSE_REACTION.duration;

    /* =====================================================
       LAP
    ===================================================== */

    this.lapStartedAt = null;

    /*
      A reação de LAP dura 1.45 segundo.
    */
    this.lapDuration = 1450;

    /* =====================================================
       RESET
    ===================================================== */

    this.resetStartedAt = null;

    this.resetDuration = 820;

    /* =====================================================
       CURRENT STATE
       -----------------------------------------------------
       Representa os valores efetivamente utilizados pelos
       outros módulos neste frame.

       Eles não mudam instantaneamente quando o estado muda.
       update() aproxima current de target gradualmente.
    ===================================================== */

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

      /*
        Manifestações mantidas por compatibilidade com outras
        partes do sistema.

        Alguns efeitos utilizam esses valores mesmo que START
        e PAUSE atualmente não os alimentem diretamente.
      */
      contraction: 0,
      ignition: 0,
      settle: 0,

      /* RESET */
      resetProgress: -1,
      resetPulse: 0,
    };

    /* =====================================================
       TARGET STATE
       -----------------------------------------------------
       Guarda os valores para os quais `current` deve
       transicionar suavemente.
    ===================================================== */

    this.target = {
      ...this.current,
    };
  }

  /* =======================================================
     STATE
     -------------------------------------------------------
     Estados internos aceitos pela criatura:

     "idle"
     → comportamento-base / READY.

     "running"
     → cronômetro em execução.

     "pause"
     → comportamento pausado da criatura.

     Observe que TimerEngine utiliza "paused", enquanto este
     módulo utiliza "pause". O main.js faz essa tradução.
  ======================================================= */

  setState(state, now = performance.now()) {
    /*
      Ignora qualquer estado desconhecido.
    */
    if (!["idle", "running", "pause"].includes(state)) {
      return;
    }

    const previousState = this.state;

    this.state = state;

    /* =====================================================
       RUNNING
    ===================================================== */

    if (state === "running") {
      /*
        Mantemos quaisquer propriedades temporárias existentes
        em target e substituímos apenas os parâmetros definidos
        para RUNNING.
      */
      this.target = {
        ...this.target,
        ...RUNNING,
      };

      /*
        A reação só começa quando realmente entramos no estado.

        Chamadas repetidas para setState("running") não criam
        bursts adicionais.
      */
      if (previousState !== "running") {
        this.beginStartReaction(now);
      }

      return;
    }

    /* =====================================================
       READY / IDLE
    ===================================================== */

    if (state === "idle") {
      /*
        Retornamos gradualmente para os parâmetros baseline.
      */
      this.target = {
        ...this.target,
        ...BASELINE,
      };

      /*
        Reações locais não devem continuar depois de retornar
        ao estado inicial.
      */
      this.clearStartReaction();
      this.clearPauseReaction();

      return;
    }

    /* =====================================================
       PAUSE
    ===================================================== */

    if (state === "pause") {
      /*
        PAUSE retorna os parâmetros gerais para BASELINE.

        A manifestação específica do PAUSE acontece através
        da reação temporária e da inversão de movementTime.
      */
      this.target = {
        ...this.target,
        ...BASELINE,
      };

      if (previousState !== "pause") {
        this.beginPauseReaction(now);
      }
    }
  }

  /* =======================================================
     START / RESUME REACTION
  ======================================================= */

  beginStartReaction(now = performance.now()) {
    /*
      START e PAUSE são mutuamente exclusivos.

      Uma reação nunca deve continuar enquanto a outra começa.
    */
    this.clearPauseReaction();

    this.startReactionStartedAt = now;

    /*
      O pulse começará em zero e será calculado durante
      update().
    */
    this.current.startPulse = 0;
  }

  clearStartReaction() {
    this.startReactionStartedAt = null;

    this.current.startPulse = 0;
  }

  /* =======================================================
     PAUSE REACTION
  ======================================================= */

  beginPauseReaction(now = performance.now()) {
    this.clearStartReaction();

    this.pauseReactionStartedAt = now;

    this.current.pausePulse = 0;
  }

  clearPauseReaction() {
    this.pauseReactionStartedAt = null;

    this.current.pausePulse = 0;
  }

  /* =======================================================
     LAP
     -------------------------------------------------------
     LAP inicia uma onda que percorre toda a anatomia.

     A manifestação geométrica acontece principalmente
     dentro de fibers.js.
  ======================================================= */

  lap(now = performance.now()) {
    /*
      Approved LAP remains untouched.
    */
    this.lapStartedAt = now;

    /*
      0 representa o início da volta da onda.
    */
    this.current.lapProgress = 0;

    /*
      Intensidade inicial da manifestação.
    */
    this.current.wave = 1;
  }

  /* =======================================================
     RESUME
     -------------------------------------------------------
     RESUME é essencialmente uma entrada em RUNNING vinda
     do estado PAUSE.

     Reutilizar setState() evita duplicar a lógica.
  ======================================================= */

  resume(now = performance.now()) {
    /*
      PAUSE → RUNNING:

      - restaura a direção normal;
      - altera target para RUNNING;
      - dispara o burst de START / RESUME.
    */
    this.setState("running", now);
  }

  /* =======================================================
     RESET
     -------------------------------------------------------
     RESET é diferente de simplesmente voltar para IDLE.

     Além de restaurar o estado-base, ele possui sua própria
     manifestação geométrica de reorganização.
  ======================================================= */

  reset(now = performance.now()) {
    /*
      Guardamos essa informação antes de mudar o estado porque
      RESET possui intensidade discretamente diferente quando
      acionado enquanto a criatura estava pausada.
    */
    const wasPaused = this.state === "pause";

    /*
      Voltar para IDLE também restaura a direção normal
      do movimento.
    */
    this.setState("idle", now);

    /*
      Diferentemente da transição suave dos demais parâmetros,
      RESET devolve a velocidade imediatamente ao baseline.
    */
    this.current.speed = BASELINE.speed;

    this.target.speed = BASELINE.speed;

    /*
      Nenhuma reação de START ou PAUSE pode atravessar RESET.
    */
    this.clearStartReaction();
    this.clearPauseReaction();

    /* =====================================================
       RESET MANIFESTATION
    ===================================================== */

    this.resetStartedAt = now;

    this.current.resetProgress = 0;

    this.current.resetPulse = 0;

    /*
      RESET injeta uma pequena contração.

      Quando vindo de PAUSE, o valor é ligeiramente maior.
    */
    this.current.contraction = Math.max(
      this.current.contraction,
      wasPaused ? 0.06 : 0.04,
    );

    /*
      settle funciona como uma manifestação residual de
      acomodação após a reorganização.
    */
    this.current.settle = Math.max(
      this.current.settle,
      wasPaused ? 0.05 : 0.032,
    );
  }

  /* =======================================================
     UPDATE
     -------------------------------------------------------
     Executado uma vez por frame da criatura.

     Este método:

     1. calcula o delta de tempo;
     2. suaviza current em direção a target;
     3. atualiza reações temporárias;
     4. aplica decays;
     5. atualiza os relógios;
     6. define a direção;
     7. avança movementTime.
  ======================================================= */

  update(now) {
    /* =====================================================
       DELTA TIME
       -----------------------------------------------------
       Converte milissegundos para segundos.

       O valor é limitado a 0.05s (50 ms).

       Isso evita um salto enorme na simulação caso um frame
       demore demais.
    ===================================================== */

    const dt = Math.min(Math.max((now - this.lastNow) / 1000, 0), 0.05);

    this.lastNow = now;

    /* =====================================================
       STATE TRANSITION
       -----------------------------------------------------
       Cada estado possui uma velocidade de resposta diferente.

       Isso não é a velocidade da criatura.

       É a velocidade com que parâmetros como flow e speed
       aproximam-se de seus valores-alvo.
    ===================================================== */

    const response =
      this.state === "running" ? 1.0 : this.state === "pause" ? 0.68 : 0.78;

    /*
      Suavização exponencial independente de FPS.

      Quanto maior dt ou response, maior a aproximação em
      direção ao target neste frame.
    */
    const smoothing = 1 - Math.exp(-dt * response);

    /*
      Apenas os parâmetros contínuos passam pela interpolação.

      Pulsos e progressos temporários são atualizados
      separadamente.
    */
    for (const key of ["flow", "speed", "shimmer", "membrane", "turbulence"]) {
      this.current[key] += (this.target[key] - this.current[key]) * smoothing;
    }

    /* =====================================================
       START / RESUME PULSE
    ===================================================== */

    if (this.startReactionStartedAt !== null) {
      const progress =
        (now - this.startReactionStartedAt) / this.startReactionDuration;

      if (progress >= 1) {
        this.clearStartReaction();
      } else {
        /*
          sin(πp) produz uma curva:

          0 → 1 → 0

          durante toda a reação.
        */
        const pulse = Math.sin(Math.PI * progress);

        /*
          O expoente 0.82 altera discretamente a curva para
          preservar o burst aprovado.
        */
        this.current.startPulse = Math.pow(Math.max(0, pulse), 0.82);
      }
    }

    /* =====================================================
       PAUSE PULSE
    ===================================================== */

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

    /* =====================================================
       LAP
       -----------------------------------------------------
       lapProgress percorre:

       0 → 1

       durante toda a duração da reação.

       fibers.js interpreta esse valor como a posição da onda
       ao redor da criatura.
    ===================================================== */

    if (this.lapStartedAt !== null) {
      const progress = (now - this.lapStartedAt) / this.lapDuration;

      if (progress >= 1) {
        this.lapStartedAt = null;

        /*
          -1 significa que nenhuma onda de LAP está ativa.
        */
        this.current.lapProgress = -1;

        this.current.wave = 0;
      } else {
        this.current.lapProgress = progress;

        /*
          Fade-in rápido nos primeiros 8%.
        */
        const fadeIn = Math.min(1, progress / 0.08);

        /*
          Fade-out nos últimos 10%.
        */
        const fadeOut = Math.min(1, (1 - progress) / 0.1);

        /*
          A menor das duas curvas garante entrada e saída
          suaves da manifestação.
        */
        this.current.wave = Math.min(fadeIn, fadeOut);
      }
    }

    /* =====================================================
       RESET
    ===================================================== */

    if (this.resetStartedAt !== null) {
      const progress = (now - this.resetStartedAt) / this.resetDuration;

      if (progress >= 1) {
        this.resetStartedAt = null;

        this.current.resetProgress = -1;

        this.current.resetPulse = 0;
      } else {
        this.current.resetProgress = progress;

        const pulse = Math.sin(Math.PI * progress);

        /*
          Expoente acima de 1 torna a manifestação um pouco
          mais concentrada no centro da reação.
        */
        this.current.resetPulse = Math.pow(Math.max(0, pulse), 1.15);
      }
    }

    /* =====================================================
       EXISTING DECAY
       -----------------------------------------------------
       Alguns parâmetros representam energia temporária.

       Em vez de zerá-los imediatamente, usamos decaimento
       exponencial para fazê-los desaparecer suavemente.
    ===================================================== */

    this.current.ignition *= Math.exp(-dt * 1.85);

    this.current.contraction *= Math.exp(-dt * 1.55);

    this.current.settle *= Math.exp(-dt * 1.45);

    /* =====================================================
       ORIGINAL VISUAL TIME
       -----------------------------------------------------
       Relógio baseado diretamente no tempo real.

       Mantido separado de movementTime porque os dois possuem
       funções diferentes no sistema visual.
    ===================================================== */

    this.current.time = (now - this.startedAt) / 1000;

    /* =====================================================
       REACTION SPEED
       -----------------------------------------------------
       START / RESUME:
       aumenta temporariamente a velocidade para frente.

       PAUSE:
       também aumenta temporariamente a magnitude, mas a
       direção será invertida logo abaixo.
    ===================================================== */

    const reactionSpeed =
      1 +
      this.current.startPulse * START_REACTION.speedBoost +
      this.current.pausePulse * PAUSE_REACTION.speedBoost;

    /* =====================================================
       MOVEMENT DIRECTION
       -----------------------------------------------------
       READY / RUNNING
       → movimento procedural normal.

       PAUSE
       → movimento procedural invertido.

       O sinal atua apenas sobre a progressão futura do
       relógio, sem saltar a fase atual.
    ===================================================== */

    const direction = this.state === "pause" ? -1 : 1;

    /* =====================================================
       STABLE CONTINUOUS MOVEMENT
       -----------------------------------------------------
       Esta é a linha central do sistema de movimento.

       movementTime acumula:

       delta
       × velocidade atual
       × reação temporária
       × direção.

       Como ele é acumulativo, mudanças de estado permanecem
       contínuas e não causam saltos abruptos na geometria.
    ===================================================== */

    this.movementTime += dt * this.current.speed * reactionSpeed * direction;

    /*
      Expõe o relógio aos módulos consumidores.
    */
    this.current.movementTime = this.movementTime;

    /*
      Também expõe o estado atual junto com os demais
      parâmetros visuais.
    */
    this.current.state = this.state;
  }
}