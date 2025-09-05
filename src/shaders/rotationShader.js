import * as THREE from 'three'

export const rotationVertexShader = `
  uniform float uRotationIntensity;
  uniform float uTime;
  uniform float uProjectIndex;
  uniform float uGlobalRotation;
  uniform float uSide; // 1.0 pour face avant, -1.0 pour face arrière
  uniform vec3 uProjectWorldPosition; // Position du projet dans le groupe
  uniform float uDistanceFromCenter; // Distance du projet au centre du groupe
  uniform float uRotationDirection; // Sens de rotation : 1.0 = horaire, -1.0 = anti-horaire
  
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
    
    // Calculer la direction tangentielle (perpendiculaire à la direction radiale)
    // Pour simuler l'effet d'inertie selon le sens de rotation
    vec2 tangentialDirection = vec2(-centrifugalDirection.y, centrifugalDirection.x) * uRotationDirection;
    
    // Déformation radiale (étirement vers l'extérieur) - Force centrifuge
    float radialIntensity = globalDeformationIntensity * 0.3;
    newPosition.x += centrifugalDirection.x * radialIntensity * (position.x * position.x);
    newPosition.y += centrifugalDirection.y * radialIntensity * (position.y * position.y);
    
    // Déformation tangentielle selon le sens de rotation - Effet d'inertie
    float tangentialIntensity = globalDeformationIntensity * 0.2;
    newPosition.x += tangentialDirection.x * tangentialIntensity * abs(position.y);
    newPosition.y += tangentialDirection.y * tangentialIntensity * abs(position.x);
    
    // Côté gauche : arrondi convexe/concave selon le sens de rotation
    if (position.x < -0.1) {
      float normalizedY = position.y / 0.5;
      float distance = abs(normalizedY);
      if (distance <= 1.0) {
        float edgeFactor = smoothstep(-0.1, -0.4, position.x);
        float curve = sqrt(1.0 - distance * distance) * 0.4 * globalDeformationIntensity * edgeFactor;
        
        // Appliquer l'effet selon le sens de rotation sans valeurs négatives
        if (uRotationDirection > 0.0) {
          // Rotation horaire : effet normal
          newPosition.x = newPosition.x - curve;
          newPosition.z += curve * 0.3;
        } else {
          // Rotation anti-horaire : effet réduit mais pas inversé
          newPosition.x = newPosition.x - curve * 0.5;
          newPosition.z += curve * 0.15;
        }
      }
    }
    
    // Côté droit : arrondi concave/convexe selon le sens de rotation
    if (position.x > 0.1) {
      float normalizedY = position.y / 0.5;
      float distance = abs(normalizedY);
      if (distance <= 1.0) {
        float edgeFactor = smoothstep(0.1, 0.4, position.x);
        float curve = sqrt(1.0 - distance * distance) * 0.3 * globalDeformationIntensity * edgeFactor;
        
        // Appliquer l'effet selon le sens de rotation sans valeurs négatives
        if (uRotationDirection > 0.0) {
          // Rotation horaire : effet normal
          newPosition.x = newPosition.x - curve;
          newPosition.z -= curve * 2.5;
        } else {
          // Rotation anti-horaire : effet réduit mais pas inversé
          newPosition.x = newPosition.x - curve * 0.5;
          newPosition.z -= curve * 1.25;
        }
      }
    }
    
    // Déformation Z : compression selon le sens de rotation
    float verticalDistance = abs(position.y);
    float centerIntensity = 1.0 - smoothstep(0.0, 0.5, verticalDistance);
    
    // Effet de compression stable selon le sens de rotation
    float rotationPhase = abs(uGlobalRotation) * 2.0;
    float compressionFactor = sin(uDistanceFromCenter * 0.5 + rotationPhase) * 0.5 + 0.5;
    
    // Ajuster l'intensité selon le sens de rotation sans créer de valeurs négatives
    float directionMultiplier = uRotationDirection > 0.0 ? 1.0 : 0.7;
    float zDeformation = centerIntensity * globalDeformationIntensity * 0.6 * compressionFactor * directionMultiplier;
    newPosition.z += zDeformation;
    
    // Effet de vibration due à la force centrifuge pour les projets éloignés
    if (uDistanceFromCenter > 5.0) {
      float vibrationPhase = uTime * 20.0 + uProjectIndex;
      // Ajuster l'amplitude selon le sens de rotation sans créer d'instabilité
      float vibrationIntensity = globalDeformationIntensity * 0.02 * (uRotationDirection > 0.0 ? 1.0 : 0.5);
      float vibration = sin(vibrationPhase) * vibrationIntensity;
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
      uDistanceFromCenter: { value: 0.0 },
      uRotationDirection: { value: 1.0 }
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

  updateRotation(globalRotation, intensity = 1.0, rotationDirection = 1.0) {
    this.uniforms.uGlobalRotation.value = globalRotation
    this.uniforms.uRotationIntensity.value = intensity
    this.uniforms.uRotationDirection.value = rotationDirection
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
