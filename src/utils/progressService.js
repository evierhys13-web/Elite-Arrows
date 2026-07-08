import { db, collection, addDoc, query, where, orderBy, getDocs, deleteDoc, doc, serverTimestamp, updateDoc } from '../firebase'

const PROGRESS_COLLECTION = 'progressLogs'

/**
 * Saves or updates a progress entry for a user.
 * @param {string} userId
 * @param {object} logData
 * @param {string} [logId] - Optional ID for updating an existing entry
 */
export const saveProgressLog = async (userId, logData, logId = null) => {
  try {
    const data = {
      userId,
      ...logData,
      date: logData.date ? new Date(logData.date).toISOString() : new Date().toISOString(),
      updatedAt: serverTimestamp()
    }

    if (logId) {
      const docRef = doc(db, PROGRESS_COLLECTION, logId)
      await updateDoc(docRef, data)
      return { id: logId, ...data }
    } else {
      data.createdAt = serverTimestamp()
      const docRef = await addDoc(collection(db, PROGRESS_COLLECTION), data)
      return { id: docRef.id, ...data }
    }
  } catch (error) {
    console.error("Error saving progress log: ", error)
    throw error
  }
}

/**
 * Fetches all progress logs for a specific user.
 * @param {string} userId
 */
export const fetchProgressLogs = async (userId) => {
  try {
    // Using a simpler query to avoid needing a composite index immediately.
    // We'll sort in-memory instead.
    const q = query(
      collection(db, PROGRESS_COLLECTION),
      where('userId', '==', userId)
    )
    const querySnapshot = await getDocs(q)
    const logs = querySnapshot.docs.map(doc => {
      const data = doc.data()
      // Handle both Firestore Timestamps and ISO strings
      let date = data.date
      if (date && typeof date.toDate === 'function') {
        date = date.toDate().toISOString()
      } else if (date instanceof Date) {
        date = date.toISOString()
      }

      return {
        id: doc.id,
        ...data,
        date: date || new Date().toISOString()
      }
    })

    // Sort by date descending
    return logs.sort((a, b) => new Date(b.date) - new Date(a.date))
  } catch (error) {
    console.error("Error fetching progress logs: ", error)
    throw error
  }
}

/**
 * Deletes a specific progress log.
 * @param {string} logId
 */
export const deleteProgressLog = async (logId) => {
  try {
    await deleteDoc(doc(db, PROGRESS_COLLECTION, logId))
    return true
  } catch (error) {
    console.error("Error deleting progress log: ", error)
    throw error
  }
}
