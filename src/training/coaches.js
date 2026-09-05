export const COACHES = {
  taylor: {
    id: 'taylor',
    name: 'Phil Taylor',
    role: '16x World Champion',
    credentials: '16 World Championship titles. Widely regarded as the greatest player in darts history.',
    source: 'Published coaching material (Modus Super Series, 2025)',
    verified: true,
    summary: "Taylor's advice is grounded in thousands of hours at the practice board. He teaches repeatable mechanics and a smooth, effortless throwing action.",
    accent: '#fbbf24'
  },
  mardle: {
    id: 'mardle',
    name: 'Wayne Mardle',
    role: 'PDC Coach, Commentator & 4x World Championship Semi-Finalist',
    credentials: 'Ex-professional. Coached former PDC Tour Card holders and runs "Fix My Throw". Popularised the board-on-the-lap checkout method.',
    source: 'Published coaching material (Mardle\'s Masterclass, Winmau Darts, Darts World)',
    verified: true,
    summary: "Mardle's message is comfort, relaxation and understanding your own throw — refine what you have rather than copying someone else.",
    accent: '#4da8da'
  },
  pipe: {
    id: 'pipe',
    name: 'Justin Pipe',
    role: 'PDC Professional',
    credentials: 'PDC Tour professional. Known for one of the most consistent pre-throw routines on tour.',
    source: 'Published interview (Darts Aim)',
    verified: true,
    summary: "Pipe's guidance: practice should be enjoyable, not a chore. If you are just going through the motions, you have stopped improving.",
    accent: '#22c55e'
  },
  nicholson: {
    id: 'nicholson',
    name: 'Paul Nicholson',
    role: 'Former Professional & Pundit',
    credentials: 'Former PDC Tour professional, World Championship semi-finalist, now a broadcaster and pundit.',
    source: 'Published commentary (Darts Aim)',
    verified: true,
    summary: '"The average is just a reflection of what you\'ve done, not a reflection of what you can do." Don\'t chase the number — chase the win.',
    accent: '#a78bfa'
  },
  academy: {
    id: 'academy',
    name: 'Elite Arrows Academy Team',
    role: 'Verified Academy Curriculum',
    credentials: 'Curriculum compiled by the Elite Arrows coaching team from published professional coaching material, reviewed for accuracy.',
    source: 'Synthesised from the verified sources referenced across this course',
    verified: true,
    summary: 'The Academy team curates and cross-checks professional coaching material so every lesson is grounded in real, published advice.',
    accent: '#00d4ff'
  }
}

export const getCoach = (id) => COACHES[id] || COACHES.academy