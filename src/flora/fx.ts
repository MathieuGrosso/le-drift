import * as THREE from 'three'
import { PLANT_COLORS as P } from './palette'

export interface FxUniforms {
  uTime: { value: number }
  uGlow: { value: number }
}

export function createFxUniforms(): FxUniforms {
  return { uTime: { value: 0 }, uGlow: { value: 0 } }
}

export function waterMaterial(u: FxUniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { ...u, uDeep: { value: new THREE.Color(P.eau) }, uLight: { value: new THREE.Color(P.vitreMer) }, uLamp: { value: new THREE.Color(P.serre) } },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute vec3 aW;
      varying vec3 vW;
      varying vec3 vWorld;
      void main() {
        vW = aW;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uDeep;
      uniform vec3 uLight;
      uniform vec3 uLamp;
      varying vec3 vW;
      varying vec3 vWorld;
      void main() {
        vec2 p = vW.xy;
        float flow = vW.z > 0.5 ? uTime * 0.9 : 0.0;
        float r = sin(p.x * 3.1 + uTime * 0.7) * sin(p.y * 2.3 - uTime * 0.5 - flow * 2.0)
          + 0.6 * sin((p.x + p.y) * 4.7 - uTime * 1.3 - flow * 3.0);
        float hi = smoothstep(0.95, 1.35, r);
        vec3 c = mix(uDeep, uLight, 0.25 + 0.2 * r * 0.5);
        c += uLamp * hi * 0.45;
        vec3 v = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - clamp(v.y, 0.0, 1.0), 3.0);
        c = mix(c, uLight, fres * 0.5);
        gl_FragColor = vec4(c, 0.72 + 0.2 * fres + hi * 0.1);
      }`,
  })
}

export function tankMaterial(u: FxUniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { ...u, uWater: { value: new THREE.Color(P.eau) }, uGlass: { value: new THREE.Color(0xdff4ec) }, uBio: { value: new THREE.Color(P.bio1) } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vWorld;
      varying vec3 vLocal;
      void main() {
        vLocal = position;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uGlow;
      uniform vec3 uWater;
      uniform vec3 uGlass;
      uniform vec3 uBio;
      varying vec3 vN;
      varying vec3 vWorld;
      varying vec3 vLocal;
      void main() {
        vec3 v = normalize(cameraPosition - vWorld);
        vec3 n = normalize(vN);
        if (!gl_FrontFacing) n = -n;
        float fres = pow(1.0 - abs(dot(n, v)), 2.5);
        float band = sin(vLocal.y * 2.2 - uTime * 0.8 + sin(vLocal.x * 3.0 + vLocal.z * 2.0) * 1.5);
        float caus = smoothstep(0.7, 1.0, band) * 0.18;
        vec3 c = mix(uWater, uGlass, 0.25 + 0.6 * fres) + uGlass * caus + uBio * uGlow * 0.12;
        float streak = smoothstep(0.92, 1.0, sin(atan(vLocal.x, vLocal.z) * 3.0 + 1.2)) * 0.35;
        float a = gl_FrontFacing ? 0.16 + 0.55 * fres + streak : 0.1 + 0.15 * fres;
        gl_FragColor = vec4(c + streak, a);
      }`,
  })
}

export function bubbleMaterial(u: FxUniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { ...u, uPx: { value: 300 } },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute vec4 aB;
      uniform float uTime;
      uniform float uPx;
      varying float vA;
      void main() {
        float span = aB.z;
        float k = fract(aB.x + uTime * aB.y / max(span, 0.1));
        vec3 p = position;
        p.y += k * span;
        p.x += sin(uTime * 3.0 + aB.x * 40.0 + k * 9.0) * 0.06;
        p.z += cos(uTime * 2.6 + aB.x * 31.0 + k * 7.0) * 0.06;
        vA = smoothstep(0.0, 0.08, k) * (1.0 - smoothstep(0.85, 1.0, k));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aB.w * 0.05 * uPx / max(-mv.z, 0.5);
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float r = length(d);
        if (r > 0.5) discard;
        float ring = smoothstep(0.32, 0.45, r) * (1.0 - smoothstep(0.45, 0.5, r));
        float hi = 1.0 - smoothstep(0.0, 0.12, length(d + vec2(0.15, 0.15)));
        gl_FragColor = vec4(vec3(0.92, 1.0, 0.97), (ring * 0.8 + hi * 0.9 + 0.08) * vA);
      }`,
  })
}
