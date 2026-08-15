# SYVRON — Behavior Prototype V17

Base: approved V16.

V16 is now the official visual baseline.

## Goal of V17

Fix only the persistent low-density band in the bottom / lower-left sector.

## What changed

The previous local repair layer (`drawLowerLeftContinuity`) was removed.

V17 does NOT draw extra strands over the problem.

Instead, the real existing fibers are redistributed only between approximately
the bottom and lower-left sector.

The local correction:

- slightly expands lane spacing around the membrane midpoint;
- gives inner-half fibers a small inward bias;
- fades smoothly to zero outside the affected sector;
- preserves each fiber's identity and natural motion;
- does not change global fiber density.

## Locked from V16

Unchanged:

- anatomy
- top seam fix
- color design
- motion state machine
- RUNNING speed
- LAP duration (1450 ms)
- LAP size
- IDLE / PAUSE / RESUME / RESET
- global silhouette
- X-bridge layer remains disabled

This version exists only to make the bottom membrane feel continuously filled
by the organism's own fibers.
