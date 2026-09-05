const KEY = (userId) => `training_progress_${userId}`

export function getTrainingProgress(userId) {
  if (!userId) return { completedLessons: [], completedDrills: [] }
  try {
    const raw = localStorage.getItem(KEY(userId))
    if (!raw) return { completedLessons: [], completedDrills: [] }
    const parsed = JSON.parse(raw)
    return {
      completedLessons: Array.isArray(parsed.completedLessons) ? parsed.completedLessons : [],
      completedDrills: Array.isArray(parsed.completedDrills) ? parsed.completedDrills : []
    }
  } catch (e) {
    return { completedLessons: [], completedDrills: [] }
  }
}

export function toggleLessonDone(userId, lessonId) {
  const progress = getTrainingProgress(userId)
  const exists = progress.completedLessons.includes(lessonId)
  const completedLessons = exists
    ? progress.completedLessons.filter(id => id !== lessonId)
    : [...progress.completedLessons, lessonId]
  localStorage.setItem(KEY(userId), JSON.stringify({ ...progress, completedLessons }))
  return completedLessons
}

export function toggleDrillDone(userId, drillId) {
  const progress = getTrainingProgress(userId)
  const exists = progress.completedDrills.includes(drillId)
  const completedDrills = exists
    ? progress.completedDrills.filter(id => id !== drillId)
    : [...progress.completedDrills, drillId]
  localStorage.setItem(KEY(userId), JSON.stringify({ ...progress, completedDrills }))
  return completedDrills
}

export function courseCompletion(userId, course) {
  const progress = getTrainingProgress(userId)
  const total = course.lessons.length
  const done = course.lessons.filter(l => progress.completedLessons.includes(l.id)).length
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 }
}