import * as THREE from 'three'
import { Effect, EffectAttribute } from 'postprocessing'
import { POST } from '../core/tuning'
import type { QualitySettings } from '../core/types'
import { createLutAtlas, LUT_GLSL, MoodMixer, type MoodInputs } from './lut'
import type { InternalUniforms, PublicUniforms } from './uniforms'

const GRADE_FS = /* glsl */ `
${LUT_GLSL}
uniform sampler2D tDepth;
uniform sampler2D tBloom;
uniform sampler2D tShafts;
uniform sampler2D tRadial;
uniform sampler2D tExposure;
uniform float uNear;
uniform float uFar;
uniform float uIndoor;
uniform float uAirHaze;
uniform float uBloomOut;
uniform float uBloomIn;
uniform vec3 uProfond;
uniform float uShoulder;
uniform float uVignetteOut;
uniform float uVignetteIn;
uniform vec3 uInterieur;

float viewZ(vec2 uv) {
  float z = texture2D(tDepth, uv).r * 2.0 - 1.0;
  return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear));
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

#ifdef PAINTERLY
vec3 kuwahara(vec2 uv) {
  vec3 m[4];
  vec3 s[4];
  for (int k = 0; k < 4; k++) { m[k] = vec3(0.0); s[k] = vec3(0.0); }
  for (int j = -2; j <= 2; j++) {
    for (int i = -2; i <= 2; i++) {
      vec3 c = texture2D(inputBuffer, uv + vec2(float(i), float(j)) * texelSize).rgb;
      vec3 c2 = c * c;
      if (i <= 0 && j <= 0) { m[0] += c; s[0] += c2; }
      if (i >= 0 && j <= 0) { m[1] += c; s[1] += c2; }
      if (i <= 0 && j >= 0) { m[2] += c; s[2] += c2; }
      if (i >= 0 && j >= 0) { m[3] += c; s[3] += c2; }
    }
  }
  vec3 best = vec3(0.0);
  float bestV = 1e9;
  for (int k = 0; k < 4; k++) {
    vec3 mu = m[k] / 9.0;
    vec3 v = abs(s[k] / 9.0 - mu * mu);
    float vv = v.r + v.g + v.b;
    if (vv < bestV) { bestV = vv; best = mu; }
  }
  return best;
}
#endif

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 col = inputColor.rgb;
  float dc = viewZ(uv);
#ifdef PAINTERLY
  float farMix = smoothstep(60.0, 220.0, dc) * (1.0 - uIndoor);
  if (farMix > 0.01) col = mix(col, kuwahara(uv), farMix);
#endif
#ifdef OUTLINE
  vec2 o = texelSize;
  float d1 = viewZ(uv + vec2(o.x, 0.0));
  float d2 = viewZ(uv - vec2(o.x, 0.0));
  float d3 = viewZ(uv + vec2(0.0, o.y));
  float d4 = viewZ(uv - vec2(0.0, o.y));
  float lap = abs(d1 + d2 + d3 + d4 - 4.0 * dc) / max(dc, 0.5);
  float edge = smoothstep(0.06, 0.2, lap) * (1.0 - smoothstep(40.0, 220.0, dc));
  col = mix(col, col * 0.55 + uProfond * 0.45, edge * 0.4);
#endif
  if (dc < 28.0 && dc > 1.0) {
    vec2 px = texelSize * max(1.0, 1.0 / (texelSize.y * 720.0)) * 2.5;
    vec3 wrap = vec3(0.0);
    float wn = 0.0;
    for (int k = 0; k < 8; k++) {
      float a = float(k) * 0.7854;
      vec2 off = vec2(cos(a), sin(a)) * px;
      float far = smoothstep(1.35, 1.9, viewZ(uv + off) / dc);
      wrap += texture2D(inputBuffer, uv + off).rgb * far;
      wn += far;
    }
    if (wn > 0.0) {
      vec3 bg = wrap / wn;
      float lift = smoothstep(0.0, 0.25, luma(bg) - luma(col));
      vec3 coolBg = mix(bg, bg * vec3(0.82, 1.04, 1.1), uIndoor);
      float coolK = smoothstep(0.0, 0.08, bg.b - bg.r) * uIndoor;
      col += coolBg * lift * min(wn / 3.0, 1.0) * mix(0.55, 1.1, coolK) * smoothstep(1.2, 2.2, dc) * (1.0 - smoothstep(14.0, 28.0, dc));
    }
  }
  col *= mix(1.0, mix(0.6, 1.0, smoothstep(0.35, 1.6, dc)), uIndoor);
  col *= texture2D(tExposure, vec2(0.5)).r;
  col += texture2D(tShafts, uv).rgb;
#ifdef RADIAL
  col += texture2D(tRadial, uv).rgb * 0.9 * (1.0 - uIndoor);
#endif
  col += texture2D(tBloom, uv).rgb * mix(uBloomOut, uBloomIn * mix(1.0, 1.5, clamp(uAirHaze, 0.0, 1.0)), uIndoor);

  float m = max(col.r, max(col.g, col.b));
  float sh = uShoulder;
  if (m > sh) col *= (sh + (1.0 - sh) * (1.0 - exp(-(m - sh) / (1.0 - sh)))) / m;
  vec2 vq = uv - 0.5;
  float vig = smoothstep(0.25, 0.95, length(vq * vec2(1.15, 1.0)));
  vec3 plumHue = uInterieur / max(max(uInterieur.r, uInterieur.g), uInterieur.b);
  vec3 vigCol = mix(col * 0.6 + uProfond * 0.25, col * plumHue * 0.5, uIndoor);
  col = mix(col, vigCol, vig * mix(uVignetteOut, uVignetteIn, uIndoor));
  col = applyLut(col);
#ifdef PAINTERLY
  col += (hash(floor(uv / texelSize / 2.0)) - 0.5) * 0.004;
#endif
  outputColor = vec4(col, 1.0);
}
`

export interface GradeInputs {
  depth: THREE.Texture
  shafts: THREE.Texture
  radial: THREE.Texture
}

export class GradeEffect extends Effect {
  private readonly u: Map<string, THREE.Uniform>
  private readonly pub: PublicUniforms
  private readonly int: InternalUniforms
  private readonly moods = new MoodMixer()

  constructor(pub: PublicUniforms, int: InternalUniforms, inputs: GradeInputs) {
    const lut = createLutAtlas()
    const uniforms = new Map<string, THREE.Uniform>([
      ['tDepth', new THREE.Uniform(inputs.depth)],
      ['tBloom', new THREE.Uniform(null)],
      ['tShafts', new THREE.Uniform(inputs.shafts)],
      ['tRadial', new THREE.Uniform(inputs.radial)],
      ['tExposure', new THREE.Uniform(null)],
      ['uNear', new THREE.Uniform(0.1)],
      ['uFar', new THREE.Uniform(4000)],
      ['uIndoor', new THREE.Uniform(0)],
      ['uAirHaze', new THREE.Uniform(0)],
      ['uShoulder', new THREE.Uniform(POST.shoulder)],
      ['uVignetteOut', new THREE.Uniform(POST.vignette.outdoor)],
      ['uVignetteIn', new THREE.Uniform(POST.vignette.indoor)],
      ['tLut', new THREE.Uniform(lut)],
      ['uLutMood', new THREE.Uniform(new THREE.Vector4())],
      ['uLutWeight', new THREE.Uniform(new THREE.Vector4(1, 0, 0, 0))],
      ['uBloomOut', new THREE.Uniform(POST.bloom.outdoor)],
      ['uBloomIn', new THREE.Uniform(POST.bloom.indoor)],
      ['uProfond', new THREE.Uniform(new THREE.Color())],
      ['uInterieur', new THREE.Uniform(new THREE.Color())],
    ])
    super('DriftGrade', GRADE_FS, { attributes: EffectAttribute.CONVOLUTION, uniforms })
    this.u = uniforms
    this.pub = pub
    this.int = int
  }

  setFeatures(q: QualitySettings): void {
    this.defines.clear()
    if (q.outline) this.defines.set('OUTLINE', '')
    if (q.painterly) this.defines.set('PAINTERLY', '')
    if (q.godRayPass) this.defines.set('RADIAL', '')
    this.setChanged()
  }

  setFrame(camera: THREE.PerspectiveCamera, bloom: THREE.Texture, exposure: THREE.Texture, mood: MoodInputs, dt: number, snap: boolean): void {
    this.moods.update(mood, dt, snap, this.u.get('uLutMood')!.value as THREE.Vector4, this.u.get('uLutWeight')!.value as THREE.Vector4)
    this.u.get('uNear')!.value = camera.near
    this.u.get('uFar')!.value = camera.far
    this.u.get('tBloom')!.value = bloom
    this.u.get('tExposure')!.value = exposure
    this.u.get('uIndoor')!.value = this.pub.uIndoor.value
    this.u.get('uAirHaze')!.value = this.pub.uAirHaze.value
    ;(this.u.get('uProfond')!.value as THREE.Color).copy(this.int.rdProfond.value)
    ;(this.u.get('uInterieur')!.value as THREE.Color).copy(this.int.rdInterieur.value)
  }

  override dispose(): void {
    ;(this.u.get('tLut')!.value as THREE.Texture).dispose()
    super.dispose()
  }
}
