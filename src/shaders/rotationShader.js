import * as THREE from 'three'

export const rotationVertexShader = `
  uniform float uRotationIntensity;
  uniform float uTime;
  uniform float uProjectIndex;
  uniform float uGlobalRotation;
  uniform float uSide; // 1.0 pour face avant, -1.0 pour face arrière
  uniform vec3 uProjectWorldPosition; // Position du projet dans le groupe
  uniform float uDistanceFromCenter; // Distance du projet au centre du groupe
  
  varying vec2 vUv;
  varying vec3 vPosition;
  varying float vDistortion;
  
  void main() {
    vUv = uv;
    vPosition = position;
    
    vec3 newPosition = position;
    
    // Utiliser l'intensité de rotation avec lissage
    float deformationIntensity = smoothstep(0.0, 2.5, uRotationIntensity);
    
    // Force centrifuge : plus le projet est loin du centre, plus l'effet est fort
    float centrifugalForce = uDistanceFromCenter * 0.01; // Normaliser la distance
    float globalDeformationIntensity = deformationIntensity * (1.0 + centrifugalForce);
    
    // Direction de la force centrifuge basée sur la position du projet
    vec2 centrifugalDirection = normalize(uProjectWorldPosition.xy);
    
    // Déformation radiale (étirement vers l'extérieur) - Force centrifuge
    float radialIntensity = globalDeformationIntensity * 0.3;
    newPosition.x += centrifugalDirection.x * radialIntensity * (position.x * position.x);
    newPosition.y += centrifugalDirection.y * radialIntensity * (position.y * position.y);
    
    // Côté gauche : arrondi convexe (ajouter de la matière)
    if (position.x < -0.1) {
      float normalizedY = position.y / 0.5;
      float distance = abs(normalizedY);
      if (distance <= 1.0) {
        // Transition douce depuis le centre vers le bord
        float edgeFactor = smoothstep(-0.1, -0.4, position.x);
        float curve = sqrt(1.0 - distance * distance) * 0.4 * globalDeformationIntensity * edgeFactor;
        newPosition.x = newPosition.x - curve; // Expansion vers l'extérieur
        
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
        float curve = sqrt(1.0 - distance * distance) * 0.3 * globalDeformationIntensity * edgeFactor;
        newPosition.x = newPosition.x - curve; // Contraction vers l'intérieur
        
        // Ajouter déformation Z pour l'effet concave (vers l'arrière)
        newPosition.z -= curve * 2.5;
      }
    }
    
    // Déformation Z sur tout le projet : simulation de la compression centrifuge
    float verticalDistance = abs(position.y); // Distance depuis le centre vertical (y=0)
    float centerIntensity = 1.0 - smoothstep(0.0, 0.5, verticalDistance); // Transition plus douce
    
    // Effet de compression/décompression basé sur la position dans le groupe
    float compressionFactor = sin(uDistanceFromCenter * 0.5 + uGlobalRotation * 2.0) * 0.5 + 0.5;
    float zDeformation = centerIntensity * globalDeformationIntensity * 0.6 * compressionFactor;
    newPosition.z += zDeformation;
    
    // Effet de vibration due à la force centrifuge pour les projets éloignés
    if (uDistanceFromCenter > 5.0) {
      float vibration = sin(uTime * 20.0 + uProjectIndex) * globalDeformationIntensity * 0.02;
      newPosition += normalize(uProjectWorldPosition) * vibration;
    }
    
    vDistortion = globalDeformationIntensity;
    
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
      uSide: { value: options.isFrontFace ? 1.0 : -1.0 },
      uProjectWorldPosition: { value: new THREE.Vector3(0, 0, 0) },
      uDistanceFromCenter: { value: 0.0 }
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

  updateProjectPosition(worldPosition) {
    this.uniforms.uProjectWorldPosition.value.copy(worldPosition)
    // Calculer la distance depuis le centre (0,0,0)
    const distanceFromCenter = worldPosition.length()
    this.uniforms.uDistanceFromCenter.value = distanceFromCenter
  }

  updateTime(time) {
    this.uniforms.uTime.value = time
  }
}
