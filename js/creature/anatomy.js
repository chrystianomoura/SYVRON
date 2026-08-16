"use strict";

/* =========================================================
   SYVRON — CREATURE ANATOMY
   ---------------------------------------------------------
   Este módulo contém os parâmetros estruturais da criatura.

   Ele NÃO desenha diretamente no canvas.

   Em vez disso, descreve a anatomia que outros módulos usam
   para construir a geometria visual da criatura.

   IMPORTANTE:
   estes valores foram ajustados visualmente para produzir
   uma forma deliberadamente orgânica e assimétrica.

   Por isso, este arquivo deve ser tratado como uma espécie
   de "DNA visual" da criatura.

   Pequenas mudanças aqui podem alterar bastante:

   - silhueta;
   - espessura;
   - torções;
   - estreitamentos;
   - distribuição de massa;
   - pontos de brilho.

   As bordas externa e interna são independentes. Isso evita
   que a criatura pareça apenas um anel geométrico perfeito.
========================================================= */

export const ANATOMY = {
  /* =======================================================
     BASE RADII
     -------------------------------------------------------
     Valores-base utilizados como referência para os limites
     externo e interno da estrutura.

     outerBase
     → raio-base da borda externa.

     innerBase
     → raio-base da borda interna.

     A diferença entre os dois contribui para a espessura
     geral da criatura antes das deformações locais.
  ======================================================= */

  outerBase: 1.13,
  innerBase: 0.79,

  /* =======================================================
     OUTER MASSES
     -------------------------------------------------------
     Alteram localmente a borda EXTERNA.

     Cada objeto possui:

     at
     → posição normalizada ao longo da anatomia.
       Geralmente varia entre 0 e 1.

     width
     → largura da região influenciada.

     amount
     → intensidade da deformação.

       positivo → expande a região;
       negativo → contrai a região.

     A distribuição não é perfeitamente regular de propósito.
     Essa assimetria ajuda a produzir uma silhueta orgânica.
  ======================================================= */

  outerMasses: [
    { at: 0.025, width: 0.07, amount: 0.2 },
    { at: 0.145, width: 0.05, amount: -0.06 },
    { at: 0.215, width: 0.072, amount: 0.16 },
    { at: 0.355, width: 0.052, amount: -0.08 },
    { at: 0.435, width: 0.076, amount: 0.19 },
    { at: 0.565, width: 0.045, amount: -0.07 },
    { at: 0.65, width: 0.085, amount: 0.23 },
    { at: 0.785, width: 0.05, amount: -0.06 },
    { at: 0.865, width: 0.072, amount: 0.17 },
    { at: 0.955, width: 0.045, amount: -0.04 },
  ],

  /* =======================================================
     INNER MASSES
     -------------------------------------------------------
     Alteram localmente a borda INTERNA.

     A borda interna possui seu próprio conjunto de massas,
     independente da externa.

     Isso é importante porque, se ambas fossem deformadas
     exatamente da mesma forma, a criatura pareceria um tubo
     uniforme.

     A independência das duas bordas gera variações reais de
     espessura ao longo da forma.
  ======================================================= */

  innerMasses: [
    { at: 0.055, width: 0.065, amount: -0.07 },
    { at: 0.17, width: 0.055, amount: 0.08 },
    { at: 0.3, width: 0.062, amount: -0.1 },
    { at: 0.405, width: 0.05, amount: 0.06 },
    { at: 0.535, width: 0.07, amount: -0.09 },
    { at: 0.69, width: 0.05, amount: 0.09 },
    { at: 0.805, width: 0.058, amount: -0.08 },
    { at: 0.925, width: 0.05, amount: 0.07 },
  ],

  /* =======================================================
     TWIST ZONES
     -------------------------------------------------------
     Representam regiões onde a anatomia sofre uma torção.

     at
     → centro da região.

     width
     → alcance da influência.

     amount
     → direção e intensidade da torção.

       positivo e negativo produzem torções em sentidos
       opostos.

     Alternar o sinal ajuda a impedir que a estrutura inteira
     pareça torcida sempre para o mesmo lado.
  ======================================================= */

  twistZones: [
    { at: 0.155, width: 0.065, amount: 0.52 },
    { at: 0.345, width: 0.055, amount: -0.62 },
    { at: 0.565, width: 0.07, amount: 0.68 },
    { at: 0.765, width: 0.055, amount: -0.58 },
    { at: 0.925, width: 0.05, amount: 0.45 },
  ],

  /* =======================================================
     PINCH ZONES
     -------------------------------------------------------
     Regiões de "pinçamento" ou estreitamento localizado.

     Elas criam pontos onde a estrutura parece comprimida,
     quebrando a uniformidade da espessura.

     at
     → posição do pinçamento.

     width
     → largura da região afetada.

     amount
     → intensidade do estreitamento.
  ======================================================= */

  pinchZones: [
    { at: 0.145, width: 0.04, amount: 0.22 },
    { at: 0.35, width: 0.04, amount: 0.3 },
    { at: 0.56, width: 0.038, amount: 0.24 },
    { at: 0.78, width: 0.042, amount: 0.28 },
  ],

  /* =======================================================
     HIGHLIGHTS
     -------------------------------------------------------
     Define regiões que recebem maior destaque luminoso.

     u
     → posição normalizada ao longo da criatura.

     lane
     → posição transversal dentro da faixa estrutural.
       Valores diferentes fazem o brilho aparecer mais perto
       da borda interna ou externa.

     power
     → intensidade do destaque.

     radius
     → escala espacial do efeito.

     Esses pontos ajudam a quebrar a iluminação uniforme e
     reforçam a percepção de volume e material orgânico.
  ======================================================= */

  highlights: [
    { u: 0.018, lane: 0.82, power: 1.0, radius: 1.0 },
    { u: 0.11, lane: 0.28, power: 0.7, radius: 0.76 },
    { u: 0.245, lane: 0.74, power: 0.92, radius: 0.88 },
    { u: 0.385, lane: 0.35, power: 0.6, radius: 0.68 },
    { u: 0.505, lane: 0.78, power: 0.8, radius: 0.78 },
    { u: 0.635, lane: 0.25, power: 1.0, radius: 1.0 },
    { u: 0.74, lane: 0.7, power: 0.62, radius: 0.7 },
    { u: 0.875, lane: 0.32, power: 0.9, radius: 0.88 },
  ],
};