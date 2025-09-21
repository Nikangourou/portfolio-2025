import { config } from '@react-spring/three'


export const optimizedSpringConfigs = {

  smooth: {
    tension: 200,
    friction: 35,
    mass: 0.8,
  },

  arrangement: {
    tension: 200,
    friction: 50,
    mass: 1,
  },

  globalRotation: {
    tension: 280,
    friction: 120,
    mass: 1,
  },

  projectRotation: {
    tension: 100,
    friction: 20,
    mass: 1,
  },

  interaction: {
    tension: 350,
    friction: 40,
    mass: 0.6,
  },

  hover: {
    tension: 400,
    friction: 35,
    mass: 0.5,
  }
}


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
