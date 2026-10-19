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
  airlockFastMul: 4,
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
    shoulderOffset: 0.6,
    fov: 64,
    pitchMinDeg: -50,
    pitchMaxDeg: 52,
    sphereRadius: 0.25,
    easeOut: 1.5,
    ceilingMargin: 0.2,
    fadeOpacity: 0.25,
    transitionSeconds: 1,
  },
  atrium: { distance: 5, fov: 62 },
  ride: { distance: 6, fov: 66 },
  sortie: { distance: 6, fov: 55 },
  collision: { pullInPerSecond: 9, holdSeconds: 0.35, nearRadius: 0.14, hardRadius: 0.16, outsideRadius: 0.35 },
  swing: { below: 1.4, idleSeconds: 0.25, gain: 0.35, offsets: [0.6, -0.6, 1.2, -1.2, 1.9, -1.9], gainPerRadian: 2.2, maxRate: 2.4, response: 5 },
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

export const WINDOWS = {
  initialCoat: 0.9,
  regrowHours: 20,
  regrowHoursAct2: 12,
  northFactor: 0.5,
  sharedRegrowHours: 16,
} as const

export const NET = {
  sendHz: 12,
  interpDelayMs: 150,
  probeTimeoutMs: 1200,
  reconnectSeconds: 20,
  chatBubbleSeconds: 6,
  nameTagMaxDistance: 30,
  saveDebounceMs: 2000,
} as const

// Recast voxel sizes are metres; walkable* are converted to voxels in drift/nav.
export const NAV = {
  cellSize: 0.2,
  cellHeight: 0.1,
  tileSize: 64,
  slopeDeg: 42,
  agentHeight: 1.7,
  agentClimb: 0.38,
  agentRadius: 0.28,
  maxEdgeLen: 12,
  simplifyError: 1.3,
  minRegionArea: 6,
  mergeRegionArea: 20,
  linkRadius: 0.6,
  ladderFoot: 0.5,
  maxPathPolys: 4096,
  snapExtent: { x: 1.5, y: 2.5, z: 1.5 },
  debugColor: 0x3fe0c0,
  crowd: {
    maxAgents: { high: 600, medium: 300, low: 120 },
    acceleration: 6,
    separation: 1.2,
    waypointReach: 0.7,
    faceSpeed: 0.05,
  },
} as const

export const POST = {
  bloom: { threshold: 1.15, indoorThreshold: 0.3, smoothing: 0.25, levels: 5, radius: 0.75, outdoor: 0.55, indoor: 0.3 },
  ao: {
    radius: 1.1, falloff: 1.0, intensity: 2.6, indoorScale: 0.6, tintMix: 0.55, floor: 0.4,
    levels: { high: { k: 1, mode: 'Medium' }, medium: { k: 0.85, mode: 'Low' }, low: { k: 0, mode: 'Performance' } },
  },
  exposureRate: 1.6,
} as const

// Kenney props: height in metres per model at scale 1; light sampled at this fraction of the height.
export const PROPS = {
  lightProbe: 0.6,
  height: {
    'plante-pot': 0.85, 'plante-1': 0.85, 'plante-2': 0.85, 'plante-3': 0.85,
    chaise: 0.92, 'chaise-ronde': 0.9, tabouret: 0.72, livres: 0.2, radio: 0.3, lampe: 0.42,
  },
  chairGap: 0.55,
  chairHalf: 0.22,
} as const
