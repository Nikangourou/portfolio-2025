import * as THREE from 'three'

export const rotationVertexShader = `
  uniform vec2 uFrequency;
  uniform float uTime;
  uniform float uIntensity;
  uniform float uRotationDirection; // 1.0 = horaire, -1.0 = anti-horaire
  uniform float uRotationVelocity; // Vitesse de rotation brute
  uniform vec3 uLocalRotation; // Rotation locale du projet (x, y, z)
  
  varying vec2 vUv;
  varying float vElevation;
  
  void main()
  {
      vec4 modelPosition = modelMatrix * vec4(position, 1.0);

      // Animation de base (douce)
      float baseIntensity = 0.4;
      float totalIntensity = baseIntensity + uIntensity * 0.3;
      
      // Résistance à l'air : effet uniforme sur toute la surface
      float airResistance = uRotationVelocity * 0.3;
      
      // Direction du vent selon la rotation globale
      float windDirection = uRotationDirection;
      
      // Ajustement de la direction du vent selon la rotation locale du projet
      // La rotation Z du projet influence la direction du "vent"
      float localRotationEffect = cos(uLocalRotation.z); // -1 à 1 selon l'orientation
      float adjustedWindDirection = windDirection * localRotationEffect;
      
      // Ondulations de base (ajustées selon l'orientation locale)
      float baseElevation = sin(modelPosition.x * uFrequency.x - uTime + uLocalRotation.z * 0.5) * 0.1 * totalIntensity;
      baseElevation += sin(modelPosition.y * uFrequency.y - uTime + uLocalRotation.x * 0.5) * 0.1 * totalIntensity;
      
      // Déformation par résistance à l'air (toute la surface réagit)
      // Ajustée selon l'orientation du projet
      float airDeformation = sin(modelPosition.x * uFrequency.x * 1.5 + uTime * 2.0 * adjustedWindDirection + uLocalRotation.z) 
                           * 0.06 * airResistance;
      airDeformation += sin(modelPosition.y * uFrequency.y * 1.2 - uTime * 1.5 * adjustedWindDirection + uLocalRotation.x) 
                       * 0.05 * airResistance;
      
      // Effet de turbulence (plus complexe avec la vitesse et orientation locale)
      float turbulence = sin(modelPosition.x * uFrequency.x * 2.0 + modelPosition.y * uFrequency.y + uTime * 3.0 * adjustedWindDirection + uLocalRotation.z * 2.0) 
                        * 0.04 * airResistance * airResistance;
      
      // Combinaison des effets
      float elevation = baseElevation + airDeformation + turbulence;
      
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
      uRotationDirection: { value: 1.0 },
      uRotationVelocity: { value: 0.0 },
      uLocalRotation: { value: new THREE.Vector3(0, 0, 0) },
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

  updateRotation(globalRotation, intensity = 1.0, rotationDirection = 1.0, rotationVelocity = 0.0) {
    // Fréquences plus faibles pour des ondulations plus grandes et espacées
    const baseFrequencyX = 8;
    const baseFrequencyY = 4;
    this.uniforms.uFrequency.value.set(
      baseFrequencyX + (intensity * 0.35),
      baseFrequencyY + (intensity * 0.25)
    );
    this.uniforms.uIntensity.value = intensity;
    this.uniforms.uRotationDirection.value = rotationDirection;
    this.uniforms.uRotationVelocity.value = rotationVelocity;
  }

  updateLocalRotation(localRotation) {
    this.uniforms.uLocalRotation.value.copy(localRotation);
  }

  updateTime(time) {
    this.uniforms.uTime.value = time
  }
}
