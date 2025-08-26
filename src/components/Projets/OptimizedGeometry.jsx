import { useMemo } from 'react'
import * as THREE from 'three'

// Composant pour géométrie optimisée réutilisable
export const OptimizedPlaneGeometry = ({ width, height }) => {
  const geometry = useMemo(() => {
    return new THREE.PlaneGeometry(width, height)
  }, [width, height])

  return <primitive object={geometry} />
}

// Cache global pour les géométries communes
const geometryCache = new Map()

export const getCachedGeometry = (width, height) => {
  const key = `${width}-${height}`
  
  if (!geometryCache.has(key)) {
    geometryCache.set(key, new THREE.PlaneGeometry(width, height))
  }
  
  return geometryCache.get(key)
}

// Hook pour utiliser les géométries cachées
export const useCachedPlaneGeometry = (width, height) => {
  return useMemo(() => getCachedGeometry(width, height), [width, height])
}
