import * as THREE from 'three'

// Cache global pour les textures par URL et couleur de fond
const textureCache = new Map()
const MAX_CACHE_SIZE = 100

/**
 * Nettoie le cache quand il devient trop volumineux
 */
const cleanTextureCache = () => {
  if (textureCache.size > MAX_CACHE_SIZE) {
    // Supprimer les 20 entrées les plus anciennes
    const entries = Array.from(textureCache.entries())
    const toDelete = entries.slice(0, 20)
    toDelete.forEach(([key]) => {
      const cachedTexture = textureCache.get(key)
      if (cachedTexture?.texture?.dispose) {
        cachedTexture.texture.dispose()
      }
      textureCache.delete(key)
    })
  }
}

/**
 * Génère une clé unique pour le cache basée sur l'URL, la couleur de fond et optionnellement le projet
 */
const getCacheKey = (imageUrl, backgroundColor, projectId = null) => {
  return projectId ? `${projectId}:${imageUrl}#${backgroundColor}` : `${imageUrl}#${backgroundColor}`
}

/**
 * Clone une texture THREE.js de manière optimisée
 * @param {THREE.Texture} originalTexture - Texture originale à cloner
 * @returns {THREE.Texture} - Texture clonée
 */
const cloneTexture = (originalTexture) => {
  const clonedTexture = originalTexture.clone()
  clonedTexture.needsUpdate = true
  return clonedTexture
}

/**
 * Remplace les pixels transparents d'une image par une couleur de fond (avec cache)
 * @param {string} imageUrl - URL de l'image à traiter
 * @param {string} backgroundColor - Couleur de fond en format hex (#ffffff)
 * @returns {Promise<THREE.Texture>} - Texture modifiée (clonée du cache si disponible)
 */
export const createTextureWithBackground = (imageUrl, backgroundColor = '#ffffff') => {
  const cacheKey = getCacheKey(imageUrl, backgroundColor)
  
  // Vérifier si la texture est déjà en cache
  const cachedEntry = textureCache.get(cacheKey)
  if (cachedEntry) {
    // Retourner un clone de la texture cachée
    return Promise.resolve(cloneTexture(cachedEntry.texture))
  }
  
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    // Créer une image temporaire pour accéder aux pixels
    const img = new Image()
    img.crossOrigin = 'anonymous'
    
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      
      // Dessiner l'image sur le canvas
      ctx.drawImage(img, 0, 0)
      
      // Récupérer les données des pixels
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data
      
      // Couleur de fond (convertir hex en RGB)
      const r = parseInt(backgroundColor.slice(1, 3), 16)
      const g = parseInt(backgroundColor.slice(3, 5), 16)
      const b = parseInt(backgroundColor.slice(5, 7), 16)
      
      // Optimisation : vérifier s'il y a des pixels transparents avant de traiter
      let hasTransparency = false
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 128) {
          hasTransparency = true
          break
        }
      }
      
      // Remplacer les pixels transparents par la couleur de fond uniquement si nécessaire
      if (hasTransparency) {
        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3]
          if (alpha < 128) { // Si le pixel est assez transparent
            data[i] = r     // Rouge
            data[i + 1] = g // Vert
            data[i + 2] = b // Bleu
            data[i + 3] = 255 // Alpha opaque
          }
        }
        // Remettre les données modifiées sur le canvas
        ctx.putImageData(imageData, 0, 0)
      }
      
      // Créer une nouvelle texture à partir du canvas
      const texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.minFilter = THREE.LinearFilter
      texture.magFilter = THREE.LinearFilter
      texture.format = THREE.RGBAFormat
      texture.premultiplyAlpha = false
      
      // Mettre en cache la texture originale
      cleanTextureCache()
      textureCache.set(cacheKey, {
        texture: texture,
        timestamp: Date.now()
      })
      
      // Retourner un clone de la texture pour éviter les conflits de configuration
      resolve(cloneTexture(texture))
    }
    
    img.onerror = reject
    img.src = imageUrl
  })
}

/**
 * Nettoie manuellement le cache des textures (utile lors du changement de projet)
 */
export const clearTextureCache = () => {
  textureCache.forEach((cachedEntry) => {
    if (cachedEntry.texture?.dispose) {
      cachedEntry.texture.dispose()
    }
  })
  textureCache.clear()
}

/**
 * Retourne les statistiques du cache pour le debug
 */
export const getTextureCacheStats = () => {
  return {
    size: textureCache.size,
    keys: Array.from(textureCache.keys())
  }
}

/**
 * Configure une texture avec les paramètres de span et d'offset
 * @param {THREE.Texture} texture - Texture à configurer
 * @param {string} span - Span du contenu (ex: "2-2")
 * @param {Object} validPositions - Positions valides avec offsets
 * @param {string} targetFace - Face cible ('front' ou 'back')
 */
export const configureTexture = (texture, span, validPositions, targetFace) => {
  // Rotation différente selon la face cible
  if (targetFace === 'back') {
    texture.rotation = Math.PI // Rotation de 180° pour la face arrière
  } else {
    texture.rotation = 0 // Pas de rotation pour la face avant
  }

  const spanWidth = parseInt(span.split('-')[0])
  const spanHeight = parseInt(span.split('-')[1])

  // Normaliser la configuration pour tous les spans
  texture.center.set(.5, .5)
  texture.repeat.set(1 / spanWidth, 1 / spanHeight)
  texture.offset.set(
    validPositions.offsetX,
    validPositions.offsetY
  )
} 

// span 3 = 0.5
// span 2 environ 0.67