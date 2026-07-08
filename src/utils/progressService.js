import { db, collection, addDoc, getDocs, query, where, orderBy, deleteDoc, doc, serverTimestamp, updateDoc } from '../firebase'

/**
 * Saves or updates a progress log entry in Firestore.
 *
 * @param {string} userId - The ID of the user creating the entry.
 * @param {Object} logData - The data for the entry (metrics, type, privacy, etc.).
 * @param {string} [logId] - The ID of the document to update, if existing.
 * @returns {Promise<string>} - The ID of the saved document.
 * @throws {Error} - Re-throws Firestore errors.
 */
export async function saveProgressLog(userId, logData, logId = null) {
  try {
    const data = {
      ...logData,
      userId,
      updatedAt: new Date().toISOString(),
      serverTimestamp: serverTimestamp()
    }

    if (!logId) {
      data.createdAt = new Date().toISOString()
      const docRef = await addDoc(collection(db, 'progressLogs'), data)
      return docRef.id
    } else {
      await updateDoc(doc(db, 'progressLogs', logId), data)
      return logId
    }
  } catch (error) {
    console.error('Error saving progress log:', error)
    throw error
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
    // Return empty array if index is missing or other error occurs
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
