declare module 'n8ao' {
  import type { Camera, Color, Scene, WebGLRenderTarget, WebGLRenderer, DepthTexture } from 'three'
  import { Pass } from 'postprocessing'

  export type N8AOQualityMode = 'Performance' | 'Low' | 'Medium' | 'High' | 'Ultra'

  export interface N8AOConfiguration {
    aoRadius: number
    distanceFalloff: number
    intensity: number
    color: Color
    halfRes: boolean
    depthAwareUpsampling: boolean
    gammaCorrection: boolean
    screenSpaceRadius: boolean
    colorMultiply: boolean
    accumulate: boolean
    transparencyAware: boolean
  }

  export class N8AOPostPass extends Pass {
    constructor(scene: Scene, camera: Camera, width?: number, height?: number)
    camera: Camera
    readonly configuration: N8AOConfiguration
    autoDetectTransparency: boolean
    setQualityMode(mode: N8AOQualityMode): void
    setDepthTexture(depthTexture: DepthTexture): void
    setSize(width: number, height: number): void
    render(renderer: WebGLRenderer, inputBuffer: WebGLRenderTarget, outputBuffer: WebGLRenderTarget): void
    dispose(): void
  }
}
