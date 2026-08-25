import { useState, useEffect } from 'react'

export default function CountUp({ end, duration = 1000, decimals = 0 }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let startTime = null
    const endValue = parseFloat(end) || 0

    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime
      const progress = Math.min((currentTime - startTime) / duration, 1)

      const currentCount = progress * endValue
      setCount(currentCount)

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    requestAnimationFrame(animate)
  }, [end, duration])

  return <span>{count.toFixed(decimals)}</span>
}
