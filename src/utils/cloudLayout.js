// Répartition des tuiles dans le nuage de l'accueil : une bande en diagonale, du bas à gauche vers le haut à droite.
//
// - Les projets sont posés le long de la diagonale, dans l'ordre de la liste (le premier en bas à gauche,
//   le dernier en haut à droite), en alternant de part et d'autre de la ligne.
// - Les tuiles vides et les bordures se répartissent ensuite dans la bande autour de la diagonale, chacune
//   au point le plus éloigné de celles déjà posées (« best candidate »).

// Part de la diagonale de l'écran utilisée (1 = coin à coin) : on laisse une marge pour ne pas couper les cartes
const DIAGONAL_COVERAGE = 0.78
// Demi-largeur de la bande, en hauteurs d'écran
const BAND_HALF_WIDTH = 0.32
// Profondeur du nuage, de part et d'autre du plan du groupe
const DEPTH_RANGE = 1.5
// Poids de la profondeur dans la distance entre deux points (les écarts en profondeur comptent moins)
const DEPTH_WEIGHT = 0.5
const CANDIDATES_PER_POINT = 24

// Angle (autour de z) à donner au groupe pour que son axe Y se couche le long de la diagonale de l'écran :
// la molette fait tourner le nuage autour de cet axe, comme un cylindre posé en diagonale.
export const getDiagonalAxisAngle = (aspect) => -Math.atan(aspect)

export const generateCloudPositions = (count, camera, distance, orderedCount = 0) => {
  const fov = camera.fov * (Math.PI / 180)
  const aspect = camera.aspect
  const groupDepth = Math.abs(distance)

  // Espace « métrique » de l'écran : x est multiplié par le ratio, pour que les distances soient les mêmes
  // en x et en y. La diagonale va de (-aspect, -1) à (aspect, 1), réduite par la couverture.
  const start = [-aspect * DIAGONAL_COVERAGE, -DIAGONAL_COVERAGE]
  const end = [aspect * DIAGONAL_COVERAGE, DIAGONAL_COVERAGE]
  const delta = [end[0] - start[0], end[1] - start[1]]
  const length = Math.hypot(delta[0], delta[1])
  const direction = [delta[0] / length, delta[1] / length]
  const perpendicular = [-direction[1], direction[0]]

  // Point de la bande : t le long de la diagonale (0 à 1), s en travers (-1 à 1), w en profondeur (-1 à 1)
  const bandPoint = (t, s, w) => [
    start[0] + delta[0] * t + perpendicular[0] * s * BAND_HALF_WIDTH,
    start[1] + delta[1] * t + perpendicular[1] * s * BAND_HALF_WIDTH,
    w,
  ]

  // Le groupe démarre tourné d'un demi-tour autour de la diagonale (cf. useRotationControl) : à l'écran,
  // chaque point est le reflet de sa position dans le groupe par rapport à la diagonale, et sa profondeur est
  // inversée. On renvoie donc la position dans le groupe qui donne, une fois le demi-tour fait, le point voulu.
  const toWorld = ([mx, my, w]) => {
    const z = w * DEPTH_RANGE
    const halfHeight = (groupDepth - z) * Math.tan(fov / 2)
    const x = mx * halfHeight
    const y = my * halfHeight
    const along = x * direction[0] + y * direction[1]
    return [2 * along * direction[0] - x, 2 * along * direction[1] - y, -z]
  }

  const squaredDistance = (a, b) => {
    const dx = a[0] - b[0]
    const dy = a[1] - b[1]
    const dw = (a[2] - b[2]) * DEPTH_WEIGHT
    return dx * dx + dy * dy + dw * dw
  }

  const points = []

  // Les premiers points (projets) : régulièrement espacés le long de la diagonale, de part et d'autre
  const ordered = Math.min(orderedCount, count)
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
