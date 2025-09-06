import * as THREE from 'three'

export const rotationVertexShader = `
  uniform vec2 uFrequency;
  uniform float uTime;
  uniform float uIntensity;
  
  varying vec2 vUv;
  varying float vElevation;
  
  void main()
  {
      vec4 modelPosition = modelMatrix * vec4(position, 1.0);

      // Animation exactement comme votre exemple, mais avec intensité modulable
      float baseIntensity = 0.4; // Intensité de base (sans rotation)
      float totalIntensity = baseIntensity + uIntensity * 0.3; // Intensité totale
      
      float elevation = sin(modelPosition.x * uFrequency.x - uTime) * 0.1 * totalIntensity;
      elevation += sin(modelPosition.y * uFrequency.y - uTime) * 0.1 * totalIntensity;

      modelPosition.z += elevation;

      vec4 viewPosition = viewMatrix * modelPosition;
      vec4 projectedPosition = projectionMatrix * viewPosition;

      gl_Position = projectedPosition;

      vUv = uv;
      vElevation = elevation;
  }
`

export const rotationFragmentShader = `
  uniform vec3 uColor;
  uniform sampler2D uTexture;
  uniform bool uHasTexture;
  
  varying vec2 vUv;
  varying float vElevation;
  
  void main()
  {
      vec4 textureColor = vec4(1.0);
      
      if (uHasTexture) {
          textureColor = texture2D(uTexture, vUv);
      } else {
          textureColor = vec4(uColor, 1.0);
      }
      
      gl_FragColor = textureColor;
  }
`

export class RotationShaderMaterial extends THREE.ShaderMaterial {
  constructor(options = {}) {
    const uniforms = {
      uTexture: { value: options.map || null },
      uColor: { value: new THREE.Color(options.color || 'white') },
      uFrequency: { value: new THREE.Vector2(2, 1) }, 
      uTime: { value: 0.0 },
      uIntensity: { value: 0.0 },
      uHasTexture: { value: !!options.map }
    }

    super({
      uniforms,
      vertexShader: rotationVertexShader,
      fragmentShader: rotationFragmentShader,
      side: options.side || THREE.DoubleSide,
      transparent: true,
      toneMapped: options.toneMapped !== false,
      depthWrite: true,
      depthTest: true
    })

    this.needsUpdate = true
  }

  set map(value) {
    this.uniforms.uTexture.value = value
    this.uniforms.uHasTexture.value = !!value
    this.needsUpdate = true
  }

  get map() {
    return this.uniforms.uTexture.value
  }

  set color(value) {
    this.uniforms.uColor.value.set(value)
  }

  get color() {
    return this.uniforms.uColor.value
  }

  updateRotation(globalRotation, intensity = 1.0) {
    // Fréquences plus faibles pour des ondulations plus grandes et espacées
    const baseFrequencyX = 8;  // Réduit de 10 à 3
    const baseFrequencyY = 4;  // Réduit de 5 à 2
    this.uniforms.uFrequency.value.set(
      baseFrequencyX + (intensity * 0.35),
      baseFrequencyY + (intensity * 0.25)
    );
    this.uniforms.uIntensity.value = intensity;
  }

  updateTime(time) {
    this.uniforms.uTime.value = time
  }
}
