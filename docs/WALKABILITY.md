# Walkability audit

Audit of 2026-10-19 on the production build (`vite preview`, real-GPU Chrome).

## Method

Two checks, both driving Rapier's character controller with the hero's settings (capsule 0.5/0.3,
offset 0.03, autostep 0.5, snap 0.35, slope 40°, the hero's 2 cm lift retry). They run
synchronously against the live physics world, so a whole hall takes about a second.

- **Local stuck spots**: same rule as the real-time `__audit` (Ilo teleported on a grid, pushed 0.8 m
  in 8 directions, a spot is stuck when it moves in 3 directions or fewer). Spots inside a prop are
  skipped. The cabine was cross-checked with the real-time keyboard `__audit` (34 spots, 0 stuck) and
  agrees.
- **Connectivity**: every walkable floor of the whole Drift (all decks, 1.5 m grid, 12 722 nodes)
  linked when Ilo can walk from one node to its neighbour, plus every ladder. Doors count as open.
  Anything not linked to the cabine is an island.

Steps: 0.6 m in the Écluse quarter, 1.0 m in the halls, gangways, domes and tube.

## Local stuck spots per room

| Room / cell (level) | Before | After | Notes |
|---|---|---|---|
| cabine | 2 | 2 | corners between the bunk and the wall, 3 free directions |
| coursive-sud | 0 | 0 | |
| sas | 0 | 0 | |
| cabines-voisins | 0 | 0 | |
| réfectoire | 0 | 0 | |
| rebord | 0 | 0 | |
| cuisine | 0 | 0 | |
| marché (quartier) | 0 | 0 | |
| passerelles 1/2/3 | 0 | 0 | |
| salle des cartes | 0 | 0 | |
| échelle-toit | 1 | 1 | ladder shaft, intended |
| Nef -6 | 0 | 0 | |
| Nef 0 / 8 / 16 (mast rings) | 3 / 5 / 4 | 2 / 1 / 3 | square mast collider replaced by an octagon; the rest hug the ring rail |
| Grand marché 0 / 6.5 / 13 | 0 / 0 / 0 | 0 / 0 / 0 | |
| Serre-cathédrale 0 / 7 | 0 / 0 | 0 / 0 | |
| Ateliers 0 / 6.5 | 0 / 0 | 0 / 0 | |
| Coques scellées 0 / 6.5 | 0 / 0 | 0 / 0 | |
| Puits -22 / -14 | 6 / 0 | 4 / 2 | against engine bases and the inner ring rail |
| Proue vestibule, vigie | 0 | 0 | |
| Tube des Hauts | 0 | 0 | |
| Domes (écluse, marché, serres, ateliers, scellées, proue) | 0 | 0 | |
| Gangways (8) | 0 | 0 | |

Every remaining spot was probed direction by direction: Ilo is touching a rail or a prop on one
side and walks away freely on the other. None is a trap.

## Connectivity

| Island | Before | After |
|---|---|---|
| Coques scellées gallery (6.5 m) | 235 nodes cut off | connected |
| Dôme de la proue interior | 72 nodes cut off | connected |
| Islands left | 176 | 175 |

The 175 islands left are, by design: tops of gallery houses, stall roofs and wall caps (no stair
reaches them), the puits net (you drop through it), and the flooded basins of the sealed hulls
(puzzles; climbable ledges).

## Fixes

- Coques scellées: the north-south footbridge at x = 75 crossed over the only gallery stair and left
  1.6 m of headroom at its top; Ilo stopped at 3.9 m. The bridge and its rail gaps moved to x = 66.
- Dôme de la proue: the glass ring had no opening, so the flooded stair (act 3) ended on a landing
  outside the dome. The dome now opens toward the landing.
- Nef mast: its collider was a 5.2 m square around a 4.8 m cylinder; the corners ate 1.2 m of the
  ring walkways on the diagonals. Four rotated boxes now follow the mesh within 7 cm.
- Market stalls: crate and barrel pulled 0.15 m in from the lanes.

## Real keyboard check

Ilo, driven with the keyboard, walked up the Coques scellées stair from 0 to 6.53 m in 4.5 s
with no stall.
