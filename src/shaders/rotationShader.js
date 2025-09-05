import * as THREE from 'three'

export const rotationVertexShader = `
  uniform float uRotationIntensity;
  uniform float uTime;
  uniform float uProjectIndex;
  uniform float uGlobalRotation;
  uniform float uSide; // 1.0 pour face avant, -1.0 pour face arrière
  
  varying vec2 vUv;
  varying vec3 vPosition;
  varying float vDistortion;
  
  void main() {
    vUv = uv;
    vPosition = position;
    
    vec3 newPosition = position;
    
    // Utiliser l'intensité de rotation avec lissage
    float deformationIntensity = smoothstep(0.0, 2.5, uRotationIntensity);
    
    // Côté gauche : arrondi convexe (ajouter de la matière)
    if (position.x < -0.1) {
      float normalizedY = position.y / 0.5;
      float distance = abs(normalizedY);
      if (distance <= 1.0) {
        // Transition douce depuis le centre vers le bord
        float edgeFactor = smoothstep(-0.1, -0.4, position.x);
        float curve = sqrt(1.0 - distance * distance) * 0.4 * deformationIntensity * edgeFactor;
        newPosition.x = position.x - curve; // Expansion vers l'extérieur
        
        // Ajouter déformation Z pour l'effet convexe (vers l'avant)
        newPosition.z += curve * 0.3;
      }
    }
    
    // Côté droit : arrondi concave (créer un creux)
    if (position.x > 0.1) {
      float normalizedY = position.y / 0.5;
      float distance = abs(normalizedY);
      if (distance <= 1.0) {
        // Transition douce depuis le centre vers le bord
        float edgeFactor = smoothstep(0.1, 0.4, position.x);
        float curve = sqrt(1.0 - distance * distance) * 0.3 * deformationIntensity * edgeFactor;
        newPosition.x = position.x - curve; // Contraction vers l'intérieur
        
        // Ajouter déformation Z pour l'effet concave (vers l'arrière)
        newPosition.z -= curve * 2.5;
      }
    }
    
    // Déformation Z sur tout le projet : plus forte au centre vertical (axe horizontal)
    float verticalDistance = abs(position.y); // Distance depuis le centre vertical (y=0)
    float centerIntensity = 1.0 - verticalDistance * 2.0; // Plus fort au centre (y=0)
    centerIntensity = max(0.0, centerIntensity); // Garder positif
    
    // Déformation Z basée sur la distance du centre vertical pour effet horizontal
    float zDeformation = centerIntensity * deformationIntensity * 0.8;
    newPosition.z += zDeformation;
    
    vDistortion = deformationIntensity;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`

export const rotationFragmentShader = `
  uniform sampler2D uTexture;
  uniform vec3 uColor;
  uniform float uRotationIntensity;
  uniform float uTime;
  uniform float uGlobalRotation;
  uniform bool uHasTexture;
  
  varying vec2 vUv;
  varying vec3 vPosition;
  varying float vDistortion;
  
  void main() {
    vec2 distortedUv = vUv;
    
    vec4 textureColor = vec4(1.0);
    
    if (uHasTexture) {
      textureColor = texture2D(uTexture, distortedUv);
    }
    
    // Mélanger avec la couleur de base
    vec3 finalColor = mix(uColor, textureColor.rgb, textureColor.a);
    
    gl_FragColor = vec4(finalColor, textureColor.a);
  }
`

export class RotationShaderMaterial extends THREE.ShaderMaterial {
  constructor(options = {}) {
    const uniforms = {
      uTexture: { value: options.map || null },
      uColor: { value: new THREE.Color(options.color || 'white') },
      uRotationIntensity: { value: 0.0 },
      uTime: { value: 0.0 },
      uProjectIndex: { value: options.projectIndex || 0 },
      uGlobalRotation: { value: 0.0 },
      uHasTexture: { value: !!options.map },
      uSide: { value: options.isFrontFace ? 1.0 : -1.0 }
    }

    super({
      uniforms,
      vertexShader: rotationVertexShader,
      fragmentShader: rotationFragmentShader,
      side: options.side || THREE.FrontSide,
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
    this.uniforms.uGlobalRotation.value = globalRotation
    this.uniforms.uRotationIntensity.value = intensity
  }

  updateTime(time) {
    this.uniforms.uTime.value = time
  }
}
