"use strict";

import { formatTime } from "./timer-engine.js";

/* =========================================================
   SYVRON — STATISTICS VIEW
   ---------------------------------------------------------
   Responsabilidade deste módulo:

   - exibir o tempo total da sessão;
   - exibir a melhor volta;
   - exibir a quantidade de voltas registradas.

   Este módulo não calcula tempos e não controla o cronômetro.

   Ele apenas recebe os dados já processados e atualiza
   os elementos correspondentes da interface.
========================================================= */

export class StatsView {
  /* =======================================================
     CONSTRUCTOR
     -------------------------------------------------------
     Recebe os elementos do DOM responsáveis pelas
     estatísticas.

     O parâmetro utiliza destructuring de objeto para extrair:

     total → elemento que mostra o tempo total;
     best  → elemento que mostra a melhor volta;
     count → elemento que mostra o número de voltas.
  ======================================================= */

  constructor({ total, best, count }) {
    this.total = total;
    this.best = best;
    this.count = count;
  }

  /* =======================================================
     RENDER
     -------------------------------------------------------
     Atualiza todas as estatísticas exibidas na interface.

     elapsed → tempo total transcorrido em milissegundos;
     laps    → array contendo as voltas registradas;
     bestLap → objeto da melhor volta ou null.
  ======================================================= */

  render(elapsed, laps, bestLap) {
    /*
      O TimerEngine trabalha internamente com milissegundos.

      formatTime() transforma esse valor no formato visual
      utilizado pelo SYVRON: MM:SS.CC.
    */
    this.total.textContent = formatTime(elapsed);

    /*
      Se existir uma melhor volta, mostramos sua duração.

      Caso nenhuma volta tenha sido registrada ainda,
      exibimos um travessão.

      Aqui usamos o operador ternário:

      condição ? valorSeVerdadeiro : valorSeFalso
    */
    this.best.textContent = bestLap ? formatTime(bestLap.duration) : "—";

    /*
      A quantidade de elementos do array representa
      diretamente o número de voltas registradas.

      textContent recebe texto, então fazemos a conversão
      explícita do número utilizando String().
    */
    this.count.textContent = String(laps.length);
  }
}