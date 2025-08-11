import { useEffect, useCallback, useRef } from 'react'

/**
 * Simple fonction debounce sans dépendance externe
 */
const debounce = (func, delay) => {
  let timeoutId
  return (...args) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func(...args), delay)
  }
}

/**
 * Hook simplifié pour un seul callback avec execution immédiate
 */
export const useResizeCallback = (callback, delay = 100) => {
  const callbackRef = useRef(callback)
  
  // Mettre à jour la ref sans déclencher de re-render
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  const debouncedCallback = useCallback(
    debounce(() => {
      if (callbackRef.current) {
        callbackRef.current()
      }
    }, delay),
    [delay]
  )

  useEffect(() => {
    // Exécuter immédiatement une fois au montage (sans debounce)
    if (callbackRef.current) {
      callbackRef.current()
    }

    // Ajouter le listener avec debounce pour les vrais événements resize
    window.addEventListener('resize', debouncedCallback)
    
    return () => {
      window.removeEventListener('resize', debouncedCallback)
    }
  }, [debouncedCallback])
}

/**
 * Hook centralisé pour gérer plusieurs callbacks (usage avancé)
 */
export const useResize = (callbacks = [], delay = 100) => {
  const callbacksRef = useRef(callbacks)
  
  useEffect(() => {
    callbacksRef.current = callbacks
  }, [callbacks])

  const debouncedResize = useCallback(
    debounce(() => {
      callbacksRef.current.forEach(callback => {
        if (typeof callback === 'function') {
          callback()
        }
      })
    }, delay),
    [delay]
  )

  useEffect(() => {
    // Exécuter immédiatement au montage
    callbacksRef.current.forEach(callback => {
      if (typeof callback === 'function') {
        callback()
      }
    })

    window.addEventListener('resize', debouncedResize)
    
    return () => {
      window.removeEventListener('resize', debouncedResize)
    }
  }, [debouncedResize])
}
