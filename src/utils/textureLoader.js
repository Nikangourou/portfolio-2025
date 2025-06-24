import * as THREE from 'three'
import { useState, useEffect } from 'react'

/**
 * Hook simple pour charger les textures de contenu
 */
export const useContentTexture = (selectedProject, gridPosition) => {
  const [contentTexture, setContentTexture] = useState(null)

  useEffect(() => {
    const contentImage = selectedProject?.contents?.[0]?.[0]?.image
    
    if (!contentImage || (gridPosition !== 5 && gridPosition !== 6)) {
      setContentTexture(null)
      return
    }

    const loader = new THREE.TextureLoader()
    loader.load(
      contentImage,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace
        texture.minFilter = THREE.LinearFilter
        texture.magFilter = THREE.LinearFilter
        texture.rotation = Math.PI
        texture.center.set(0.5, 0.5)
        texture.repeat.set(0.5, 0.5)
        texture.offset.set(
          gridPosition === 5 ? -0.25 : 0.25,
          0.25
        )
        setContentTexture(texture)
      },
      undefined,
      (error) => {
        console.warn('Error loading content texture:', error)
        setContentTexture(null)
      }
    )
  }, [selectedProject, gridPosition])

  return { contentTexture }
} 