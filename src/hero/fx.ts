import * as THREE from 'three'

const PRINT_VERT = /* glsl */ `
attribute float aAlpha;
varying float vAlpha;
varying vec2 vUv;
void main() {
  vAlpha = aAlpha;
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
}
`
const PRINT_FRAG = /* glsl */ `
varying float vAlpha;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float sole = smoothstep(1.0, 0.75, length(vec2(p.x * 1.9, (p.y + 0.18) * 1.05)));
  float heel = smoothstep(1.0, 0.7, length(vec2(p.x * 2.1, (p.y - 0.62) * 2.6)));
  float a = max(sole, heel) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(0.16, 0.15, 0.28, a * 0.45);
}
`

export class Footprints {
  readonly mesh: THREE.InstancedMesh
  private alpha: THREE.InstancedBufferAttribute
  private born: Float32Array
  private strength: Float32Array
  private next = 0
  private m = new THREE.Matrix4()
  private q = new THREE.Quaternion()
  private up = new THREE.Vector3(0, 1, 0)
  private s = new THREE.Vector3(0.11, 1, 0.26)

  constructor(private capacity: number) {
    const g = new THREE.PlaneGeometry(1, 1)
    g.rotateX(-Math.PI / 2)
    this.alpha = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1)
    this.alpha.setUsage(THREE.DynamicDrawUsage)
    g.setAttribute('aAlpha', this.alpha)
    const mat = new THREE.ShaderMaterial({
      vertexShader: PRINT_VERT, fragmentShader: PRINT_FRAG, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    })
    this.mesh = new THREE.InstancedMesh(g, mat, capacity)
    this.mesh.name = 'hero-footprints'
    this.mesh.frustumCulled = false
    this.mesh.count = 0
    this.born = new Float32Array(capacity)
    this.strength = new Float32Array(capacity)
  }

  setCapacity(n: number): void {
    this.capacity = Math.max(1, Math.min(n, this.born.length))
    this.next %= this.capacity
    this.mesh.count = Math.min(this.mesh.count, this.capacity)
  }

  stamp(p: THREE.Vector3, normal: THREE.Vector3, yaw: number, left: boolean, wet: number, t: number): void {
    const i = this.next
    this.next = (this.next + 1) % this.capacity
    this.q.setFromUnitVectors(this.up, normal)
    const yq = new THREE.Quaternion().setFromAxisAngle(this.up, -yaw)
    this.q.multiply(yq)
    const side = left ? -0.09 : 0.09
    const pos = new THREE.Vector3(Math.cos(yaw) * side, 0.012, Math.sin(yaw) * side).add(p)
    this.m.compose(pos, this.q, this.s)
    this.mesh.setMatrixAt(i, this.m)
    this.born[i] = t
    this.strength[i] = wet
    this.mesh.count = Math.max(this.mesh.count, i + 1)
    this.mesh.instanceMatrix.needsUpdate = true
  }

  shift(dx: number, dy: number, dz: number): void {
    if (dx === 0 && dy === 0 && dz === 0) return
    const a = this.mesh.instanceMatrix.array as Float32Array
    for (let i = 0; i < this.mesh.count; i++) {
      a[i * 16 + 12] += dx
      a[i * 16 + 13] += dy
      a[i * 16 + 14] += dz
    }
    this.mesh.instanceMatrix.needsUpdate = true
  }

  update(t: number, wetness: number, dryTime: number): void {
    const arr = this.alpha.array as Float32Array
    for (let i = 0; i < this.mesh.count; i++) {
      const age = t - this.born[i]!
      const life = Math.max(1, dryTime * this.strength[i]!)
      arr[i] = Math.max(0, 1 - age / life) * Math.min(1, this.strength[i]! * 1.5) * (0.4 + 0.6 * Math.min(1, wetness * 4 + 0.25))
    }
    this.alpha.needsUpdate = true
  }

  clear(): void {
    this.mesh.count = 0
  }
}

const DROP_VERT = /* glsl */ `
attribute float aLife;
attribute float aSize;
varying float vLife;
void main() {
  vLife = aLife;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = min(aSize * (300.0 / max(-mv.z, 0.1)), 9.0);
  vLife *= smoothstep(0.6, 1.6, -mv.z);
}
`
const DROP_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uBubble;
varying float vLife;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0 || vLife <= 0.0) discard;
  float body = mix(smoothstep(1.0, 0.6, r), smoothstep(1.0, 0.8, r) - smoothstep(0.7, 0.4, r) * 0.6, uBubble);
  float hi = smoothstep(0.45, 0.0, length(p - vec2(-0.35, -0.35)));
  gl_FragColor = vec4(uColor * (0.9 + hi * 0.15), (body + hi * 0.5) * min(vLife * 3.0, 1.0) * 0.7);
}
`

export class Particles {
  readonly points: THREE.Points
  private pos: Float32Array
  private vel: Float32Array
  private life: Float32Array
  private size: Float32Array
  private next = 0
  private mat: THREE.ShaderMaterial

  constructor(private n = 48) {
    const g = new THREE.BufferGeometry()
    this.pos = new Float32Array(n * 3)
    this.vel = new Float32Array(n * 3)
    this.life = new Float32Array(n)
    this.size = new Float32Array(n)
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage))
    g.setAttribute('aLife', new THREE.BufferAttribute(this.life, 1).setUsage(THREE.DynamicDrawUsage))
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage))
    this.mat = new THREE.ShaderMaterial({
      vertexShader: DROP_VERT, fragmentShader: DROP_FRAG, transparent: true, depthWrite: false,
      uniforms: { uColor: { value: new THREE.Color(0xcfefe3) }, uBubble: { value: 1 } },
    })
    this.points = new THREE.Points(g, this.mat)
    this.points.name = 'hero-drops'
    this.points.frustumCulled = false
  }

  emit(p: THREE.Vector3, v: THREE.Vector3, life: number, size: number): void {
    const i = this.next
    this.next = (this.next + 1) % this.n
    this.pos.set([p.x, p.y, p.z], i * 3)
    this.vel.set([v.x, v.y, v.z], i * 3)
    this.life[i] = life
    this.size[i] = size
  }

  update(dt: number, inWater: boolean, floorY: number): void {
    this.mat.uniforms.uBubble!.value = inWater ? 1 : 0
    for (let i = 0; i < this.n; i++) {
      if (this.life[i]! <= 0) continue
      this.life[i]! -= dt
      const j = i * 3
      if (inWater) {
        this.vel[j + 1] = Math.min(this.vel[j + 1]! + 2.5 * dt, 1.4)
        this.vel[j]! *= 0.98
        this.vel[j + 2]! *= 0.98
        this.pos[j]! += Math.sin(this.life[i]! * 9 + i) * 0.004
      } else {
        this.vel[j + 1]! -= 9.81 * dt
      }
      this.pos[j]! += this.vel[j]! * dt
      this.pos[j + 1]! += this.vel[j + 1]! * dt
      this.pos[j + 2]! += this.vel[j + 2]! * dt
      if (!inWater && this.pos[j + 1]! < floorY) this.life[i] = 0
    }
    const g = this.points.geometry
    g.getAttribute('position').needsUpdate = true
    g.getAttribute('aLife').needsUpdate = true
    g.getAttribute('aSize').needsUpdate = true
  }

  clear(): void {
    this.life.fill(0)
  }
}

export class Fader {
  private el: HTMLDivElement
  constructor(root: HTMLElement) {
    this.el = document.createElement('div')
    Object.assign(this.el.style, {
      position: 'fixed', inset: '0', background: '#7cc6bf', opacity: '0', pointerEvents: 'none',
      transition: 'opacity 0.5s ease', zIndex: '5',
    })
    root.appendChild(this.el)
  }
  async through(mid: () => void, ms = 500): Promise<void> {
    this.el.style.transitionDuration = `${ms}ms`
    this.el.style.opacity = '1'
    await new Promise((r) => setTimeout(r, ms))
    mid()
    this.el.style.opacity = '0'
    await new Promise((r) => setTimeout(r, ms))
  }
  dispose(): void {
    this.el.remove()
  }
}
