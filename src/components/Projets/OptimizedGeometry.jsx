import { useMemo } from 'react'
import * as THREE from 'three'

// Composant pour géométrie optimisée réutilisable
export const OptimizedPlaneGeometry = ({ width, height }) => {
  const geometry = useMemo(() => {
    return new THREE.PlaneGeometry(width, height, 32, 32)
  }, [width, height])

  return <primitive object={geometry} />
}

// Cache global pour les géométries communes
const geometryCache = new Map()

export const getCachedGeometry = (width, height) => {
  const key = `${width}-${height}`
  
  if (!geometryCache.has(key)) {
    // Augmenter les subdivisions pour permettre la déformation du shader
    // widthSegments = 32, heightSegments = 32 pour avoir assez de vertices
    geometryCache.set(key, new THREE.PlaneGeometry(width, height, 32, 32))
  }
  
  return geometryCache.get(key)
}

// Hook pour utiliser les géométries cachées
export const useCachedPlaneGeometry = (width, height) => {
  return useMemo(() => getCachedGeometry(width, height), [width, height])
}
