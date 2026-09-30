import { getStorage, ref, uploadString, uploadBytes, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { app } from './firebase'

export const storage = getStorage(app)
export { ref, uploadString, uploadBytes, uploadBytesResumable, getDownloadURL }