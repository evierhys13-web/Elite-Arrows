// Discord embed/formatting helpers. These turn the app's Firestore data into
// nicely-readable Discord messages.

import { EmbedBuilder } from 'discord.js'

export const DIVISION_COLORS = {
  Overall: 0x818cf8,
  Elite: 0xfbbf24,
  Emerald: 0x10b981,
  Diamond: 0x38bdf8,
  Platinum: 0x818cf8,
  Gold: 0xfbbf24,
  Silver: 0xc0c0c0,
  Bronze: 0xcd7f32
}

const pad = (value, length) => String(value ?? '').padEnd(length)

function buildMonospaceTable(rows) {
  let nameMax = 4
  for (const row of rows) nameMax = Math.max(nameMax, String(row.username || '').length)
  nameMax = Math.min(nameMax, 22)

  const header = `#  ${pad('Player', nameMax)}  ${pad('P', 3)}${pad('W', 3)}${pad('D', 3)}${pad('L', 3)}${pad('+-', 4)}${pad('Avg', 6)}  ${pad('Pts', 3)}`

  const lines = rows.map((row, index) => {
    const stats = row.stats
    const legDiff = stats.legsWon - stats.legsLost
    const avg = stats.average > 0 ? stats.average.toFixed(2) : '-'
    return `${String(index + 1).padStart(2)}  ${pad(row.username || row.displayName || '?', nameMax)}  ${pad(stats.played, 3)}${pad(stats.wins, 3)}${pad(stats.draws, 3)}${pad(stats.losses, 3)}${pad(legDiff > 0 ? `+${legDiff}` : String(legDiff), 4)}${pad(avg, 6)}  ${pad(stats.points, 3)}`
  })

  return `\`\`\`\n${header}\n${lines.join('\n')}\n\`\`\``
}

export function tableEmbed({ division, rows, season, updatedAt = new Date() }) {
  const visible = rows.slice(0, 20)
  const extra = rows.length > 20 ? `\n_… and ${rows.length - 20} more. Use /table ${division.toLowerCase()} in the app's table for the full list._` : ''
  const embed = new EmbedBuilder()
    .setTitle(`${division === 'Overall' ? '\u{1F3C6} Overall League' : `${division} Division`}`)
    .setDescription(buildMonospaceTable(visible) + extra)
    .setColor(DIVISION_COLORS[division] || 0x818cf8)
    .setFooter({ text: `${season} · Live from the Elite Arrows app · ${updatedAt.toUTCString()}` })
  return embed
}

export function resultEmbed(result, helpers) {
  const p1 = helpers.resolveName(result, 1)
  const p2 = helpers.resolveName(result, 2)
  const s1 = Number(result.score1) ?? 0
  const s2 = Number(result.score2) ?? 0

  const winner = s1 > s2 ? p1 : s2 > s1 ? p2 : null
  const headline = winner
    ? `**${winner}** beat ${winner === p1 ? `**${p2}**` : `**${p1}**`} ${Math.max(s1, s2)}-${Math.min(s1, s2)}`
    : `**${p1}** ${s1}-${s2} **${p2}** (draw)`

  const notes = []
  const star1 = result.player1Stats?.avg || result.player1Avg
  const star2 = result.player2Stats?.avg || result.player2Avg
  if (star1 && star2) notes.push(`Averages: ${p1} ${Number(star1).toFixed(2)} · ${p2} ${Number(star2).toFixed(2)}`)
  if (result.player1Stats?.['180s'] || result.player2Stats?.['180s']) {
    notes.push(`180s: ${p1} × ${result.player1Stats?.['180s'] || 0} · ${p2} × ${result.player2Stats?.['180s'] || 0}`)
  }
  if (result.forfeit) notes.push('Awarded by forfeit')

  const division = helpers.divisionForResult(result)
  const season = result.season || ''
  const week = result.week ? ` · Week ${result.week}` : ''

  const embed = new EmbedBuilder()
    .setTitle(`\u2705 Result In — ${division || 'League'}${week}`)
    .setDescription(`${headline}\n${result.gameType || 'League'}${season ? ` · ${season}` : ''}${result.date ? `\n${result.date}` : ''}`)
    .setColor(0x10b981)
    .setTimestamp()
  if (notes.length) embed.addFields({ name: 'Details', value: notes.join('\n') })
  return embed
}

export function upcomingLeagueFixtures(fixtures, users, season) {
  const todayKey = new Date()
  const today = `${todayKey.getFullYear()}-${String(todayKey.getMonth() + 1).padStart(2, '0')}-${String(todayKey.getDate()).padStart(2, '0')}`

  const fixtureName = (f, n) => {
    const key = f[`player${n}Name`]
    const id = f[`player${n}Id`]
    const user = id ? users.find(u => String(u.id) === String(id)) : null
    return user?.username || user?.displayName || key || 'TBD'
  }

  return (Array.isArray(fixtures) ? fixtures : [])
    .filter(f => {
      const gt = String(f.gameType || '').toLowerCase()
      if (!gt.includes('league')) return false
      if (f.cupId || f.tournamentId || f.matchId) return false
      const nonLeague = ['super league', 'champions league', 'cup', 'friendly', 'playoff', 'tournament']
      if (nonLeague.some(t => gt.includes(t))) return false
      if (season && f.season && String(f.season) !== season) return false
      if (!f.fixtureDate || f.fixtureDate < today) return false
      return true
    })
    .map(f => ({ ...f, home: fixtureName(f, 1), away: fixtureName(f, 2) }))
    .sort((a, b) => {
      const timeA = `${a.fixtureDate} ${a.fixtureTime || ''}`
      const timeB = `${b.fixtureDate} ${b.fixtureTime || ''}`
      if (timeA !== timeB) return timeA.localeCompare(timeB)
      return String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
    })
}

export function fixturesEmbed(fixtures, season, limit = 8) {
  const groups = {}
  for (const f of fixtures.slice(0, limit)) {
    if (!groups[f.fixtureDate]) groups[f.fixtureDate] = []
    const time = f.fixtureTime || ''
    groups[f.fixtureDate].push(`${time ? `${time} — ` : ''}**${f.home}** vs **${f.away}**${f.division ? ` (${f.division})` : ''}`)
  }

  const embed = new EmbedBuilder()
    .setTitle('\u{1F5D3} Upcoming League Fixtures')
    .setColor(0x38bdf8)
    .setFooter({ text: `${season || ''} · Elite Arrows Darts League`.trim() })
  const dateEntries = Object.entries(groups)
  if (!dateEntries.length) {
    embed.setDescription('No upcoming league fixtures scheduled yet.')
  } else {
    for (const [date, lines] of dateEntries) {
      embed.addFields({ name: formatDate(date), value: lines.join('\n') })
    }
  }
  return embed
}

export function newsEmbed(news) {
  const embed = new EmbedBuilder()
    .setTitle(`\u{1F4E2} ${news.title || 'Announcement'}`)
    .setDescription(news.message || '')
    .setColor(0x7dd3fc)
    .setTimestamp(news.createdAt ? new Date(news.createdAt) : new Date())
  if (news.authorName) embed.setFooter({ text: `Posted by ${news.authorName}` })
  return embed
}

export function formatDate(dateKey) {
  const [y, m, d] = String(dateKey).split('-').map(Number)
  if (!y || !m || !d) return String(dateKey)
  const date = new Date(Date.UTC(y, m - 1, d))
  const day = date.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })
  const month = date.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })
  return `${day} ${d} ${month}`
}

export function recentLeagueResults(results, users, fixtures, season, limit = 10) {
  const todayKey = new Date()
  const today = `${todayKey.getFullYear()}-${String(todayKey.getMonth() + 1).padStart(2, '0')}-${String(todayKey.getDate()).padStart(2, '0')}`

  const nameFromId = (id) => {
    const user = id ? users.find(u => String(u.id) === String(id)) : null
    return user?.username || id || '?'
  }

  return (Array.isArray(results) ? results : [])
    .filter(r => {
      if (String(r.status || '').toLowerCase() !== 'approved') return false
      if (r.excludeFromLeague) return false
      if (r.cupId || r.matchId || r.tournamentId) return false
      if (season && r.season && String(r.season) !== season) return false
      const gt = String(r.gameType || '').toLowerCase()
      const nonLeague = ['super league', 'champions league', 'cup', 'friendly', 'playoff', 'tournament', 'friendly league', 'open league']
      if (nonLeague.some(t => gt.includes(t))) return false
      return true
    })
    .sort((a, b) => new Date(b.date || b.submittedAt || 0) - new Date(a.date || a.submittedAt || 0))
    .slice(0, limit)
    .map(r => ({
      ...r,
      home: r.player1Id ? nameFromId(r.player1Id) : r.player1 || '?',
      away: r.player2Id ? nameFromId(r.player2Id) : r.player2 || '?',
      division: r.division || ''
    }))
}

export function resultsEmbed(results, season) {
  if (!results.length) {
    return new EmbedBuilder()
      .setTitle('\u{1F5D3} Recent Results')
      .setDescription('No league results yet this season.')
      .setColor(0x10b981)
  }
  const embed = new EmbedBuilder()
    .setTitle('\u{1F5D3} Recent League Results')
    .setColor(0x10b981)
    .setFooter({ text: `${season || ''} · Elite Arrows Darts League`.trim() })
  const lines = results.map(r => {
    const score = `**${r.home}** ${r.score1}–${r.score2} **${r.away}**`
    const meta = [r.division, r.date].filter(Boolean).join(' · ')
    return `${score}${meta ? `  _(${meta})_` : ''}`
  })
  embed.setDescription(lines.join('\n'))
  return embed
}

const RECORD_LABELS = {
  '180s': { emoji: '\u{1F3AF}', title: 'Most 180s', unit: '180s' },
  average: { emoji: '\u{1F3C5}', title: 'Best 3-dart Average', unit: 'avg' },
  checkout: { emoji: '\u{1F48E}', title: 'Best Checkout', unit: 'checkout' },
  wins: { emoji: '\u{1F3C6}', title: 'Most League Wins', unit: 'wins' },
  points: { emoji: '\u{1F4C8}', title: 'Most Points', unit: 'pts' }
}

export function rankForStat(rows, stat) {
  const valueOf = (player) => {
    switch (stat) {
      case 'average': return player.stats.average || 0
      case 'checkout': return player.stats.highestCheckout || 0
      case 'wins': return player.stats.wins || 0
      case 'points': return player.stats.points || (player.stats.played > 0 ? -1 : 0)
      default: return player.stats['180s'] || 0
    }
  }
  return rows
    .map(p => ({ name: p.username || p.displayName || '?', value: valueOf(p) }))
    .filter(e => e.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
}

export function recordsEmbed(entries, stat, season) {
  const meta = RECORD_LABELS[stat] || RECORD_LABELS['180s']
  const medals = ['\u{1F947}', '\u{1F948}', '\u{1F949}']
  const lines = entries.length
    ? entries.map((e, i) => `${medals[i] || `${i + 1}.`} **${e.name}** — ${e.value} ${meta.unit}`)
    : 'No records yet this season.'
  return new EmbedBuilder()
    .setTitle(`${meta.emoji} League Records`)
    .setDescription(`${meta.title}\n\n${lines.join('\n')}`)
    .setColor(0xfbbf24)
    .setFooter({ text: `${season || ''} · Elite Arrows Darts League`.trim() })
}