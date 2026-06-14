import { db, doc, setDoc, arrayUnion } from '../firebase'

export const ACHIEVEMENTS = [
  { id: 'centurion', label: 'Centurion', icon: '💯', desc: '100+ checkout in a league match' },
  { id: 'the_max', label: 'The Max', icon: '🔥', desc: 'Hit a 180 in a match' },
  { id: 'iron_man', label: 'Iron Man', icon: '🦾', desc: 'Played 50+ official matches' },
  { id: 'on_fire', label: 'On Fire', icon: '⚡', desc: '5-match win streak' },
  { id: 'big_fish', label: 'Big Fish', icon: '🎣', desc: 'Hit a 170 checkout' }
]

export const checkMatchAchievements = async (match, userId, playerStats, userAchievements = []) => {
  const newAchievements = []
  const existingIds = new Set(userAchievements.map(a => a.id))

  const isPlayer1 = String(match.player1Id) === String(userId)
  const myStats = isPlayer1 ? match.player1Stats : match.player2Stats

  if (!myStats) return []

  // 1. Centurion (100+ checkout)
  if (!existingIds.has('centurion') && myStats.highestCheckout >= 100 && myStats.highestCheckout < 170) {
    newAchievements.push(ACHIEVEMENTS.find(a => a.id === 'centurion'))
  }

  // 2. Big Fish (170 checkout)
  if (!existingIds.has('big_fish') && myStats.highestCheckout === 170) {
    newAchievements.push(ACHIEVEMENTS.find(a => a.id === 'big_fish'))
  }

  // 3. The Max (180)
  if (!existingIds.has('the_max') && myStats['180s'] > 0) {
    newAchievements.push(ACHIEVEMENTS.find(a => a.id === 'the_max'))
  }

  // Iron Man and On Fire require historical context, which might be better checked against the fully calculated playerStats
  if (playerStats) {
    // 4. Iron Man (50+ games)
    if (!existingIds.has('iron_man') && playerStats.played >= 50) {
        newAchievements.push(ACHIEVEMENTS.find(a => a.id === 'iron_man'))
    }

    // 5. On Fire (5 win streak)
    if (!existingIds.has('on_fire')) {
        const recentForm = playerStats.form?.slice(-5) || []
        if (recentForm.length === 5 && recentForm.every(f => f === 'W')) {
            newAchievements.push(ACHIEVEMENTS.find(a => a.id === 'on_fire'))
        }
    }
  }

  if (newAchievements.length > 0) {
    const userRef = doc(db, 'users', userId)
    const timestamp = new Date().toISOString()

    // Format for storage
    const toSave = newAchievements.map(a => ({
        ...a,
        awardedAt: timestamp,
        matchId: match.id
    }))

    try {
        await setDoc(userRef, {
            achievements: arrayUnion(...toSave)
        }, { merge: true })
        return newAchievements
    } catch (e) {
        console.error("Failed to award achievements", e)
    }
  }

  return []
}
