"use strict";

import { formatTime } from "./timer-engine.js";

/* =========================================================
   SYVRON — LAPS VIEW
   ---------------------------------------------------------
   Responsabilidade deste módulo:

   - atualizar o contador de voltas;
   - mostrar ou esconder o estado vazio;
   - renderizar o histórico de voltas;
   - destacar visualmente a melhor volta.

   Este módulo não calcula tempos e não decide qual volta
   é a melhor.

   Ele recebe os dados já processados e apenas os representa
   visualmente no DOM.
========================================================= */

export class LapsView {
  /* =======================================================
     CONSTRUCTOR
     -------------------------------------------------------
     Recebe os elementos do DOM utilizados pelo histórico.

     list  → lista <ol> onde as voltas serão inseridas;
     empty → mensagem exibida quando não existem voltas;
     badge → contador visual de voltas.
  ======================================================= */

  constructor({ list, empty, badge }) {
    this.list = list;
    this.empty = empty;
    this.badge = badge;
  }

  /* =======================================================
     RENDER
     -------------------------------------------------------
     Recebe:

     laps
     → array com todas as voltas registradas.

     bestLap
     → objeto correspondente à melhor volta ou null.
  ======================================================= */

  render(laps, bestLap) {
    /* -----------------------------------------------------
       LAP COUNTER
       -----------------------------------------------------
       O número exibido no badge é simplesmente a quantidade
       atual de elementos do array de voltas.
    ----------------------------------------------------- */

    this.badge.textContent = String(laps.length);

    /* -----------------------------------------------------
       EMPTY STATE
       -----------------------------------------------------
       Quando existe pelo menos uma volta, escondemos a
       mensagem "No laps yet".

       A propriedade hidden corresponde ao atributo HTML
       hidden.
    ----------------------------------------------------- */

    this.empty.hidden = laps.length > 0;

    /* -----------------------------------------------------
       CLEAR PREVIOUS CONTENT
       -----------------------------------------------------
       Antes de desenhar novamente o histórico, removemos
       todos os elementos anteriores da lista.

       replaceChildren() é uma forma simples e moderna de
       esvaziar um elemento.
    ----------------------------------------------------- */

    this.list.replaceChildren();

    /* -----------------------------------------------------
       DISPLAY ORDER
       -----------------------------------------------------
       Queremos mostrar primeiro a volta mais recente.

       Entretanto, não devemos usar:

       laps.reverse()

       diretamente, porque reverse() altera o próprio array
       original.

       O spread operator cria uma cópia rasa:

       [...laps]

       Assim podemos inverter somente a cópia e preservar a
       ordem original mantida pelo TimerEngine.
    ----------------------------------------------------- */

    [...laps].reverse().forEach((lap) => {
      /* -------------------------------------------------
           LAP ITEM
        ------------------------------------------------- */

      const item = document.createElement("li");

      /*
          Optional chaining (?.) permite acessar bestLap.number
          apenas se bestLap realmente existir.

          Se bestLap for null ou undefined, a expressão retorna
          undefined em vez de causar erro.
        */
      const isBest = bestLap?.number === lap.number;

      /*
          Template literal adiciona a classe "is-best"
          somente quando a volta atual for a melhor.

          Resultado normal:
          "lap-item"

          Melhor volta:
          "lap-item is-best"
        */
      item.className = `lap-item${isBest ? " is-best" : ""}`;

      /* -------------------------------------------------
           LAP NUMBER
        ------------------------------------------------- */

      const number = document.createElement("span");

      number.className = "lap-item__number";

      /*
          padStart() garante dois caracteres:

          1  → "01"
          8  → "08"
          12 → "12"
        */
      number.textContent = String(lap.number).padStart(2, "0");

      /* -------------------------------------------------
           LAP DURATION
        ------------------------------------------------- */

      const time = document.createElement("span");

      time.className = "lap-item__time";

      /*
          A volta guarda sua duração em milissegundos.

          formatTime() converte esse valor para o formato
          MM:SS.CC usado pelo restante da interface.
        */
      time.textContent = formatTime(lap.duration);

      /* -------------------------------------------------
           BUILD ITEM
           -------------------------------------------------
           append() permite inserir múltiplos nós de uma vez.
        ------------------------------------------------- */

      item.append(number, time);

      /* Adiciona a volta concluída ao histórico. */
      this.list.append(item);
    });
  }
}