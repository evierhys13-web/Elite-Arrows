import { db, doc, setDoc, collection, addDoc, serverTimestamp } from '../firebase'

export const PRACTICE_MODES = {
  AROUND_THE_CLOCK: {
    id: 'atc',
    name: 'Around the Clock',
    description: 'Hit numbers 1 through 20 followed by Bullseye.',
    objective: 'Hit targets in sequence'
  },
  DRILL_170: {
    id: '170',
    name: '170 Drill',
    description: 'Try to checkout 170 in as few darts as possible.',
    objective: 'High checkout practice'
  },
  SCORING: {
    id: 'scoring',
    name: 'Score Practice',
    description: 'Score as high as possible in 10 rounds (30 darts).',
    objective: 'Improve scoring average'
  }
}

export async function savePracticeSession(userId, username, modeId, stats) {
  const sessionId = `practice_${Date.now()}`
  const today = new Date().toISOString().split('T')[0]
  const sessionData = {
    id: sessionId,
    userId,
    username,
    modeId,
    stats,
    date: today,
    createdAt: new Date().toISOString(),
    serverTimestamp: serverTimestamp()
  }

  try {
    await setDoc(doc(db, 'practiceSessions', sessionId), sessionData)

    // Local tracking for daily goals
    const localKey = `practice_sessions_${userId}`
    const localSessions = JSON.parse(localStorage.getItem(localKey) || '[]')
    localSessions.push({ id: sessionId, date: today })
    // Keep only last 30 days of session metadata locally
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const filtered = localSessions.filter(s => new Date(s.date) >= thirtyDaysAgo)
    localStorage.setItem(localKey, JSON.stringify(filtered))

    // Update practice leaderboards
    await addDoc(collection(db, 'practiceLeaderboard'), {
      userId,
      username,
      modeId,
      score: stats.score || 0,
      dartsThrown: stats.dartsThrown || 0,
      accuracy: stats.accuracy || 0,
      timeTaken: stats.endTime - stats.startTime,
      timestamp: serverTimestamp()
    })

    return true
  } catch (error) {
    console.error('Error saving practice session:', error)
    return false
  }
}
