export const TIME = {
  realSecondsPerGameHour: 60,
  startHour: 6,
  startDay: 1,
  phases: { aube: 5, jour: 7, crepuscule: 17, nuit: 19.5 },
} as const

export const PHYSICS = {
  step: 1 / 60,
  maxSubsteps: 4,
  maxFrameDt: 0.1,
  indoorGravity: -9.81,
} as const

export const MOVE = {
  walk: 2.2,
  run: 4.5,
  swim: 3.0,
  swimSprint: 5.0,
  swimVertical: 2.0,
  sinkTerminal: 1.4,
  kickImpulse: 4.5,
  kickCost: 0.06,
  descend: 3.0,
  climbSpeed: 1.4,
  climbCostMoving: 0.08,
  climbCostHanging: 0.02,
  climbJump: 2.5,
  climbJumpCost: 0.18,
  voileForward: 7,
  voileSink: 0.5,
  voileCost: 0.04,
  sprintCostSwim: 0.12,
  sprintCostFloor: 0.1,
  strongCurrentClimbMul: 1.5,
  exhaustedSpeedMul: 0.5,
} as const

export const SOUFFLE = {
  base: 1.0,
  perFourNacres: 0.2,
  max: 3.0,
  regen: 0.35,
  regenDelay: 0.8,
  regenBubble: 1.0,
  lowThreshold: 0.25,
} as const

export const INDOOR = {
  walk: 1.6,
  run: 3.8,
  hopHeight: 0.45,
  stepHeight: 0.5,
  maxSlopeDeg: 40,
  ladderSpeed: 1.2,
  hatchSpinSeconds: 0.8,
  wetnessDrySeconds: 120,
  airlockSeconds: 6,
  airlockFastMul: 3,
  stuckSnapSeconds: 3,
} as const

export const CAMERA = {
  outside: {
    pivotHeight: 1.5,
    distance: 6,
    distanceNearWall: 4,
    distanceGlide: 9,
    pitchMinDeg: -70,
    pitchMaxDeg: 80,
    fov: 55,
    fovFast: 62,
    easeOut: 1.5,
    recenterHoldSeconds: 2,
  },
  indoor: {
    pivotHeight: 1.55,
    distance: 3.0,
    distanceMin: 0.6,
    shoulderOffset: 0.5,
    fov: 60,
    pitchMinDeg: -50,
    pitchMaxDeg: 60,
    sphereRadius: 0.25,
    easeOut: 1.5,
    ceilingMargin: 0.2,
    fadeOpacity: 0.25,
    transitionSeconds: 1,
  },
} as const

export const HAZE_BY_VISIBILITY: Readonly<Record<number, number>> = { 30: 170, 60: 280, 90: 400, 999: 620 }
export const HAZE_MAX = 0.93
export const BLOOM_HAZE_MUL = 0.6

export const INPUT = {
  mouseRadiansPerPixel: 0.0025,
  stickRadiansPerSecond: 3.0,
  deadzone: 0.15,
} as const

export const AUTOSAVE_SECONDS = 60
export const AUTO_QUALITY = { frameMs: 24, windowSeconds: 5 } as const
