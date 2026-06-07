/**
 * Pure functions cho bracket generation.
 * Test-friendly: không phụ thuộc DB hay React.
 */

export type Team = {
  /** member IDs trong team (1 nếu singles, 2 nếu doubles) */
  ids: string[]
  /** Tên hiển thị, vd "A & B" */
  label: string
}

export type Match = {
  round: string
  team_a_ids: string[]
  team_b_ids: string[]
  /** Round Robin: số trận trong vòng, dùng cho ordering */
  index?: number
}

// ========================================
// ROUND ROBIN
// ========================================

/**
 * Sinh tất cả cặp đấu cho round robin (mỗi team gặp nhau 1 lần).
 * Dùng algorithm "circle method" để cân số trận mỗi vòng.
 */
export function generateRoundRobin(teams: Team[]): Match[] {
  if (teams.length < 2) return []

  // Nếu số team lẻ, thêm 1 "bye" giả
  const arr = teams.slice()
  const hasBye = arr.length % 2 === 1
  if (hasBye) arr.push({ ids: ['__bye__'], label: 'Bye' })

  const n = arr.length
  const rounds = n - 1
  const halfSize = n / 2

  const matches: Match[] = []
  // Cố định vị trí 0, xoay các vị trí khác
  const rotation = arr.slice(1)

  for (let round = 0; round < rounds; round++) {
    const roundLabel = `Vòng ${round + 1}`
    // Cặp đầu: vị trí 0 với phần tử cuối của rotation
    const top = [arr[0], ...rotation.slice(0, halfSize - 1)]
    const bottom = rotation.slice(halfSize - 1).reverse()

    for (let i = 0; i < halfSize; i++) {
      const a = top[i]
      const b = bottom[i]
      // Skip nếu team chứa bye
      if (a.ids[0] === '__bye__' || b.ids[0] === '__bye__') continue
      matches.push({
        round: roundLabel,
        team_a_ids: a.ids,
        team_b_ids: b.ids,
        index: matches.length,
      })
    }

    // Xoay (right rotation, vị trí 0 cố định)
    rotation.unshift(rotation.pop()!)
  }

  return matches
}

// ========================================
// SINGLE ELIMINATION
// ========================================

/**
 * Sinh bracket single elimination.
 * Tự handle bye nếu số team không phải lũy thừa của 2.
 * Trả về matches của vòng 1 — các vòng sau auto-tạo khi nhập kết quả.
 */
export function generateSingleElim(teams: Team[]): Match[] {
  if (teams.length < 2) return []

  // Tìm lũy thừa của 2 gần nhất >=
  const size = nextPowerOfTwo(teams.length)
  const byes = size - teams.length

  // Seed: top seeds (vd 1,2,3,4 nếu cho phép seeding sau) lấy bye trước
  // Cho MVP: seeding theo thứ tự đầu vào
  const seeded = teams.slice()

  // Bracket positions: pair (0, n-1), (1, n-2)... — top vs bottom
  // Bye được ghép với top seed → top seed auto thắng vòng 1
  const matches: Match[] = []
  const round1Label = roundLabel(size)

  for (let i = 0; i < size / 2; i++) {
    const aIdx = i
    const bIdx = size - 1 - i
    const a = seeded[aIdx]
    const b = bIdx < teams.length ? seeded[bIdx] : null

    if (!b) {
      // Bye: a auto advance. Không tạo match.
      continue
    }
    matches.push({
      round: round1Label,
      team_a_ids: a.ids,
      team_b_ids: b.ids,
      index: i,
    })
  }

  // Note: byes handled by skip — advancing logic happens when admin nhập kết quả
  // (cần advance logic separate). Trả về byes count để caller biết.
  void byes
  return matches
}

function nextPowerOfTwo(n: number): number {
  let p = 1
  while (p < n) p *= 2
  return p
}

function roundLabel(bracketSize: number): string {
  if (bracketSize === 2) return 'Chung kết'
  if (bracketSize === 4) return 'Bán kết'
  if (bracketSize === 8) return 'Tứ kết'
  if (bracketSize === 16) return 'Vòng 1/8'
  if (bracketSize === 32) return 'Vòng 1/16'
  return `Vòng ${bracketSize} đội`
}

/**
 * Cho 1 round (vd "Tứ kết") → trả về round name của vòng sau (Bán kết).
 */
export function nextRoundLabel(currentRound: string): string {
  const map: Record<string, string> = {
    'Vòng 1/16': 'Vòng 1/8',
    'Vòng 1/8': 'Tứ kết',
    'Tứ kết': 'Bán kết',
    'Bán kết': 'Chung kết',
    'Chung kết': '',
  }
  return map[currentRound] ?? ''
}

// ========================================
// STANDINGS (Round Robin)
// ========================================

export type Standing = {
  team_ids: string[]
  played: number
  wins: number
  losses: number
  points_for: number
  points_against: number
  points_diff: number
}

export function computeRoundRobinStandings(
  teams: Team[],
  matches: Array<{
    team_a_ids: string[]
    team_b_ids: string[]
    score_a: number | null
    score_b: number | null
  }>
): Standing[] {
  const stats = new Map<string, Standing>()

  // Init
  for (const t of teams) {
    const key = t.ids.join(',')
    stats.set(key, {
      team_ids: t.ids,
      played: 0,
      wins: 0,
      losses: 0,
      points_for: 0,
      points_against: 0,
      points_diff: 0,
    })
  }

  // Walk matches
  for (const m of matches) {
    if (m.score_a === null || m.score_b === null) continue
    const aKey = m.team_a_ids.join(',')
    const bKey = m.team_b_ids.join(',')
    const a = stats.get(aKey)
    const b = stats.get(bKey)
    if (!a || !b) continue
    a.played++
    b.played++
    a.points_for += m.score_a
    a.points_against += m.score_b
    b.points_for += m.score_b
    b.points_against += m.score_a
    if (m.score_a > m.score_b) {
      a.wins++
      b.losses++
    } else if (m.score_b > m.score_a) {
      b.wins++
      a.losses++
    }
  }

  for (const s of stats.values()) {
    s.points_diff = s.points_for - s.points_against
  }

  // Sort: wins DESC, points_diff DESC, points_for DESC
  return Array.from(stats.values()).sort(
    (a, b) =>
      b.wins - a.wins ||
      b.points_diff - a.points_diff ||
      b.points_for - a.points_for
  )
}
