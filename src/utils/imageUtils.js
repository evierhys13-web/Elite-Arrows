export const compressImageToDataUrl = (file, { maxDimension = 800, maxBase64 = 400000 } = {}) => {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file selected'))
    if (file.size > 10 * 1024 * 1024) return reject(new Error('Image is too large (max 10MB)'))

    const reader = new FileReader()
    reader.onloadend = () => {
      const image = new Image()
      image.onload = () => {
        const canvas = document.createElement('canvas')
        const scale = Math.min(1, maxDimension / Math.max(image.width, image.height))
        canvas.width = Math.max(1, Math.round(image.width * scale))
        canvas.height = Math.max(1, Math.round(image.height * scale))
        const ctx = canvas.getContext('2d')
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

        let quality = 0.7
        let dataUrl = canvas.toDataURL('image/jpeg', quality)
        while (dataUrl.length > maxBase64 && quality > 0.15) {
          quality -= 0.1
          dataUrl = canvas.toDataURL('image/jpeg', quality)
        }
        resolve(dataUrl)
      }
      image.onerror = () => reject(new Error('Invalid image file'))
      image.src = reader.result
    }
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
}