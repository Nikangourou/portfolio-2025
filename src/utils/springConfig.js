import { config } from '@react-spring/three'

// Configurations optimisées pour de meilleures performances
export const optimizedSpringConfigs = {
  // Configuration rapide et fluide pour les animations de base
  smooth: {
    tension: 200,
    friction: 35,
    mass: 0.8,
  },
  
  // Configuration pour les animations d'arrangement
  arrangement: {
    tension: 200,
    friction: 50,
    mass: 1,
  },
  
  // Configuration pour la rotation globale (rotation du groupe de projets)
  // Utilisée dans ProjectList pour faire tourner tout le groupe de projets
  globalRotation: {
    tension: 280,
    friction: 120,
    mass: 1,
  },
  
  // Configuration pour la rotation des projets individuels (flip de page)
  // Utilisée dans Project pour l'animation de retournement des cartes
  projectRotation: {
    tension: 100,
    friction: 20,
    mass: 1,
  },
  
  // Configuration pour les interactions rapides
  interaction: {
    tension: 350,
    friction: 40,
    mass: 0.6,
  },
  
  // Configuration pour les effets de hover
  hover: {
    tension: 400,
    friction: 35,
    mass: 0.5,
  }
}

// Utiliser les configurations existantes comme fallback
export const getSpringConfig = (type) => {
  switch (type) {
    case 'smooth':
      return optimizedSpringConfigs.smooth
    case 'arrangement':
      return optimizedSpringConfigs.arrangement
    case 'globalRotation':
      return optimizedSpringConfigs.globalRotation
    case 'projectRotation':
      return optimizedSpringConfigs.projectRotation
    case 'interaction':
      return optimizedSpringConfigs.interaction
    case 'hover':
      return optimizedSpringConfigs.hover
    default:
      return config.default
  }
}
