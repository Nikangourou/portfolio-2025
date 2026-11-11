// Répartition des tuiles dans le nuage de l'accueil :
// - les projets sont posés groupés au centre, sans qu'une carte en recouvre une autre à l'écran ;
// - les tuiles vides et les bordures se répartissent ensuite sur tout l'écran, chacune au point le plus éloigné
//   de celles déjà posées (« best candidate »).

// Profondeur du nuage, de part et d'autre du plan du groupe
const DEPTH_RANGE = 1.5
// Poids de la profondeur dans la distance entre deux points (les écarts en profondeur comptent moins)
const DEPTH_WEIGHT = 0.5
const CANDIDATES_PER_POINT = 24
// Plafond de tirages pour placer les cartes : filet de sécurité si l'écran n'a pas encore de taille valide
const MAX_PLACEMENT_ATTEMPTS = 200000

// Générateur pseudo-aléatoire à graine (mulberry32) : avec la même graine, un redimensionnement de la fenêtre
// reprend la même suite de tirages au lieu de redistribuer toute la scène.
export const createSeededRandom = (seed) => {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6D2B79F5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Échelle des cartes projets sur l'accueil (utilisée aussi par Project.jsx)
export const HOME_CARD_SCALE = 1.4

// Marge minimale entre deux cartes projets à l'écran, en fraction de leur taille
const CARD_GAP = 0.08

// Projets de l'accueil : posés comme sur main (groupés au centre), mais sans qu'une carte en recouvre une autre
// *à l'écran*. Le test se fait sur les rectangles projetés (la perspective grossit les cartes proches). Si une
// carte ne trouve pas de place, la zone de tirage s'élargit au lieu de tolérer un recouvrement.
const generateProjectPositions = (count, camera, distance, cardSize, random) => {
  const tanHalfFov = Math.tan((camera.fov * Math.PI) / 360)
  const groupDepth = Math.abs(distance)
  // Réduit si l'écran est trop étroit (mobile) pour loger toutes les cartes sans recouvrement
  let fit = 1

  // Rectangle de la carte en unités d'écran normalisées (-1..1)
  const project = ([x, y, z]) => {
    const depth = groupDepth - z
    const unitY = depth * tanHalfFov
    const unitX = unitY * camera.aspect
    const cardWidth = cardSize.width * HOME_CARD_SCALE * (1 + CARD_GAP) * fit
    const cardHeight = cardSize.height * HOME_CARD_SCALE * (1 + CARD_GAP) * fit
    return { x: x / unitX, y: y / unitY, halfWidth: cardWidth / 2 / unitX, halfHeight: cardHeight / 2 / unitY }
  }

  const positions = []
  const screenRects = []
  let spread = 1
  let attempts = 0
  let totalAttempts = 0

  // Écran sans taille valide (ratio nul ou non numérique) : rien ne peut être placé
  if (!Number.isFinite(camera.aspect) || camera.aspect <= 0) {
    return Array.from({ length: count }, () => [0, 0, 0])
  }

  while (positions.length < count) {
    if (++totalAttempts > MAX_PLACEMENT_ATTEMPTS) {
      while (positions.length < count) positions.push([0, 0, 0])
      break
    }

    const candidate = [
      (random() * 4 - 2) * spread,
      (random() * 4 - 2) * spread,
      random() * 4 - 2,
    ]
    const rect = project(candidate)
    // Reste dans l'écran
    const isOnScreen = Math.abs(rect.x) + rect.halfWidth <= 0.95 && Math.abs(rect.y) + rect.halfHeight <= 0.95
    const overlaps = screenRects.some((other) => (
      Math.abs(rect.x - other.x) < rect.halfWidth + other.halfWidth &&
      Math.abs(rect.y - other.y) < rect.halfHeight + other.halfHeight
    ))

    attempts++
    if (isOnScreen && !overlaps) {
      positions.push(candidate)
      screenRects.push(rect)
      attempts = 0
    } else if (attempts > 150) {
      attempts = 0
      if (spread < 3) spread = Math.min(spread * 1.08, 3)
      else fit *= 0.94
    }
  }

  return positions
}

// Part de l'écran couverte par les tuiles vides et les bordures dans la disposition « centered »
const FILL_COVERAGE = 0.95

// Les projets sont placés comme sur main (groupés au centre), puis chaque tuile restante
// est posée au point de l'écran visible le plus éloigné de tout ce qui est déjà placé (« best candidate »).
export const generateCloudPositions = (count, camera, distance, projectCount, cardSize, seed = 1) => {
  const random = createSeededRandom(seed)
  const tanHalfFov = Math.tan((camera.fov * Math.PI) / 360)
  const groupDepth = Math.abs(distance)
  const positions = generateProjectPositions(Math.min(projectCount, count), camera, distance, cardSize, random)

  for (let i = positions.length; i < count; i++) {
    let best = null
    let bestScore = -1

    for (let attempt = 0; attempt < CANDIDATES_PER_POINT; attempt++) {
      const z = (random() * 2 - 1) * DEPTH_RANGE
      const halfHeight = (groupDepth - z) * tanHalfFov * FILL_COVERAGE
      const candidate = [
        (random() * 2 - 1) * halfHeight * camera.aspect,
        (random() * 2 - 1) * halfHeight,
        z,
      ]

      let nearest = Infinity
      for (const other of positions) {
        const dx = candidate[0] - other[0]
        const dy = candidate[1] - other[1]
        const dz = (candidate[2] - other[2]) * DEPTH_WEIGHT
        nearest = Math.min(nearest, dx * dx + dy * dy + dz * dz)
      }
      if (nearest > bestScore) {
        bestScore = nearest
        best = candidate
      }
    }

    positions.push(best)
  }

  return positions
}
