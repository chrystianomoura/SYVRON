"use strict";

/* =========================================================
   SYVRON — TIMER ENGINE
   ---------------------------------------------------------
   Responsabilidade deste módulo:

   - controlar o estado do cronômetro;
   - calcular o tempo decorrido;
   - pausar e retomar a contagem;
   - registrar voltas;
   - identificar a melhor volta;
   - formatar milissegundos para MM:SS.CC.

   Importante:
   este módulo não manipula o DOM.

   Ele representa apenas a lógica do cronômetro. A interface
   visual é atualizada por outros módulos do projeto.
========================================================= */

export class TimerEngine {
  constructor() {
    /*
      Estados possíveis:

      "idle"    → cronômetro ainda não iniciado;
      "running" → cronômetro em execução;
      "paused"  → cronômetro pausado.
    */
    this.state = "idle";

    /*
      Tempo acumulado antes da execução atual.

      Esse valor é especialmente importante após um pause.
      Quando o cronômetro é retomado, continuamos a partir
      desse tempo em vez de começar novamente do zero.
    */
    this.elapsedBeforeRun = 0;

    /*
      Momento em que a execução atual começou.

      performance.now() retorna um relógio de alta precisão
      apropriado para medir intervalos de tempo.

      Quando não existe uma execução ativa, usamos null.
    */
    this.startedAt = null;

    /* Armazena todas as voltas registradas na sessão atual. */
    this.laps = [];
  }

  /* =======================================================
     START
     -------------------------------------------------------
     Inicia o cronômetro.

     O parâmetro "now" pode ser fornecido externamente,
     mas normalmente recebe performance.now().
  ======================================================= */

  start(now = performance.now()) {
    /* Evita iniciar novamente um cronômetro já em execução. */
    if (this.state === "running") return;

    this.startedAt = now;
    this.state = "running";
  }

  /* =======================================================
     PAUSE
     -------------------------------------------------------
     Congela o tempo atual do cronômetro.
  ======================================================= */

  pause(now = performance.now()) {
    /* Pause só faz sentido enquanto o cronômetro está rodando. */
    if (this.state !== "running") return;

    /*
      Calculamos o tempo total até este instante e o guardamos.

      Assim, mesmo depois de remover startedAt, sabemos quanto
      tempo já havia transcorrido antes da pausa.
    */
    this.elapsedBeforeRun = this.getElapsed(now);

    this.startedAt = null;
    this.state = "paused";
  }

  /* =======================================================
     RESUME
     -------------------------------------------------------
     Continua uma execução anteriormente pausada.
  ======================================================= */

  resume(now = performance.now()) {
    /* Só podemos retomar um cronômetro que esteja pausado. */
    if (this.state !== "paused") return;

    /*
      Criamos um novo ponto inicial.

      elapsedBeforeRun continua contendo todo o tempo que
      havia sido acumulado antes da pausa.
    */
    this.startedAt = now;
    this.state = "running";
  }

  /* =======================================================
     RESET
     -------------------------------------------------------
     Retorna completamente o cronômetro ao estado inicial.
  ======================================================= */

  reset() {
    this.state = "idle";
    this.elapsedBeforeRun = 0;
    this.startedAt = null;
    this.laps = [];
  }

  /* =======================================================
     ADD LAP
     -------------------------------------------------------
     Registra uma nova volta.

     Cada volta possui:

     number   → número da volta;
     duration → duração somente daquela volta;
     total    → tempo total do cronômetro naquele momento.
  ======================================================= */

  addLap(now = performance.now()) {
    /* Não permitimos registrar voltas fora da execução. */
    if (this.state !== "running") return null;

    /* Tempo total desde o início da sessão. */
    const total = this.getElapsed(now);

    /*
      Para descobrir quanto durou somente a volta atual,
      precisamos saber em que tempo terminou a volta anterior.

      Na primeira volta não existe valor anterior, então
      consideramos zero.
    */
    const previousTotal = this.laps.length
      ? this.laps[this.laps.length - 1].total
      : 0;

    /*
      Duração da volta:

      tempo total atual - tempo total da volta anterior.

      Math.max() funciona como uma pequena proteção para nunca
      permitir uma duração negativa.
    */
    const duration = Math.max(0, total - previousTotal);

    const lap = {
      number: this.laps.length + 1,
      duration,
      total,
    };

    this.laps.push(lap);

    /*
      Retornamos a volta criada para que outro módulo possa
      atualizar imediatamente a interface.
    */
    return lap;
  }

  /* =======================================================
     GET ELAPSED
     -------------------------------------------------------
     Retorna o tempo total transcorrido em milissegundos.
  ======================================================= */

  getElapsed(now = performance.now()) {
    /*
      Se não estivermos executando, não existe tempo novo
      sendo acumulado.

      Nesse caso basta devolver o valor já armazenado.
    */
    if (this.state !== "running" || this.startedAt === null) {
      return this.elapsedBeforeRun;
    }

    /*
      Durante a execução:

      tempo anteriormente acumulado
      +
      tempo transcorrido desde o último start/resume.
    */
    return this.elapsedBeforeRun + (now - this.startedAt);
  }

  /* =======================================================
     GET BEST LAP
     -------------------------------------------------------
     Procura a volta com menor duração.
  ======================================================= */

  getBestLap() {
    /* Sem voltas registradas não existe uma melhor volta. */
    if (!this.laps.length) return null;

    /*
      reduce() percorre todas as voltas mantendo em "best"
      a volta mais rápida encontrada até aquele momento.
    */
    return this.laps.reduce((best, lap) => {
      return lap.duration < best.duration ? lap : best;
    });
  }
}

/* =========================================================
   TIME FORMATTER
   ---------------------------------------------------------
   Converte milissegundos para:

   MM:SS.CC

   MM → minutos
   SS → segundos
   CC → centésimos de segundo

   Exemplo:
   01:42.37
========================================================= */

export function formatTime(milliseconds) {
  /*
    Evita que algum valor negativo acidental apareça
    visualmente no cronômetro.
  */
  const safe = Math.max(0, milliseconds);

  /*
    1 centésimo = 10 milissegundos.

    Math.floor() descarta a fração restante para que o visor
    não antecipe um centésimo que ainda não foi completado.
  */
  const totalCentiseconds = Math.floor(safe / 10);

  /* Mantém somente os centésimos dentro do intervalo 00–99. */
  const centiseconds = totalCentiseconds % 100;

  /* Converte todos os centésimos acumulados para segundos. */
  const totalSeconds = Math.floor(totalCentiseconds / 100);

  /* Mantém somente os segundos dentro do intervalo 00–59. */
  const seconds = totalSeconds % 60;

  /* Tudo que ultrapassou 60 segundos é convertido em minutos. */
  const minutes = Math.floor(totalSeconds / 60);

  return `${pad(minutes)}:${pad(seconds)}.${pad(centiseconds)}`;
}

/* =========================================================
   PAD
   ---------------------------------------------------------
   Garante pelo menos dois caracteres na exibição numérica.

   5  → "05"
   12 → "12"
========================================================= */

function pad(value) {
  return String(value).padStart(2, "0");
}