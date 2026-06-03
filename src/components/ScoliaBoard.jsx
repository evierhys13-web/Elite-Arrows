import { useMemo } from 'react'

const segments = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]

export default function ScoliaBoard({ lastDarts = [], size = 300 }) {
  const center = size / 2
  const radius = size * 0.45

  const dartMarkers = useMemo(() => {
    return lastDarts.map((dart, i) => {
      // Logic to place marker based on label (e.g., 'T20', 'D16', 'BULL')
      // This is a visual approximation for the AI behavior
      let r = 0
      let angle = 0

      const label = dart.label || ''
      const value = dart.value

      if (label === 'BULL') {
        r = radius * 0.03
        angle = Math.random() * 360
      } else if (label === '25') {
        r = radius * 0.08
        angle = Math.random() * 360
      } else {
        const segVal = parseInt(label.replace(/[^0-9]/g, '')) || value
        const idx = segments.indexOf(segVal)
        angle = (idx * 18) - 90 // 20 is at top (-90 deg)

        if (label.startsWith('T')) r = radius * 0.62
        else if (label.startsWith('D')) r = radius * 0.97
        else r = radius * 0.4 + (Math.random() * radius * 0.2) // Single

        // Add jitter
        angle += (Math.random() - 0.5) * 10
      }

      const x = center + r * Math.cos(angle * Math.PI / 180)
      const y = center + r * Math.sin(angle * Math.PI / 180)

      return { x, y, id: i, label }
    })
  }, [lastDarts, center, radius])

  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <img
        src="/dartboard_flat.png" // Ensure you have a flat dartboard asset or use a placeholder
        alt="Board"
        style={{ width: '100%', height: '100%', borderRadius: '50%', border: '4px solid #333' }}
        onError={(e) => {
            e.target.src = 'https://media.istockphoto.com/id/1138245598/vector/dart-board-isolated-on-white-background-vector-illustration.jpg?s=612x612&w=0&k=20&c=6h8L6j_pXpXG-eYmS-fR6L-oYk9yXzX_o6y6qf-h9o0='
        }}
      />

      {dartMarkers.map(marker => (
        <div key={marker.id} style={{
          position: 'absolute',
          left: marker.x - 6,
          top: marker.y - 6,
          width: '12px',
          height: '12px',
          background: 'red',
          borderRadius: '50%',
          border: '2px solid white',
          boxShadow: '0 0 10px rgba(0,0,0,0.5)',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
            <div style={{ position: 'absolute', top: -20, fontSize: '0.6rem', background: '#000', color: '#fff', padding: '1px 4px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                {marker.label}
            </div>
        </div>
      ))}
    </div>
  )
}
