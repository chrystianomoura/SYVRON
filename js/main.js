"use strict";

/* =========================================================
   SYVRON — APPLICATION ENTRY POINT
   ---------------------------------------------------------
   Responsabilidade deste módulo:

   - conectar todos os módulos da aplicação;
   - localizar elementos do DOM;
   - criar as instâncias principais;
   - controlar o loop de animação;
   - responder aos botões e atalhos de teclado;
   - sincronizar o estado visual da interface;
   - pausar animações quando a aba não está visível.

   Este arquivo funciona como o "orquestrador" do projeto.

   Ele não desenha diretamente a criatura, não calcula a
   geometria das fibras e não implementa a lógica interna
   do cronômetro.

   Em vez disso, delega essas responsabilidades aos módulos
   especializados e coordena a comunicação entre eles.
========================================================= */

/* =========================================================
   MODULE IMPORTS
========================================================= */

import { CreatureRenderer } from "./creature/renderer.js";
import { CreatureMotion } from "./creature/motion.js";
import { AmbientParticles } from "./ambient-particles.js";
import { TimerEngine, formatTime } from "./timer-engine.js";
import { LapsView } from "./laps-view.js";
import { StatsView } from "./stats-view.js";

/* =========================================================
   DOM REFERENCES
   ---------------------------------------------------------
   Guardamos as referências dos elementos usados com
   frequência para evitar procurar os mesmos elementos
   repetidamente no documento.
========================================================= */

const organismCanvas = document.querySelector("#organism");

const ambientCanvas = document.querySelector("#ambient-particles");

const timerDisplay = document.querySelector("#timer-display");

const timerStatus = document.querySelector("#timer-status");

const primaryButton = document.querySelector("#primary-button");

const primaryLabel = document.querySelector("#primary-label");

const pauseButton = document.querySelector("#pause-button");

const lapButton = document.querySelector("#lap-button");

const resetButton = document.querySelector("#reset-button");

const liveStatus = document.querySelector("#live-status");

/* =========================================================
   APPLICATION INSTANCES
   ---------------------------------------------------------
   Cada classe possui uma responsabilidade específica.

   CreatureRenderer
   → desenha visualmente a criatura no canvas.

   CreatureMotion
   → controla o comportamento e estado de movimento.

   AmbientParticles
   → desenha as partículas de fundo.

   TimerEngine
   → controla tempo, pausa, reset e voltas.

   LapsView
   → renderiza o histórico de voltas.

   StatsView
   → atualiza as estatísticas da sessão.
========================================================= */

const renderer = new CreatureRenderer(organismCanvas);

const motion = new CreatureMotion();

const ambientParticles = new AmbientParticles(ambientCanvas);

const timer = new TimerEngine();

const lapsView = new LapsView({
  list: document.querySelector("#laps-list"),
  empty: document.querySelector("#laps-empty"),
  badge: document.querySelector("#laps-count-badge"),
});

const statsView = new StatsView({
  total: document.querySelector("#stat-total"),
  best: document.querySelector("#stat-best"),
  count: document.querySelector("#stat-count"),
});

/* =========================================================
   RENDER STATE
========================================================= */

/*
  Guarda o último centésimo exibido no cronômetro.

  O requestAnimationFrame pode executar aproximadamente
  60 vezes por segundo, mas o visor só muda a cada 10 ms.

  Portanto, não precisamos atualizar o DOM em todos os frames.
*/
let lastRenderedCentisecond = -1;

/*
  ID retornado pelo requestAnimationFrame.

  Quando é null, significa que não existe loop ativo.
*/
let animationFrameId = null;

/*
  Guardam o instante do último frame renderizado de cada
  camada visual.

  Isso permite limitar cada sistema a uma frequência própria.
*/
let lastCreatureFrame = 0;
let lastAmbientFrame = 0;

/* =========================================================
   FRAME INTERVALS
   ---------------------------------------------------------
   60 FPS → criatura principal.
   30 FPS → partículas de fundo.

   As partículas podem rodar com metade da frequência porque
   possuem movimento visual mais suave e menos importante.

   Isso reduz trabalho de CPU/GPU sem prejudicar a percepção.
========================================================= */

const FRAME_60 = 1000 / 60;
const FRAME_30 = 1000 / 30;

/* =========================================================
   RESIZE VISUALS
   ---------------------------------------------------------
   Recalcula o tamanho dos canvases sempre que a viewport muda.
========================================================= */

function resizeVisuals() {
  /*
    Define a posição normalizada da criatura dentro do canvas.

    x e y são proporcionais:
    0.5 significa exatamente o centro.

    scale controla o tamanho interno da criatura.
  */
  renderer.setLayout({
    x: 0.5,
    y: 0.5,
    scale: 0.9,
  });

  renderer.resize();
  ambientParticles.resize();

  /*
    Zeramos os marcadores de frame para permitir que ambas
    as camadas sejam redesenhadas imediatamente após o resize.
  */
  lastCreatureFrame = 0;
  lastAmbientFrame = 0;
}

/* =========================================================
   MAIN ANIMATION FRAME
   ---------------------------------------------------------
   Um único requestAnimationFrame coordena:

   - partículas;
   - criatura;
   - atualização do cronômetro.

   Cada sistema decide internamente se já passou tempo
   suficiente desde sua última atualização.
========================================================= */

function frame(now) {
  /* -------------------------------------------------------
     AMBIENT PARTICLES — ~30 FPS
  ------------------------------------------------------- */

  if (now - lastAmbientFrame >= FRAME_30) {
    /*
      O sistema de partículas trabalha com segundos,
      enquanto requestAnimationFrame fornece milissegundos.
    */
    ambientParticles.render(now / 1000);

    lastAmbientFrame = now;
  }

  /* -------------------------------------------------------
     CREATURE — ~60 FPS
  ------------------------------------------------------- */

  if (now - lastCreatureFrame >= FRAME_60) {
    /*
      Primeiro atualizamos o estado da criatura.
    */
    motion.update(now);

    /*
      Depois desenhamos o estado calculado.
    */
    renderer.render(motion.current);

    lastCreatureFrame = now;
  }

  /* -------------------------------------------------------
     TIMER DISPLAY
     -------------------------------------------------------
     O cronômetro só precisa atualizar visualmente enquanto
     estiver no estado "running".
  ------------------------------------------------------- */

  if (timer.state === "running") {
    const elapsed = timer.getElapsed(now);

    /*
      O visor trabalha com centésimos.

      Exemplo:
      1234 ms / 10 = 123 centésimos.
    */
    const centisecond = Math.floor(elapsed / 10);

    /*
      Só tocamos no DOM quando o valor realmente mudou.

      Isso evita dezenas de atualizações redundantes por segundo.
    */
    if (centisecond !== lastRenderedCentisecond) {
      lastRenderedCentisecond = centisecond;

      timerDisplay.value = formatTime(elapsed);

      statsView.render(elapsed, timer.laps, timer.getBestLap());
    }
  }

  /*
    Agenda o próximo frame.

    O navegador decide o momento ideal para executar
    novamente a função frame().
  */
  animationFrameId = requestAnimationFrame(frame);
}

/* =========================================================
   ANIMATION LOOP CONTROL
========================================================= */

function startAnimationLoop() {
  /*
    Não criamos outro loop se já existir um ativo.

    Também evitamos iniciar animações enquanto a aba
    estiver oculta.
  */
  if (animationFrameId !== null || document.hidden) {
    return;
  }

  /*
    Força a próxima execução a atualizar as duas camadas
    imediatamente.
  */
  lastCreatureFrame = 0;
  lastAmbientFrame = 0;

  animationFrameId = requestAnimationFrame(frame);
}

function stopAnimationLoop() {
  if (animationFrameId === null) {
    return;
  }

  cancelAnimationFrame(animationFrameId);

  animationFrameId = null;
}

/* =========================================================
   START / RESUME
========================================================= */

function handleStartOrResume() {
  const now = performance.now();

  /*
    O mesmo botão possui duas funções:

    idle   → Start
    paused → Resume
  */
  if (timer.state === "idle") {
    timer.start(now);

    /*
      A criatura recebe o estado equivalente ao cronômetro.
    */
    motion.setState("running");

    announce("Stopwatch started.");
  } else if (timer.state === "paused") {
    timer.resume(now);

    /*
      resume() permite que o movimento continue a partir
      do estado anterior, em vez de reiniciar a criatura.
    */
    motion.resume();

    announce("Stopwatch resumed.");
  }

  syncControls();
}

/* =========================================================
   PAUSE
========================================================= */

function handlePause() {
  if (timer.state !== "running") {
    return;
  }

  timer.pause(performance.now());

  /*
    O sistema de movimento usa "pause" como estado visual.
  */
  motion.setState("pause");

  /*
    Após pausar, atualizamos manualmente o visor porque
    a atualização automática acontece somente enquanto
    timer.state === "running".
  */
  const pausedElapsed = timer.getElapsed();

  timerDisplay.value = formatTime(pausedElapsed);

  statsView.render(pausedElapsed, timer.laps, timer.getBestLap());

  syncControls();

  announce("Stopwatch paused.");
}

/* =========================================================
   LAP
========================================================= */

function handleLap() {
  if (timer.state !== "running") {
    return;
  }

  const lap = timer.addLap(performance.now());

  /*
    addLap() retorna null caso uma volta não possa
    ser registrada.
  */
  if (!lap) {
    return;
  }

  /*
    A criatura possui um feedback visual específico
    quando uma volta é registrada.
  */
  motion.lap();

  renderLapData();

  announce(`Lap ${lap.number} recorded at ${formatTime(lap.duration)}.`);
}

/* =========================================================
   RESET
========================================================= */

function handleReset() {
  /*
    Evita executar um reset desnecessário se a aplicação
    já estiver completamente no estado inicial.
  */
  if (timer.state === "idle" && timer.getElapsed() === 0) {
    return;
  }

  timer.reset();
  motion.reset();

  /*
    Permite que o próximo centésimo seja renderizado
    novamente após um novo Start.
  */
  lastRenderedCentisecond = -1;

  timerDisplay.value = "00:00.00";

  renderLapData();
  syncControls();

  announce("Stopwatch reset.");
}

/* =========================================================
   LAP + STATISTICS RENDERING
   ---------------------------------------------------------
   Centraliza a atualização das duas views que dependem
   das voltas registradas.
========================================================= */

function renderLapData() {
  const bestLap = timer.getBestLap();

  lapsView.render(timer.laps, bestLap);

  statsView.render(timer.getElapsed(), timer.laps, bestLap);
}

/* =========================================================
   UI STATE SYNCHRONIZATION
   ---------------------------------------------------------
   Atualiza botões, textos e status visual para refletir
   exatamente o estado atual do TimerEngine.
========================================================= */

function syncControls() {
  const isIdle = timer.state === "idle";
  const isRunning = timer.state === "running";
  const isPaused = timer.state === "paused";

  /* -------------------------------------------------------
     PRIMARY BUTTON
  ------------------------------------------------------- */

  primaryLabel.textContent = isPaused ? "Resume" : "Start";

  /*
    Durante a execução o botão Start/Resume fica desabilitado.
  */
  primaryButton.disabled = isRunning;

  /* -------------------------------------------------------
     SECONDARY BUTTONS
  ------------------------------------------------------- */

  pauseButton.disabled = !isRunning;
  lapButton.disabled = !isRunning;

  /*
    Reset fica disponível somente quando existe algo
    para realmente limpar.
  */
  resetButton.disabled =
    isIdle && timer.getElapsed() === 0 && timer.laps.length === 0;

  /* -------------------------------------------------------
     TIMER STATUS
  ------------------------------------------------------- */

  timerStatus.textContent = isIdle ? "READY" : isRunning ? "RUNNING" : "PAUSED";

  /*
    data-state é usado pelo CSS para alterar a aparência
    visual do status.
  */
  timerStatus.dataset.state = isIdle
    ? "ready"
    : isRunning
      ? "running"
      : "paused";
}

/* =========================================================
   ACCESSIBILITY ANNOUNCEMENTS
   ---------------------------------------------------------
   Escreve mensagens na região aria-live do HTML.

   Primeiro limpamos o conteúdo e depois escrevemos a
   mensagem no frame seguinte para aumentar a chance de
   leitores de tela perceberem mensagens consecutivas.
========================================================= */

function announce(message) {
  liveStatus.textContent = "";

  requestAnimationFrame(() => {
    liveStatus.textContent = message;
  });
}

/* =========================================================
   BUTTON EVENTS
========================================================= */

primaryButton.addEventListener("click", handleStartOrResume);

pauseButton.addEventListener("click", handlePause);

lapButton.addEventListener("click", handleLap);

resetButton.addEventListener("click", handleReset);

/* =========================================================
   KEYBOARD SHORTCUTS
   ---------------------------------------------------------
   Space → Start / Pause / Resume
   L     → Lap
   R     → Reset
========================================================= */

window.addEventListener("keydown", (event) => {
  /*
    Evita múltiplas ações quando uma tecla fica pressionada.
  */
  if (event.repeat) {
    return;
  }

  /* -------------------------------------------------------
     SPACE
  ------------------------------------------------------- */

  if (event.code === "Space") {
    /*
      Evita o comportamento padrão da barra de espaço,
      como rolar a página.
    */
    event.preventDefault();

    if (timer.state === "running") {
      handlePause();
    } else {
      handleStartOrResume();
    }
  }

  /* -------------------------------------------------------
     L → LAP
  ------------------------------------------------------- */

  if (event.key.toLowerCase() === "l") {
    handleLap();
  }

  /* -------------------------------------------------------
     R → RESET
  ------------------------------------------------------- */

  if (event.key.toLowerCase() === "r") {
    handleReset();
  }
});

/* =========================================================
   PAGE VISIBILITY
   ---------------------------------------------------------
   Quando a aba fica invisível:

   - interrompemos o requestAnimationFrame;
   - evitamos gastar CPU/GPU desnecessariamente.

   Quando a aba volta:

   - sincronizamos o relógio interno da criatura;
   - iniciamos novamente o loop.
========================================================= */

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopAnimationLoop();
    return;
  }

  /*
    Evita que o sistema de movimento interprete todo o tempo
    em que a aba ficou oculta como um único frame enorme.
  */
  motion.lastNow = performance.now();

  startAnimationLoop();
});

/* =========================================================
   WINDOW RESIZE
========================================================= */

window.addEventListener("resize", resizeVisuals);

/* =========================================================
   APPLICATION INITIALIZATION
   ---------------------------------------------------------
   Ordem:

   1. ajustar canvases;
   2. renderizar dados iniciais;
   3. sincronizar controles;
   4. iniciar loop visual.
========================================================= */

resizeVisuals();
renderLapData();
syncControls();

startAnimationLoop();