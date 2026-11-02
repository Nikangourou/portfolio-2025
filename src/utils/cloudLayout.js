// Répartition des tuiles dans le nuage de l'accueil : une bande en diagonale, du bas à gauche vers le haut à droite.
//
// - Les projets sont posés le long de la diagonale, dans l'ordre de la liste (le premier en bas à gauche,
//   le dernier en haut à droite), en alternant de part et d'autre de la ligne.
// - Les tuiles vides et les bordures se répartissent ensuite dans la bande autour de la diagonale, chacune
//   au point le plus éloigné de celles déjà posées (« best candidate »).

// Dispositions disponibles. On en change avec le paramètre d'URL `?layout=...`.
//  - diagonal   : bande du bas à gauche vers le haut à droite
//  - horizontal : bande au milieu de l'écran, de gauche à droite
//  - uniform    : répartition régulière sur toute la zone visible
//  - grid       : grille régulière (rangées et colonnes) avec un peu de profondeur
//  - spiral     : spirale du centre vers l'extérieur, les projets d'abord (donc au centre)
//  - centered   : projets groupés au centre (comme main), tuiles vides et bordures réparties sur tout l'écran
//  - original   : celle de main : tirage aléatoire dans un cube fixe de ±2, sans lien avec l'écran
//  - arranged   : les tuiles partent de leur place finale (celle de la page projet) : voir projectPositionsStore
// Les deux bandes posent les projets dans l'ordre de la liste, en alternant de part et d'autre de la ligne.
export const CLOUD_LAYOUTS = ['centered', 'diagonal', 'horizontal', 'uniform', 'grid', 'spiral', 'original', 'arranged']
const DEFAULT_LAYOUT = 'centered'

export const getCloudLayout = () => {
  if (typeof window === 'undefined') return DEFAULT_LAYOUT
  const requested = new URLSearchParams(window.location.search).get('layout')
  return CLOUD_LAYOUTS.includes(requested) ? requested : DEFAULT_LAYOUT
}

// Part de la longueur de la ligne (ou de l'écran) utilisée : on laisse une marge pour ne pas couper les cartes
const LINE_COVERAGE = { diagonal: 0.78, horizontal: 0.8 }
const UNIFORM_COVERAGE = 0.7
// Demi-largeur de la bande, en hauteurs d'écran
const BAND_HALF_WIDTH = { diagonal: 0.32, horizontal: 0.3 }
// Profondeur du nuage, de part et d'autre du plan du groupe
const DEPTH_RANGE = 1.5
// Poids de la profondeur dans la distance entre deux points (les écarts en profondeur comptent moins)
const DEPTH_WEIGHT = 0.5
const CANDIDATES_PER_POINT = 24

// Disposition de main : chaque point est tiré dans un cube de ±2, en gardant une distance minimale avec les
// points déjà posés (qui diminue de 10 % chaque fois que 100 tirages de suite échouent).
const generateOriginalPositions = (count) => {
  const positions = []
  let minDistance = 2.0

  for (let i = 0; i < count; i++) {
    let attempts = 0
    let position
    do {
      position = [Math.random() * 4 - 2, Math.random() * 4 - 2, Math.random() * 4 - 2]
      attempts++
      if (attempts > 100) {
        minDistance *= 0.9
        attempts = 0
      }
    } while (positions.some((other) => Math.hypot(
      position[0] - other[0], position[1] - other[1], position[2] - other[2],
    ) < minDistance))
    positions.push(position)
  }

  return positions
}

// Part de l'écran couverte par les tuiles vides et les bordures dans la disposition « centered »
const FILL_COVERAGE = 0.95

// Disposition « centered » : les projets sont placés comme sur main (groupés au centre), puis chaque tuile restante
// est posée au point de l'écran visible le plus éloigné de tout ce qui est déjà placé (« best candidate »).
const generateCenteredPositions = (count, camera, distance, projectCount) => {
  const tanHalfFov = Math.tan((camera.fov * Math.PI) / 360)
  const groupDepth = Math.abs(distance)
  const positions = generateOriginalPositions(Math.min(projectCount, count))

  for (let i = positions.length; i < count; i++) {
    let best = null
    let bestScore = -1

    for (let attempt = 0; attempt < CANDIDATES_PER_POINT; attempt++) {
      const z = (Math.random() * 2 - 1) * DEPTH_RANGE
      const halfHeight = (groupDepth - z) * tanHalfFov * FILL_COVERAGE
      const candidate = [
        (Math.random() * 2 - 1) * halfHeight * camera.aspect,
        (Math.random() * 2 - 1) * halfHeight,
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

export const generateCloudPositions = (count, camera, distance, orderedCount = 0, layout = getCloudLayout()) => {
  if (layout === 'original') {
    return generateOriginalPositions(count)
  }

  if (layout === 'centered') {
    return generateCenteredPositions(count, camera, distance, orderedCount)
  }

  const fov = camera.fov * (Math.PI / 180)
  const aspect = camera.aspect
  const groupDepth = Math.abs(distance)

  // Espace « métrique » de l'écran : x est multiplié par le ratio, pour que les distances soient les mêmes
  // en x et en y. L'écran va de (-aspect, -1) à (aspect, 1).
  // bandPoint(t, s, w) : t le long de la forme (0 à 1), s en travers (-1 à 1), w en profondeur (-1 à 1).
  let bandPoint
  if (layout === 'uniform' || layout === 'grid' || layout === 'spiral') {
    bandPoint = (t, s, w) => [
      (t * 2 - 1) * aspect * UNIFORM_COVERAGE,
      s * UNIFORM_COVERAGE,
      w,
    ]
  } else {
    const coverage = LINE_COVERAGE[layout]
    const halfWidth = BAND_HALF_WIDTH[layout]
    const start = layout === 'horizontal' ? [-aspect * coverage, 0] : [-aspect * coverage, -coverage]
    const end = layout === 'horizontal' ? [aspect * coverage, 0] : [aspect * coverage, coverage]
    const delta = [end[0] - start[0], end[1] - start[1]]
    const length = Math.hypot(delta[0], delta[1])
    const perpendicular = [-delta[1] / length, delta[0] / length]
    bandPoint = (t, s, w) => [
      start[0] + delta[0] * t + perpendicular[0] * s * halfWidth,
      start[1] + delta[1] * t + perpendicular[1] * s * halfWidth,
      w,
    ]
  }

  // Position dans le groupe : la profondeur change la taille apparente, donc l'étendue visible
  const toWorld = ([mx, my, w]) => {
    const z = w * DEPTH_RANGE
    const halfHeight = (groupDepth - z) * Math.tan(fov / 2)
    return [mx * halfHeight, my * halfHeight, z]
  }

  const squaredDistance = (a, b) => {
    const dx = a[0] - b[0]
    const dy = a[1] - b[1]
    const dw = (a[2] - b[2]) * DEPTH_WEIGHT
    return dx * dx + dy * dy + dw * dw
  }

  const points = []

  if (layout === 'grid') {
    // Grille régulière : autant de colonnes qu'il faut pour que les cases soient à peu près carrées à l'écran.
    // Les cases sont attribuées dans le désordre, pour que les projets ne soient pas tous groupés.
    const cols = Math.max(1, Math.round(Math.sqrt(count * aspect)))
    const rows = Math.ceil(count / cols)
    const cells = Array.from({ length: cols * rows }, (_, index) => index)
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[cells[i], cells[j]] = [cells[j], cells[i]]
    }
    for (let i = 0; i < count; i++) {
      const col = cells[i] % cols
      const row = Math.floor(cells[i] / cols)
      const t = cols === 1 ? 0.5 : col / (cols - 1)
      const s = rows === 1 ? 0 : (row / (rows - 1)) * 2 - 1
      points.push(bandPoint(t, s, (Math.random() * 2 - 1) * 0.5))
    }
    return points.map(toWorld)
  }

  if (layout === 'spiral') {
    // Spirale de tournesol : angle d'or entre deux points, rayon en racine du rang. Le premier point (premier
    // projet) est au centre, les bordures sont à l'extérieur.
    const goldenAngle = Math.PI * (3 - Math.sqrt(5))
    for (let i = 0; i < count; i++) {
      const radius = Math.sqrt((i + 0.5) / count)
      const angle = i * goldenAngle
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius
      points.push([x * aspect * UNIFORM_COVERAGE, y * UNIFORM_COVERAGE, (Math.random() * 2 - 1) * 0.5])
    }
    return points.map(toWorld)
  }

  // Les premiers points (projets) : régulièrement espacés le long de la diagonale, de part et d'autre
  const ordered = layout === 'uniform' ? 0 : Math.min(orderedCount, count)
  for (let i = 0; i < ordered; i++) {
    const t = (i + 0.5) / ordered + (Math.random() - 0.5) * 0.4 / ordered
    const side = i % 2 === 0 ? -1 : 1
    const s = side * (0.25 + Math.random() * 0.55)
    points.push(bandPoint(Math.min(Math.max(t, 0), 1), s, Math.random() * 2 - 1))
  }

  // Les autres : best candidate dans la bande
  for (let i = ordered; i < count; i++) {
    let best = null
    let bestScore = -1

    for (let attempt = 0; attempt < CANDIDATES_PER_POINT; attempt++) {
      const candidate = bandPoint(Math.random(), Math.random() * 2 - 1, Math.random() * 2 - 1)
      let nearest = Infinity
      for (const other of points) {
        nearest = Math.min(nearest, squaredDistance(candidate, other))
      }
      if (nearest > bestScore) {
        bestScore = nearest
        best = candidate
      }
    }

    points.push(best)
  }

  return points.map(toWorld)
}
