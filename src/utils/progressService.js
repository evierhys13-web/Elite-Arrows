import { db, collection, addDoc, getDocs, query, where, orderBy, deleteDoc, doc, serverTimestamp } from '../firebase'

/**
 * Saves a new progress log entry to Firestore.
 *
 * @param {string} userId - The ID of the user creating the entry.
 * @param {Object} logData - The data for the entry (metrics, type, privacy, etc.).
 * @returns {Promise<string|null>} - The ID of the created document or null on error.
 */
export async function saveProgressLog(userId, logData) {
  try {
    const docRef = await addDoc(collection(db, 'progressLogs'), {
      ...logData,
      userId,
      createdAt: new Date().toISOString(),
      serverTimestamp: serverTimestamp()
    })
    return docRef.id
  } catch (error) {
    console.error('Error saving progress log:', error)
    return null
  }
}

/**
 * Fetches all progress logs for a specific user, ordered by date.
 *
 * @param {string} userId - The ID of the user whose logs to fetch.
 * @returns {Promise<Array>} - An array of log entries.
 */
export async function fetchProgressLogs(userId) {
  try {
    const q = query(
      collection(db, 'progressLogs'),
      where('userId', '==', userId),
      orderBy('date', 'desc')
    )
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
  } catch (error) {
    console.error('Error fetching progress logs:', error)
    return []
  }
}

/**
 * Deletes a progress log entry.
 *
 * @param {string} logId - The ID of the document to delete.
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
export async function deleteProgressLog(logId) {
  try {
    await deleteDoc(doc(db, 'progressLogs', logId))
    return true
  } catch (error) {
    console.error('Error deleting progress log:', error)
    return false
  }
}
