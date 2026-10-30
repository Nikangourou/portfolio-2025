// Répartition des tuiles dans le nuage de l'accueil.
//
// Les points sont tirés dans l'écran visible (et non dans un cube de taille fixe), un par un, en gardant
// à chaque fois le candidat le plus éloigné des points déjà posés (« best candidate »). Les premiers points
// sont donc très espacés et les suivants comblent les vides : on donne les premiers aux projets, qui restent
// bien répartis, et les derniers aux tuiles vides et aux bordures.

// Part de l'écran utilisée (1 = bord à bord) : on laisse une marge pour que les cartes ne soient pas coupées
const SCREEN_COVERAGE = 0.68
// Profondeur du nuage, de part et d'autre du plan du groupe
const DEPTH_RANGE = 1.5
// Poids de la profondeur dans la distance entre deux points (les écarts en profondeur comptent moins)
const DEPTH_WEIGHT = 0.5
const CANDIDATES_PER_POINT = 24

export const generateCloudPositions = (count, camera, distance) => {
  const fov = camera.fov * (Math.PI / 180)
  const aspect = camera.aspect
  const groupDepth = Math.abs(distance)

  // Coordonnées normalisées : u et v dans [-1, 1] à l'écran, w dans [-1, 1] en profondeur.
  // La distance se mesure avec u mis à l'échelle du ratio, pour que l'espacement soit le même en x et en y.
  const normalized = []
  const positions = []

  const toWorld = (u, v, w) => {
    const z = w * DEPTH_RANGE
    const halfHeight = (groupDepth - z) * Math.tan(fov / 2) * SCREEN_COVERAGE
    return [u * halfHeight * aspect, v * halfHeight, z]
  }

  const squaredDistance = (a, b) => {
    const du = (a[0] - b[0]) * aspect
    const dv = a[1] - b[1]
    const dw = (a[2] - b[2]) * DEPTH_WEIGHT
    return du * du + dv * dv + dw * dw
  }

  for (let i = 0; i < count; i++) {
    let best = null
    let bestScore = -1

    for (let attempt = 0; attempt < CANDIDATES_PER_POINT; attempt++) {
      const candidate = [Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1]
      let nearest = Infinity
      for (const other of normalized) {
        nearest = Math.min(nearest, squaredDistance(candidate, other))
      }
      if (nearest > bestScore) {
        bestScore = nearest
        best = candidate
      }
    }

    normalized.push(best)
    positions.push(toWorld(best[0], best[1], best[2]))
  }

  return positions
}
