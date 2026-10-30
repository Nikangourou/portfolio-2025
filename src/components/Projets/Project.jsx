import { useRef, useState, forwardRef, useCallback, useEffect, useImperativeHandle, useMemo } from 'react'
import * as THREE from 'three'
import { useTexture } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { animated, useSpring } from '@react-spring/three'
import { useStore } from '@/stores/store'
import { useShallow } from 'zustand/react/shallow'
import styles from './Project.module.scss'
import ProjectOverlay from './ProjectOverlay'
import { useContentTexture, useContentText } from '@/utils/contentLoader'
import projectsData from '@/data/projects.json'
import { useProjectPositionsStore } from '@/stores/projectPositionsStore'
import { getCachedGeometry, AnimatedMesh } from './OptimizedGeometry'
import { getSpringConfig } from '@/utils/springConfig'
import { useGridConfig } from '@/hooks/useGridConfig'
import { useGlobalRipple } from '@/hooks/useGlobalRipple'
import { applyProjectRippleShader } from '@/utils/rippleShader'

const TILE_NORMAL = new THREE.Vector3()
const TILE_TO_CAMERA = new THREE.Vector3()
const TILE_POSITION = new THREE.Vector3()

// Décalage (ms) entre le flip de deux tuiles voisines
const PAGE_FLIP_STAGGER_MS = 100

// Contour d'une tuile vide sur l'accueil : un simple trait fin et discret, sans remplissage
// (une tuile pleine masquerait les cartes qui sont derrière).
const FILLER_OUTLINE_COLOR = '#000000'
const FILLER_OUTLINE_OPACITY = 0.2

const ARRANGED_BACK_FACE_FLIP = { x: 0.0, y: 0.0 }
const FREE_BACK_FACE_FLIP = { x: 1.0, y: 1.0 }

const getBackFaceFlip = (isArrangedUvMode) => ({
  // Keep free-mode UV orientation during arrange transition to avoid one-frame upside-down flips.
  x: isArrangedUvMode ? ARRANGED_BACK_FACE_FLIP.x : FREE_BACK_FACE_FLIP.x,
  y: isArrangedUvMode ? ARRANGED_BACK_FACE_FLIP.y : FREE_BACK_FACE_FLIP.y,
})

const getSamplerTexture = (texture) => texture?.userData?.sharedVideoTexture || texture
const getTextureTransform = (texture) => texture?.userData?.contentTransformMatrix || texture?.matrix
const isVideoTexture = (texture) => !!(texture?.userData?.isVideo || texture?.userData?.sharedVideoTexture?.userData?.isVideo)

// Largeur utile d'une cellule d'en-tête (160px - 2 x 14px de marge) et bornes de la taille du titre
const TITLE_MAX_WIDTH = 128
const TITLE_MAX_SIZE = 34
const TITLE_MIN_SIZE = 18

let titleMeasureContext = null

// Plus le titre est court, plus on peut l'écrire grand : on mesure son mot le plus long
// pour qu'il tienne dans la cellule, sans jamais être coupé.
const getTitleFontSize = (title = '') => {
  if (typeof document === 'undefined') return TITLE_MIN_SIZE

  if (!titleMeasureContext) {
    titleMeasureContext = document.createElement('canvas').getContext('2d')
  }

  titleMeasureContext.font = "100px 'Allerta Stencil', sans-serif"
  const longestWordWidth = Math.max(
    ...title.split(/\s+/).map((word) => titleMeasureContext.measureText(word).width),
  )
  if (!longestWordWidth) return TITLE_MIN_SIZE

  const fittingSize = Math.floor((TITLE_MAX_WIDTH / longestWordWidth) * 100)
  return Math.max(TITLE_MIN_SIZE, Math.min(TITLE_MAX_SIZE, fittingSize))
}

// L'accroche de la page 1 tient dans une seule tuile : plus elle est longue, plus on réduit la taille
const getLeadFontSize = (text = '') => {
  if (text.length <= 50) return 17
  if (text.length <= 60) return 15
  return 14
}

const drawNavigationIcon = (context, size, type) => {
  const center = size / 2
  context.lineCap = 'square'
  context.lineJoin = 'miter'

  if (type === 'cross') {
    const arm = size * 0.31
    context.lineWidth = Math.round(size * 0.055)
    context.beginPath()
    context.moveTo(center - arm, center - arm)
    context.lineTo(center + arm, center + arm)
    context.moveTo(center + arm, center - arm)
    context.lineTo(center - arm, center + arm)
    context.stroke()
    return
  }

  context.save()
  context.translate(center, center)
  if (type === 'arrow-down') {
    context.rotate(Math.PI)
  }

  context.lineWidth = Math.round(size * 0.05)
  const arrowScale = 1.24
  const headHalfWidth = size * 0.245 * arrowScale
  const headTopY = -size * 0.23 * arrowScale
  const headBottomY = -size * 0.01 * arrowScale
  const shaftBottomY = size * 0.27 * arrowScale
  const shaftStartY = headTopY + (context.lineWidth * 0.2)

  context.beginPath()
  context.moveTo(-headHalfWidth, headBottomY)
  context.lineTo(0, headTopY)
  context.lineTo(headHalfWidth, headBottomY)
  context.stroke()

  context.beginPath()
  context.moveTo(0, shaftStartY)
  context.lineTo(0, shaftBottomY)
  context.stroke()
  context.restore()
}

const createNavigationIconTexture = (type, color, backgroundColor) => {
  if (typeof document === 'undefined') {
    return null
  }

  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')

  if (!context) {
    return null
  }

  context.clearRect(0, 0, size, size)
  context.fillStyle = backgroundColor
  context.fillRect(0, 0, size, size)
  context.strokeStyle = color
  drawNavigationIcon(context, size, type)

  const iconTexture = new THREE.CanvasTexture(canvas)
  iconTexture.colorSpace = THREE.SRGBColorSpace
  iconTexture.minFilter = THREE.LinearMipmapLinearFilter
  iconTexture.magFilter = THREE.LinearFilter
  iconTexture.anisotropy = 4
  iconTexture.needsUpdate = true
  return iconTexture
}

const getNavigationIconTypeForPage = ({
  selectedProject,
  page,
  maxPage,
  gridPosition,
  gridConfig,
}) => {
  if (!selectedProject || !page || page < 1) {
    return null
  }

  if (gridPosition === gridConfig.crossPosition) {
    return 'cross'
  }

  if (maxPage <= 1) {
    return null
  }

  if (gridPosition === gridConfig.arrowUpPosition && page > 1) {
    return 'arrow-up'
  }

  if (gridPosition === gridConfig.arrowDownPosition && page < maxPage) {
    return 'arrow-down'
  }

  return null
}

const Project = forwardRef(function Project(
  { gridPosition, image, initialPosition, initialRotation, isFiller = false },
  ref,
) {
  const pageMaterialRef = useRef(null)
  const projectRef = useRef(null)
  const pageGroupRef = useRef(null)
  const previousCurrentPageRef = useRef(1)
  const lastVisiblePageMapRef = useRef(null)
  const isPageFlipAnimatingRef = useRef(false)
  const lockedOppositeMapRef = useRef(null)
  const [overlayPage, setOverlayPage] = useState(0)
  const gridConfig = useGridConfig()
  // Tuile vide (pas de projet derrière) : invisible sur l'accueil, elle rejoint les projets au clic et suit
  // exactement la même animation. Elle ne s'affiche qu'une fois la couleur du projet appliquée à ses deux faces,
  // sinon on verrait une frame blanche.
  const [isFillerReady, setIsFillerReady] = useState(false)

  const emptyTexture = useMemo(() => {
    const data = new Uint8Array([255, 255, 255, 255])
    const placeholder = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat)
    placeholder.colorSpace = THREE.SRGBColorSpace
    placeholder.needsUpdate = true
    return placeholder
  }, [])

  useEffect(() => {
    return () => {
      emptyTexture.dispose()
    }
  }, [emptyTexture])

  const rippleUniforms = useMemo(() => ({
    uRippleCursor: { value: new THREE.Vector2(999, 999) },
    uRippleStrength: { value: 0 },
    uRippleTint: { value: new THREE.Color('#eef4ff') },
    uFrontMap: { value: emptyTexture },
    uBackMap: { value: emptyTexture },
    uFrontMapIsVideo: { value: 0 },
    uBackMapIsVideo: { value: 0 },
    uBackFlipX: { value: 1.0 },
    uBackFlipY: { value: 0.0 },
    uFrontMapTransform: { value: new THREE.Matrix3() },
    uBackMapTransform: { value: new THREE.Matrix3() },
    uTime: { value: 0 },
  }), [emptyTexture])

  // Exposer la ref du groupe principal pour le raycasting
  useImperativeHandle(ref, () => projectRef.current, [])

  const texture = useTexture(image || '', (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
  })

  const [
    selectedProject,
    currentPage,
    isArrangementAnimationComplete,
    isProjectsArranged,
  ] = useStore(
    useShallow((state) => [
      state.selectedProject,
      state.currentPage,
      state.isArrangementAnimationComplete,
      state.isProjectsArranged,
    ]),
  )

  useEffect(() => {
    if (!isProjectsArranged) {
      setOverlayPage(currentPage || 0)
      return
    }

    if (isArrangementAnimationComplete && overlayPage <= 0 && currentPage > 0) {
      setOverlayPage(currentPage)
    }
  }, [isProjectsArranged, isArrangementAnimationComplete, currentPage, overlayPage])
  const [
    setProjectsArranged,
    setSelectedProject,
    setArrangementAnimationComplete,
    resetProjectState,
    setCurrentPage,
  ] = useStore(
    useShallow((state) => [
      state.setProjectsArranged,
      state.setSelectedProject,
      state.setArrangementAnimationComplete,
      state.resetProjectState,
      state.setCurrentPage,
    ]),
  )

  const backgroundFallbackTexture = useMemo(() => {
    const data = new Uint8Array([255, 255, 255, 255])
    const fallback = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat)
    fallback.colorSpace = THREE.SRGBColorSpace
    fallback.needsUpdate = true
    return fallback
  }, [])

  useEffect(() => {
    const hexColor = selectedProject?.color?.background || '#ffffff'
    const data = backgroundFallbackTexture.image?.data

    if (!data || data.length < 4) {
      return
    }

    const normalizedHex = /^#[0-9a-fA-F]{6}$/.test(hexColor) ? hexColor : '#ffffff'
    const red = parseInt(normalizedHex.slice(1, 3), 16)
    const green = parseInt(normalizedHex.slice(3, 5), 16)
    const blue = parseInt(normalizedHex.slice(5, 7), 16)

    data[0] = red
    data[1] = green
    data[2] = blue
    data[3] = 255
    backgroundFallbackTexture.needsUpdate = true
  }, [selectedProject?.color?.background, backgroundFallbackTexture])

  // Obtenir les positions d'arrangement directement depuis le store
  const { predefinedPositions, projectSize } = useProjectPositionsStore()

  // Position cible pour l'arrangement (memoized)
  const targetArrangedPosition = useMemo(() => {
    return predefinedPositions[gridPosition] || [0, 0, 0]
  }, [predefinedPositions, gridPosition])

  const applyPressureRippleShader = useCallback((material) => {
    applyProjectRippleShader(material, rippleUniforms)
  }, [rippleUniforms])

  // Tuile dont l'arrivée signale la fin du rangement : la dernière, hors colonne centrale
  // (sa position x vaut 0, ce qui empêcherait de mesurer la progression)
  const completionTileIndex = useMemo(() => {
    const centerCol = gridConfig.cols % 2 === 1 ? (gridConfig.cols - 1) / 2 : -1
    for (let i = gridConfig.tileCount - 1; i >= 0; i--) {
      if (i % gridConfig.cols !== centerCol) return i
    }
    return 0
  }, [gridConfig.cols, gridConfig.tileCount])

  // Delays précalculés pour éviter les recalculs
  const animationDelays = useMemo(() => ({
    arrangement: isProjectsArranged ? gridPosition * 50 : Math.random() * 500,
    pageRotation: gridPosition * PAGE_FLIP_STAGGER_MS
  }), [gridPosition, isProjectsArranged])

  // Gestion des positions et rotations avec springs - OPTIMISÉE
  const { position, rotation } = useSpring({
    from: { position: [0, 0, 20], rotation: [0, 0, 0] }, // Commencer à l'origine pour tous les projets
    to: {
      position: isProjectsArranged ? targetArrangedPosition : (initialPosition || [0, 0, 0]),
      rotation: isProjectsArranged ? [0, 0, 0] : (initialRotation || [0, 0, 0])
    },
    delay: animationDelays.arrangement,
    config: isProjectsArranged ? getSpringConfig('arrangement') : getSpringConfig('smooth'),
    onChange: (values) => {
      // Marquer l'animation comme terminée à la moitié pour le dernier projet - OPTIMISÉ
      if (isProjectsArranged && gridPosition === completionTileIndex && targetArrangedPosition[0] !== 0) {
        const progress = Math.abs(values.value.position[0] / targetArrangedPosition[0]);
        if (progress >= 0.7 && !isArrangementAnimationComplete) {
          setArrangementAnimationComplete(true);
        }
      }
    }
  })

  // Spring pour la rotation de page individuelle - OPTIMISÉE
  const { pageRotationX } = useSpring({
    pageRotationX: isProjectsArranged ? currentPage * Math.PI : 0,
    delay: isProjectsArranged ? animationDelays.pageRotation : 0,
    immediate: !isProjectsArranged,
    config: getSpringConfig('projectRotation'),
    onStart: () => {
      isPageFlipAnimatingRef.current = true
    },
    onRest: () => {
      isPageFlipAnimatingRef.current = false
      // Resynchroniser sur l'angle réel (et non sur la page cible, qui peut déjà avoir changé si on a
      // cliqué pendant que cette animation finissait de se stabiliser).
      syncOverlayPageWithCamera()
    },
  })

  // Le texte change quand la tuile est réellement de chant pour la caméra (et non à 90° de rotation :
  // une tuile au-dessus ou en dessous de l'axe de la caméra est de chant à un autre angle).
  const camera = useThree((state) => state.camera)
  const syncOverlayPageWithCamera = () => {
    const group = pageGroupRef.current
    if (!isProjectsArranged || !group) {
      return
    }

    group.updateWorldMatrix(true, false)
    const elements = group.matrixWorld.elements
    TILE_NORMAL.set(elements[8], elements[9], elements[10]).normalize()
    TILE_TO_CAMERA
      .setFromMatrixPosition(camera.matrixWorld)
      .sub(TILE_POSITION.setFromMatrixPosition(group.matrixWorld))

    const frontFaceVisible = TILE_NORMAL.dot(TILE_TO_CAMERA) > 0
    const turns = pageRotationX.get() / Math.PI
    let visiblePage = Math.round(turns)
    // Page paire = face avant visible, impaire = face arrière : on prend l'entier de bonne parité le plus proche.
    if ((visiblePage % 2 === 0) !== frontFaceVisible) {
      visiblePage += turns > visiblePage ? 1 : -1
    }

    if (visiblePage > 0) {
      setOverlayPage(visiblePage)
    }
  }
  useFrame(() => {
    if (isPageFlipAnimatingRef.current) {
      syncOverlayPageWithCamera()
    }
  })

  // Utiliser les hooks personnalisés
  const {
    contentTexture: currentPageTexture,
    targetFace,
  } = useContentTexture(
    gridPosition,
    currentPage || null,
  )
  const previousPage = currentPage > 1 ? currentPage - 1 : null
  const previousFace = targetFace === 'front' ? 'back' : 'front'
  const { contentTexture: previousPageTexture } = useContentTexture(
    gridPosition,
    previousPage,
    previousFace,
  )
  const maxPage = selectedProject?.contents?.length || 0
  const navigationCurrentIconType = useMemo(() => {
    return getNavigationIconTypeForPage({
      selectedProject,
      page: currentPage,
      maxPage,
      gridPosition,
      gridConfig,
    })
  }, [selectedProject, currentPage, maxPage, gridPosition, gridConfig])
  const navigationCurrentTexture = useMemo(() => {
    if (!navigationCurrentIconType) {
      return null
    }

    const iconColor = selectedProject?.color?.text || '#000000'
    const backgroundColor = selectedProject?.color?.background || '#ffffff'
    return createNavigationIconTexture(navigationCurrentIconType, iconColor, backgroundColor)
  }, [navigationCurrentIconType, selectedProject?.color?.text, selectedProject?.color?.background])
  const navigationPreviousIconType = useMemo(() => {
    if (!previousPage) {
      return null
    }

    return getNavigationIconTypeForPage({
      selectedProject,
      page: previousPage,
      maxPage,
      gridPosition,
      gridConfig,
    })
  }, [selectedProject, previousPage, maxPage, gridPosition, gridConfig])
  const navigationPreviousTexture = useMemo(() => {
    if (!navigationPreviousIconType) {
      return null
    }

    const iconColor = selectedProject?.color?.text || '#000000'
    const backgroundColor = selectedProject?.color?.background || '#ffffff'
    return createNavigationIconTexture(navigationPreviousIconType, iconColor, backgroundColor)
  }, [navigationPreviousIconType, selectedProject?.color?.text, selectedProject?.color?.background])

  useEffect(() => {
    return () => {
      navigationCurrentTexture?.dispose?.()
      navigationPreviousTexture?.dispose?.()
    }
  }, [navigationCurrentTexture, navigationPreviousTexture])

  const { contentText } = useContentText(gridPosition, overlayPage || null)

  useEffect(() => {
    if (pageMaterialRef.current) {
      applyPressureRippleShader(pageMaterialRef.current)
    }
  }, [applyPressureRippleShader])

  useGlobalRipple({
    targetRef: pageGroupRef,
    projectSize,
    rippleUniforms,
  })

  // Quand le projet se ferme, la tuile vide redevient invisible
  useEffect(() => {
    if (isFiller && !isProjectsArranged) {
      setIsFillerReady(false)
    }
  }, [isFiller, isProjectsArranged])

  const handleMeshClick = () => {

    // Navigation - Cross
    if (gridPosition === gridConfig.crossPosition && selectedProject) {
      resetProjectState()
      return
    }

    // Navigation - Arrow Up
    if (gridPosition === gridConfig.arrowUpPosition && selectedProject && currentPage > 1) {
      setCurrentPage(currentPage - 1)
      return
    }

    // Navigation - Arrow Down
    if (gridPosition === gridConfig.arrowDownPosition && selectedProject && currentPage < maxPage) {
      setCurrentPage(currentPage + 1)
      return
    }

    // Logique de sélection du projet (pour toutes les autres positions)
    const project = projectsData.projects[gridPosition]
    if (!isProjectsArranged && project) {
      setProjectsArranged(true)
      setSelectedProject(project)
    }
  }

  // Optimiser le useEffect pour éviter les re-renders inutiles
  useEffect(() => {
    if (!pageMaterialRef.current) return

    const material = pageMaterialRef.current
    const isArrangedUvMode = isProjectsArranged && isArrangementAnimationComplete
    const backFaceFlip = getBackFaceFlip(isArrangedUvMode)
    const shouldUseContentMaps = (
      isProjectsArranged &&
      isArrangementAnimationComplete &&
      currentPage > 0
    )
    const isNavigationTile = (
      gridPosition === gridConfig.crossPosition ||
      gridPosition === gridConfig.arrowUpPosition ||
      gridPosition === gridConfig.arrowDownPosition
    )
    const shouldUseNavigationMap = shouldUseContentMaps && isNavigationTile
    const shouldUseBackOnlyNavigation = (
      currentPage === 1 &&
      isNavigationTile
    )
    const fallbackContentMap = backgroundFallbackTexture || emptyTexture
    const nextColor = 'white'
    // Une tuile vide n'a pas de couverture : elle prend la couleur du projet ouvert dès son arrivée,
    // sinon sa face blanche reste visible jusqu'à son retournement (les dernières tuiles sont les plus tardives).
    const baseMap = isFiller ? fallbackContentMap : (texture || emptyTexture)
    const coverOrFallbackMap = isFiller ? fallbackContentMap : (texture || fallbackContentMap)
    const previousPageValue = previousCurrentPageRef.current
    const pageChanged = currentPage !== previousPageValue
    let nextFrontMap = baseMap
    let nextBackMap = baseMap

    if (pageChanged) {
      lockedOppositeMapRef.current = lastVisiblePageMapRef.current || coverOrFallbackMap
      previousCurrentPageRef.current = currentPage
    }

    if (shouldUseNavigationMap) {
      if (shouldUseBackOnlyNavigation) {
        nextFrontMap = fallbackContentMap
        nextBackMap = navigationCurrentTexture || fallbackContentMap
      } else {
        const currentMap = navigationCurrentTexture || fallbackContentMap
        const settledOppositeMap = navigationPreviousTexture || fallbackContentMap
        const transitionOppositeMap = lockedOppositeMapRef.current || settledOppositeMap
        const shouldUseTransitionOpposite = !!lockedOppositeMapRef.current || pageChanged || isPageFlipAnimatingRef.current
        const oppositeMap = shouldUseTransitionOpposite
          ? transitionOppositeMap
          : settledOppositeMap

        if (targetFace === 'front') {
          nextFrontMap = currentMap
          nextBackMap = oppositeMap
        } else {
          nextFrontMap = oppositeMap
          nextBackMap = currentMap
        }
      }

      lastVisiblePageMapRef.current = navigationCurrentTexture || fallbackContentMap
    } else if (shouldUseContentMaps) {
      const currentMap = currentPageTexture || fallbackContentMap
      const settledOppositeMap = previousPage
        ? (previousPageTexture || fallbackContentMap)
        : coverOrFallbackMap
      const transitionOppositeMap = lockedOppositeMapRef.current || settledOppositeMap
      const shouldUseTransitionOpposite = !!lockedOppositeMapRef.current || pageChanged || isPageFlipAnimatingRef.current
      const oppositeMap = shouldUseTransitionOpposite
        ? transitionOppositeMap
        : settledOppositeMap

      if (targetFace === 'front') {
        nextFrontMap = currentMap
        nextBackMap = oppositeMap
      } else {
        nextFrontMap = oppositeMap
        nextBackMap = currentMap
      }

      // Keep the map that is actually displayed for this page (image or fallback).
      // This avoids reusing a stale older-page texture on the next transition.
      lastVisiblePageMapRef.current = currentMap
    }

    nextFrontMap.updateMatrix()
    nextBackMap.updateMatrix()

    const nextFrontSampler = getSamplerTexture(nextFrontMap)
    const nextBackSampler = getSamplerTexture(nextBackMap)
    const nextFrontTransform = getTextureTransform(nextFrontMap)
    const nextBackTransform = getTextureTransform(nextBackMap)
    const nextFrontIsVideo = isVideoTexture(nextFrontMap)
    const nextBackIsVideo = isVideoTexture(nextBackMap)

    material.userData.frontMap = nextFrontSampler
    material.userData.backMap = nextBackSampler
    rippleUniforms.uFrontMap.value = nextFrontSampler
    rippleUniforms.uBackMap.value = nextBackSampler
    rippleUniforms.uFrontMapIsVideo.value = nextFrontIsVideo ? 1 : 0
    rippleUniforms.uBackMapIsVideo.value = nextBackIsVideo ? 1 : 0
    rippleUniforms.uBackFlipX.value = backFaceFlip.x
    rippleUniforms.uBackFlipY.value = backFaceFlip.y
    rippleUniforms.uFrontMapTransform.value.copy(nextFrontTransform)
    rippleUniforms.uBackMapTransform.value.copy(nextBackTransform)

    if (material.userData.shader) {
      const { uniforms } = material.userData.shader

      if (uniforms.uFrontMap) {
        uniforms.uFrontMap.value = nextFrontSampler
      }
      if (uniforms.uBackMap) {
        uniforms.uBackMap.value = nextBackSampler
      }
      if (uniforms.uFrontMapIsVideo) {
        uniforms.uFrontMapIsVideo.value = nextFrontIsVideo ? 1 : 0
      }
      if (uniforms.uBackMapIsVideo) {
        uniforms.uBackMapIsVideo.value = nextBackIsVideo ? 1 : 0
      }
      if (uniforms.uBackFlipX) {
        uniforms.uBackFlipX.value = backFaceFlip.x
      }
      if (uniforms.uBackFlipY) {
        uniforms.uBackFlipY.value = backFaceFlip.y
      }
      if (uniforms.uFrontMapTransform) {
        uniforms.uFrontMapTransform.value.copy(nextFrontTransform)
      }
      if (uniforms.uBackMapTransform) {
        uniforms.uBackMapTransform.value.copy(nextBackTransform)
      }
    }

    material.color.set(nextColor)

    // Les textures sont affectées : la tuile vide peut maintenant s'afficher sans flash blanc
    if (isFiller && isProjectsArranged) {
      setIsFillerReady(true)
    }

    if (!shouldUseContentMaps && !shouldUseNavigationMap) {
      lastVisiblePageMapRef.current = coverOrFallbackMap
    }
  }, [
    isArrangementAnimationComplete,
    isProjectsArranged,
    texture,
    currentPageTexture,
    previousPageTexture,
    previousPage,
    targetFace,
    currentPage,
    emptyTexture,
    backgroundFallbackTexture,
    navigationCurrentTexture,
    navigationPreviousTexture,
    gridPosition,
    gridConfig,
    rippleUniforms,
    isFiller,
  ])

  useEffect(() => {
    return () => {
      backgroundFallbackTexture.dispose()
    }
  }, [backgroundFallbackTexture])

  // Tuile vide : contour sur l'accueil, tuile pleine (couleur du projet) une fois le projet ouvert
  const isFillerTileShown = isFiller && isProjectsArranged && isFillerReady
  const fillerOutlineGeometry = useMemo(() => {
    if (!isFiller) return null
    const halfWidth = projectSize.width / 2
    const halfHeight = projectSize.height / 2
    return new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-halfWidth, -halfHeight, 0),
      new THREE.Vector3(halfWidth, -halfHeight, 0),
      new THREE.Vector3(halfWidth, halfHeight, 0),
      new THREE.Vector3(-halfWidth, halfHeight, 0),
    ])
  }, [isFiller, projectSize.width, projectSize.height])

  useEffect(() => {
    return () => {
      fillerOutlineGeometry?.dispose()
    }
  }, [fillerOutlineGeometry])


  return (
    <animated.group
      ref={projectRef}
      position={position}
      rotation={rotation}
    >
      {isFiller && !isFillerTileShown && (
        <lineLoop geometry={fillerOutlineGeometry}>
          <lineBasicMaterial
            color={FILLER_OUTLINE_COLOR}
            transparent
            opacity={FILLER_OUTLINE_OPACITY}
            depthWrite={false}
          />
        </lineLoop>
      )}
      <animated.group
        ref={pageGroupRef}
        rotation-x={pageRotationX}
        visible={isFillerTileShown || !isFiller}
      >
        <AnimatedMesh
          projectId={gridPosition}
          onClick={handleMeshClick}
        >
          {/* Géométrie partagée (jamais clonée au rendu : un clone par rendu fuyait côté GPU) */}
          <mesh geometry={getCachedGeometry()} dispose={null}>
            <meshBasicMaterial
              ref={pageMaterialRef}
              map={emptyTexture}
              side={THREE.DoubleSide}
              toneMapped={true}
              onUpdate={(material) => {
                if (!material.userData.shaderSetup) {
                  applyPressureRippleShader(material)
                  material.userData.shaderSetup = true
                }
              }}
            />
          </mesh>
          <group>
            {isArrangementAnimationComplete && (
              <>
                {overlayPage === 1 && selectedProject && (
                  <>
                    <ProjectOverlay
                      condition={gridPosition === 0 && selectedProject.title}
                      projectSize={projectSize}
                      page={overlayPage}
                    >
                      <div className={styles.cell}>
                        <p
                          className={`${styles.cellValue} ${styles.cellTitle}`}
                          style={{ fontSize: `${getTitleFontSize(selectedProject.title)}px` }}
                          data-overlay-interactive="true"
                        >
                          {selectedProject.title}
                        </p>
                      </div>
                    </ProjectOverlay>
                    <ProjectOverlay
                      condition={gridPosition === 1 && selectedProject.context}
                      projectSize={projectSize}
                      page={overlayPage}
                    >
                      <div className={styles.cell}>
                        <p className={styles.cellLabel}>Context</p>
                        <p className={styles.cellValue} data-overlay-interactive="true">{selectedProject.context}</p>
                      </div>
                    </ProjectOverlay>
                    <ProjectOverlay
                      condition={gridPosition === 2 && selectedProject.year}
                      projectSize={projectSize}
                      page={overlayPage}
                    >
                      <div className={styles.cell}>
                        <p className={styles.cellLabel}>Year</p>
                        <p className={styles.cellValue} data-overlay-interactive="true">{selectedProject.year}</p>
                      </div>
                    </ProjectOverlay>
                    <ProjectOverlay
                      condition={gridPosition === 3 && selectedProject.technologies}
                      projectSize={projectSize}
                      page={overlayPage}
                    >
                      <div className={styles.cell}>
                        <p className={styles.cellLabel}>Stack</p>
                        <div className={styles.technoContainer}>
                          {selectedProject.technologies.map((techno) => (
                            <p
                              key={techno}
                              className={styles.techno}
                              style={{ fontSize: selectedProject.technologies.length > 3 ? '14px' : '17px' }}
                              data-overlay-interactive="true"
                            >
                              {techno}
                            </p>
                          ))}
                        </div>
                      </div>
                    </ProjectOverlay>
                    <ProjectOverlay
                      condition={gridPosition === 4 && selectedProject.link}
                      projectSize={projectSize}
                      page={overlayPage}
                    >
                      <div className={styles.cell}>
                        <p className={styles.cellLabel}>Link</p>
                        <a
                          href={selectedProject.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.linkButton}
                          data-overlay-interactive="true"
                        >
                          <span className={styles.linkButtonLabel} data-overlay-interactive="true">
                            {selectedProject.linkLabel || 'Visit'} ↗
                          </span>
                        </a>
                      </div>
                    </ProjectOverlay>
                    <ProjectOverlay
                      condition={gridPosition === (gridConfig.isMobile ? 5 : 8) && selectedProject.role}
                      projectSize={projectSize}
                      page={overlayPage}
                    >
                      <div className={styles.cell}>
                        <p className={styles.cellLabel}>Role</p>
                        <p className={`${styles.cellValue} ${styles.cellRole}`} data-overlay-interactive="true">
                          {selectedProject.role}
                        </p>
                      </div>
                    </ProjectOverlay>
                  </>
                )}
                {contentText && (
                  <ProjectOverlay
                    condition={selectedProject}
                    projectSize={projectSize}
                    page={overlayPage}
                  >
                    <div
                      className={`${styles.contentText} ${contentText.lead ? styles.contentTextLead : ''}`}
                      style={contentText.lead ? { fontSize: `${getLeadFontSize(contentText.text)}px` } : undefined}
                    >
                      {contentText.label && <p className={styles.cellLabel}>{contentText.label}</p>}
                      <p className={styles.contentTextValue} data-overlay-interactive="true">{contentText.text}</p>
                    </div>
                  </ProjectOverlay>
                )}
              </>
            )}
          </group>
        </AnimatedMesh>
      </animated.group>
    </animated.group>
  )
})

export default Project