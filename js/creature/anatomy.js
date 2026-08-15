// V5 DNA: deliberately asymmetric. Outer and inner boundaries are independent.
export const ANATOMY = {
  outerBase: 1.13,
  innerBase: 0.79,

  outerMasses: [
    { at: 0.025, width: 0.070, amount:  0.20 },
    { at: 0.145, width: 0.050, amount: -0.06 },
    { at: 0.215, width: 0.072, amount:  0.16 },
    { at: 0.355, width: 0.052, amount: -0.08 },
    { at: 0.435, width: 0.076, amount:  0.19 },
    { at: 0.565, width: 0.045, amount: -0.07 },
    { at: 0.650, width: 0.085, amount:  0.23 },
    { at: 0.785, width: 0.050, amount: -0.06 },
    { at: 0.865, width: 0.072, amount:  0.17 },
    { at: 0.955, width: 0.045, amount: -0.04 },
  ],

  innerMasses: [
    { at: 0.055, width: 0.065, amount: -0.07 },
    { at: 0.170, width: 0.055, amount:  0.08 },
    { at: 0.300, width: 0.062, amount: -0.10 },
    { at: 0.405, width: 0.050, amount:  0.06 },
    { at: 0.535, width: 0.070, amount: -0.09 },
    { at: 0.690, width: 0.050, amount:  0.09 },
    { at: 0.805, width: 0.058, amount: -0.08 },
    { at: 0.925, width: 0.050, amount:  0.07 },
  ],

  twistZones: [
    { at: 0.155, width: 0.065, amount:  0.52 },
    { at: 0.345, width: 0.055, amount: -0.62 },
    { at: 0.565, width: 0.070, amount:  0.68 },
    { at: 0.765, width: 0.055, amount: -0.58 },
    { at: 0.925, width: 0.050, amount:  0.45 },
  ],

  pinchZones: [
    { at: 0.145, width: 0.040, amount: 0.22 },
    { at: 0.350, width: 0.040, amount: 0.30 },
    { at: 0.560, width: 0.038, amount: 0.24 },
    { at: 0.780, width: 0.042, amount: 0.28 },
  ],

  highlights: [
    { u: 0.018, lane: 0.82, power: 1.00, radius: 1.00 },
    { u: 0.110, lane: 0.28, power: 0.70, radius: 0.76 },
    { u: 0.245, lane: 0.74, power: 0.92, radius: 0.88 },
    { u: 0.385, lane: 0.35, power: 0.60, radius: 0.68 },
    { u: 0.505, lane: 0.78, power: 0.80, radius: 0.78 },
    { u: 0.635, lane: 0.25, power: 1.00, radius: 1.00 },
    { u: 0.740, lane: 0.70, power: 0.62, radius: 0.70 },
    { u: 0.875, lane: 0.32, power: 0.90, radius: 0.88 },
  ],
};
