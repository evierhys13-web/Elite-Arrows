import sharp from 'sharp'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const logoPath = path.join(__dirname, 'public', 'elite arrows.jpg')
const outputPath = path.join(__dirname, 'public', 'feature-graphic.png')

// Dimensions required by Google Play
const WIDTH = 1024
const HEIGHT = 500
const BG_COLOR = '#0f0f23'

async function generate() {
  try {
    console.log('Generating feature graphic...')
    
    // Create background
    const background = Buffer.from(
      `<svg width="${WIDTH}" height="${HEIGHT}">
        <rect width="100%" height="100%" fill="${BG_COLOR}"/>
      </svg>`
    )

    // Resize logo to fit nicely (max height 350px, maintain aspect ratio)
    const logoResized = await sharp(logoPath)
      .resize({ height: 350, fit: 'inside' })
      .toBuffer()

    // Composite logo onto background
    await sharp(background)
      .composite([
        {
          input: logoResized,
          gravity: 'center'
        }
      ])
      .png()
      .toFile(outputPath)

    console.log(`Feature graphic saved to: ${outputPath}`)
    console.log('You can now upload this file to Google Play Console.')
  } catch (error) {
    console.error('Error generating feature graphic:', error)
  }
}

generate()
