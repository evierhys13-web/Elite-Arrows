// One-time provisioning: creates the league server structure (roles, categories,
// channels) that mirrors the Elite Arrows website so everything on the site has a
// Discord home. Each channel topic links to its matching page in the app.
//
// Categories mirror the site's sidebar (src/components/Sidebar.jsx):
//   - Welcome        #welcome · #player-guide → /guide · #rules → /rules
//   - Announcements  #announcements → /news · #giveaways → /giveaways ·
//                    #suggestion-box → /suggestions
//   - Divisions      #elite-division · #emerald-division · #diamond-division ·
//                    #platinum-division · #free-agent-league (reserves/new players)
//   - Main League    #table → /table · #fixtures → /match-log · #results → /results ·
//                    #submit-score → /submit-result · #commands
//   - Compete        #leaderboards · #cups · #cup-draws · #cup-scores ·
//                    #tournaments · #hall-of-fame · #player-of-month ·
//                    #statistics · #daily-challenges · #friendly-league → /open-league
//   - Academy        #practice-hub → /practice · #darts-academy → /training ·
//                    #progress-tracker
//   - Community      #general · #friendly-matches (LFG) · #darts-talk · #off-topic ·
//                    #memes · #mental-health
//   - Staff & Help   #support · #contact · #donations · #applications ·
//                    #sponsors
//   - Elite Pass     #elite-pass → /subscription · #play-online · #live-match ·
//                    #premium-chat
//   - Voice          #match-comms · #tournament-bubbles
//
// Usage: npm run setup   (reads DISCORD_TOKEN + GUILD_ID from .env)
// Idempotent: existing channels/roles are kept (topics are refreshed to the
// current site links). Channel names the bot depends on (#table/#results/
// #fixtures/#announcements/#commands/#friendly-matches) are preserved, so
// re-running setup never breaks the snapshots.

import 'dotenv/config'
import { Client, GatewayIntentBits, PermissionFlagsBits } from 'discord.js'
import { SITE_URL, pageUrl, APPLICATIONS_URL, MERCH_URL } from './site.js'

const ADMIN_OVERWRITES = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.ManageMessages,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.MentionEveryone,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.CreatePublicThreads
]

// send: 'everyone' -> anyone can write · 'admin' -> write restricted to @Admin.
// topic: Discord channel topic, usually the matching site page link.
function overwritesFor(guild, adminRole, { everyoneSend = true }) {
  const ow = [
    { id: guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel] }
  ]
  if (everyoneSend) {
    ow.push({ id: guild.roles.everyone.id, allow: [PermissionFlagsBits.SendMessages] })
  } else {
    ow.push({ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] })
  }
  ow.push({ id: adminRole.id, allow: ADMIN_OVERWRITES })
  return ow
}

// ---- role plan (mirrors the site's real divisions + staff/team/achievement roles) ----
const ROLES = [
  { name: 'Admin', color: 0xfbbf24 },
  { name: 'Player', color: 0x38bdf8 },
  { name: 'Division Captain', color: 0x10b981 },
  { name: 'Elite', color: 0xfbbf24 },
  { name: 'Emerald', color: 0x10b981 },
  { name: 'Diamond', color: 0x38bdf8 },
  { name: 'Platinum', color: 0x818cf8 },
  { name: 'Free Agent', color: 0x64748b },
  { name: 'Elite Pass', color: 0xa78bfa },
  { name: 'Cup Winner', color: 0xf59e0b },
  { name: 'Tournament Winner', color: 0xf472b6 },
  { name: 'Player of the Month', color: 0x34d399 },
  { name: 'Socials Team', color: 0xec4899 }
]

// ---- channel plan ----
// Each entry: { name, send: 'everyone' | 'admin', topic } (text) or { name, type: 2 } (voice).
const STRUCTURE = [
  { category: 'Welcome', channels: [
    { name: 'welcome', send: 'everyone', topic: `Welcome to the Elite Arrows Darts League! The app is the hub: ${SITE_URL} — install it for scores, tables and prizes.` },
    { name: 'player-guide', send: 'admin', topic: `How the league works: ${pageUrl('/guide')} · Join the league / apply: ${APPLICATIONS_URL}` },
    { name: 'rules', send: 'admin', topic: `Full league rules on the site: ${pageUrl('/rules')}` }
  ]},
  { category: 'Announcements', channels: [
    { name: 'announcements', send: 'admin', topic: `Official league news (auto-posted from the site): ${pageUrl('/news')}` },
    { name: 'giveaways', send: 'admin', topic: `Giveaways & competitions — enter on the site: ${pageUrl('/giveaways')}` },
    { name: 'suggestion-box', send: 'everyone', topic: `Ideas for the league — vote & post on the site: ${pageUrl('/suggestions')}` }
  ]},
  { category: 'Divisions', channels: [
    { name: 'elite-division', send: 'everyone', topic: 'Elite Division — your home channel. Table pinned here automatically.' },
    { name: 'emerald-division', send: 'everyone', topic: 'Emerald Division — your home channel. Table pinned here automatically.' },
    { name: 'diamond-division', send: 'everyone', topic: 'Diamond Division — your home channel. Table pinned here automatically.' },
    { name: 'platinum-division', send: 'everyone', topic: 'Platinum Division — your home channel. Table pinned here automatically.' },
    { name: 'free-agent-league', send: 'everyone', topic: 'Reserves / new players waiting for a league spot (like VDL\u2019s FAL).' }
  ]},
  { category: 'Main League', channels: [
    { name: 'table', send: 'admin', topic: `Live standings — always up to date on the site: ${pageUrl('/table')}` },
    { name: 'fixtures', send: 'everyone', topic: `Upcoming fixtures — full schedule on the site: ${pageUrl('/match-log')}` },
    { name: 'results', send: 'everyone', topic: `Results as they land — full history on the site: ${pageUrl('/results')}` },
    { name: 'submit-score', send: 'everyone', topic: `Submit your match score: ${pageUrl('/submit-result')}` },
    { name: 'commands', send: 'everyone', topic: 'Bot commands live here — type /help to see them all.' }
  ]},
  { category: 'Compete', channels: [
    { name: 'leaderboards', send: 'everyone', topic: `Season leaderboards: ${pageUrl('/leaderboards')}` },
    { name: 'cups', send: 'everyone', topic: `Cup draws, brackets & scores: ${pageUrl('/cups')}` },
    { name: 'cup-draws', send: 'admin', topic: 'Cup draw announcements — full brackets on the site.' },
    { name: 'cup-scores', send: 'everyone', topic: 'Cup results round by round — log them on the site.' },
    { name: 'tournaments', send: 'everyone', topic: `Friendlies, events & tournaments: ${pageUrl('/tournaments')}` },
    { name: 'hall-of-fame', send: 'everyone', topic: `Past champions & legends: ${pageUrl('/hall-of-fame')}` },
    { name: 'player-of-month', send: 'everyone', topic: `Vote for Player of the Month: ${pageUrl('/player-of-month')}` },
    { name: 'statistics', send: 'everyone', topic: `Averages, 180s, checkouts & more: ${pageUrl('/statistics')}` },
    { name: 'daily-challenges', send: 'everyone', topic: `Today\u2019s daily challenges: ${pageUrl('/daily-challenges')}` },
    { name: 'friendly-league', send: 'everyone', topic: `Friendly (Open) League — join up: ${pageUrl('/open-league')}` }
  ]},
  { category: 'Academy', channels: [
    { name: 'practice-hub', send: 'everyone', topic: `Practice games & drills: ${pageUrl('/practice')}` },
    { name: 'darts-academy', send: 'everyone', topic: `Training courses, lessons & tips: ${pageUrl('/training')}` },
    { name: 'progress-tracker', send: 'everyone', topic: `Track your improvement: ${pageUrl('/progress-tracker')}` }
  ]},
  { category: 'Community', channels: [
    { name: 'general', send: 'everyone', topic: 'General darts chat — no league-talk rules here.' },
    { name: 'friendly-matches', send: 'everyone', topic: 'Looking for a game? Post with /lfg and arrange friendlies.' },
    { name: 'darts-talk', send: 'everyone', topic: 'Punditry, gear, technique — all things darts.' },
    { name: 'off-topic', send: 'everyone', topic: 'Anything goes (keep it respectful).' },
    { name: 'memes', send: 'everyone', topic: 'Maxes, bounce-outs and glory shots.' },
    { name: 'mental-health', send: 'everyone', topic: 'A safe space — the league cares about its people.' }
  ]},
  { category: 'Staff & Help', channels: [
    { name: 'support', send: 'everyone', topic: `Need help? Contact the team: ${pageUrl('/support')}` },
    { name: 'contact', send: 'everyone', topic: `Get in touch: ${pageUrl('/contact')}` },
    { name: 'donations', send: 'everyone', topic: `Support the league: ${pageUrl('/donations')} · Merch: ${MERCH_URL}` },
    { name: 'applications', send: 'admin', topic: `Player / role applications: ${APPLICATIONS_URL}` },
    { name: 'sponsors', send: 'admin', topic: 'Sponsorship & partnerships.' }
  ]},
  { category: 'Elite Pass', channels: [
    { name: 'elite-pass', send: 'admin', topic: `Everything the Elite Pass unlocks: ${pageUrl('/subscription')}` },
    { name: 'play-online', send: 'everyone', topic: `Play matches online: ${pageUrl('/play-online')}` },
    { name: 'live-match', send: 'everyone', topic: `Live match tracking: ${pageUrl('/live-match')}` },
    { name: 'premium-chat', send: 'everyone', topic: 'Subscriber chat — for Elite Pass holders.' }
  ]},
  { category: 'Voice', channels: [
    { name: 'match-comms', type: 2 },
    { name: 'tournament-bubbles', type: 2 }
  ]}
]

async function ensureRole(guild, name, color) {
  let role = guild.roles.cache.find(r => r.name === name)
  if (!role) {
    role = await guild.roles.create({ name, mentionable: true, hoist: true, color })
    console.log(`  + role created: @${name}`)
  } else {
    console.log(`  = role exists:   @${name}`)
  }
  return role
}

async function ensureCategory(guild, name) {
  let category = guild.channels.cache.find(c => c.type === 4 && c.name === name)
  if (!category) {
    category = await guild.channels.create({ name, type: 4 })
    console.log(`  + category created: ${name}`)
  } else {
    console.log(`  = category exists:  ${name}`)
  }
  return category
}

async function ensureChannel(guild, parent, name, type, overrides = [], topic) {
  let channel = guild.channels.cache.find(c => c.parentId === parent.id && c.name === name)
  if (!channel) {
    channel = await guild.channels.create({
      name,
      type,
      parent: parent.id,
      permissionOverwrites: overrides,
      topic
    })
    console.log(`  + channel created: #${name}`)
  } else {
    // Refresh topic so channel links track the current site URLs.
    if (topic && channel.topic !== topic) {
      await channel.setTopic(topic)
      console.log(`  ~ topic updated:  #${name}`)
    } else {
      console.log(`  = channel exists:  #${name}`)
    }
  }
  return channel
}

async function main() {
  const token = process.env.DISCORD_TOKEN
  const guildId = process.env.GUILD_ID
  if (!token || !guildId) {
    console.error('Missing DISCORD_TOKEN or GUILD_ID in .env - copy .env.example to .env and fill them in.')
    process.exit(1)
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] })
  await client.login(token)
  const guild = await client.guilds.fetch(guildId)

  console.log(`\nProvisioning "${guild.name}" (Elite Arrows site-mirror structure)...\n`)

  const roles = {}
  for (const { name, color } of ROLES) {
    roles[name] = await ensureRole(guild, name, color)
  }
  const adminRole = roles['Admin']

  for (const group of STRUCTURE) {
    const category = await ensureCategory(guild, group.category)
    for (const channel of group.channels) {
      const type = channel.type ?? 0
      const send = type === 2 ? 'everyone' : channel.send
      const overrides = overwritesFor(guild, adminRole, { everyoneSend: send !== 'admin' })
      await ensureChannel(guild, category, channel.name, type, overrides, channel.topic)
    }
  }

  console.log('\nEvery part of the Elite Arrows site now has a Discord home:')
  console.log('  · Main League (table/fixtures/results/submit-score)'
    + '\n  · Compete (cups, tournaments, HOF, player-of-month, statistics, daily challenges, friendly league)'
    + '\n  · Academy (practice, darts academy, progress tracker)'
    + '\n  · Community + Elite Pass + Staff & Help'
    + '\n  · Channel topics link each room to its page on the site.')
  console.log('\nAssign @Division Captain/@Socials Team to the right people, grant @Elite Pass to subscribers,')
  console.log('then start the bot with: npm start\n')

  await client.destroy()
  process.exit(0)
}

main().catch(err => {
  console.error('Setup failed:', err.message)
  process.exit(1)
})