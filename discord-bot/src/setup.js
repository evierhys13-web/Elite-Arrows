// One-time provisioning: creates the league server structure (roles, categories,
// channels) modelled on the Virtual Darts League (VDL) community format.
//
// VDL-style layout it provisions:
//   - Welcome        #welcome · #rules · #player-guide
//   - Announcements  #announcements · #giveaways
//   - Divisions      #elite-division · #emerald-division · #diamond-division ·
//                    #platinum-division · #free-agent-league (FAL reserves)
//   - League         #fixtures · #results · #table · #commands
//   - Cups & Tournaments  #cup-draws · #cup-scores · #daily-tournaments
//   - Community      #general · #friendly-matches (LFG) · #darts-talk · #off-topic ·
//                    #memes · #mental-health
//   - Staff & Feedback    #suggestions · #reaction-roles · #sponsors
//   - Premium        #premium-leagues · #premium-chat
//   - Voice          #match-comms · #tournament-bubbles
//
// Usage: npm run setup   (reads DISCORD_TOKEN + GUILD_ID from .env)
// Idempotent: existing roles/channels are left untouched.
// The channel names the bot depends on (#table/#results/#fixtures/#announcements/
// #commands) are preserved, so re-running setup never breaks the snapshots.

import 'dotenv/config'
import { Client, GatewayIntentBits, PermissionFlagsBits } from 'discord.js'

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

// ---- role plan (VDL-style team/division roles, on top of the existing Admin/Player) ----
const ROLES = [
  { name: 'Admin', color: 0xfbbf24 },
  { name: 'Player', color: 0x38bdf8 },
  { name: 'Division Captain', color: 0x10b981 },
  { name: 'Elite', color: 0xfbbf24 },
  { name: 'Emerald', color: 0x10b981 },
  { name: 'Diamond', color: 0x38bdf8 },
  { name: 'Platinum', color: 0x818cf8 },
  { name: 'Free Agent', color: 0x64748b },
  { name: 'Premium', color: 0xa78bfa },
  { name: 'Cup Winner', color: 0xf59e0b },
  { name: 'Tournament Winner', color: 0xf472b6 },
  { name: 'Socials Team', color: 0xec4899 }
]

// ---- channel plan ----
// Each entry: { name, send: 'everyone' | 'admin' } (text) or { name, type: 2 } (voice).
const STRUCTURE = [
  { category: 'Welcome', channels: [
    { name: 'welcome', send: 'everyone' },
    { name: 'rules', send: 'admin' },
    { name: 'player-guide', send: 'admin' }
  ]},
  { category: 'Announcements', channels: [
    { name: 'announcements', send: 'admin' },
    { name: 'giveaways', send: 'admin' }
  ]},
  { category: 'Divisions', channels: [
    { name: 'elite-division', send: 'everyone' },
    { name: 'emerald-division', send: 'everyone' },
    { name: 'diamond-division', send: 'everyone' },
    { name: 'platinum-division', send: 'everyone' },
    { name: 'free-agent-league', send: 'everyone' }
  ]},
  { category: 'League', channels: [
    { name: 'fixtures', send: 'everyone' },
    { name: 'results', send: 'everyone' },
    { name: 'table', send: 'admin' },
    { name: 'commands', send: 'everyone' }
  ]},
  { category: 'Cups & Tournaments', channels: [
    { name: 'cup-draws', send: 'admin' },
    { name: 'cup-scores', send: 'everyone' },
    { name: 'daily-tournaments', send: 'everyone' }
  ]},
  { category: 'Community', channels: [
    { name: 'general', send: 'everyone' },
    { name: 'friendly-matches', send: 'everyone' },
    { name: 'darts-talk', send: 'everyone' },
    { name: 'off-topic', send: 'everyone' },
    { name: 'memes', send: 'everyone' },
    { name: 'mental-health', send: 'everyone' }
  ]},
  { category: 'Staff & Feedback', channels: [
    { name: 'suggestions', send: 'everyone' },
    { name: 'reaction-roles', send: 'admin' },
    { name: 'sponsors', send: 'admin' }
  ]},
  { category: 'Premium', channels: [
    { name: 'premium-leagues', send: 'admin' },
    { name: 'premium-chat', send: 'everyone' }
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

async function ensureChannel(guild, parent, name, type, overrides = []) {
  let channel = guild.channels.cache.find(c => c.parentId === parent.id && c.name === name)
  if (!channel) {
    channel = await guild.channels.create({
      name,
      type,
      parent: parent.id,
      permissionOverwrites: overrides
    })
    console.log(`  + channel created: #${name}`)
  } else {
    console.log(`  = channel exists:  #${name}`)
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

  console.log(`\nProvisioning "${guild.name}" (VDL-style structure)...\n`)

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
      await ensureChannel(guild, category, channel.name, type, overrides)
    }
  }

  console.log('\nThis is what VDL-style room looks like:')
  console.log('  · #welcome / #rules / #player-guide - onboarding, reaction roles'
    + '\n  · per-division channels (#elite-division … #free-agent-league) - one per league, like VDL'
    + '\n  · #cup-draws / #cup-scores / #daily-tournaments - Ally Pally-style cups + daily tournaments'
    + '\n  · #friendly-matches - LFG friendly-match requests'
    + '\n  · #mental-health / #off-topic / #memes - community corner'
    + '\n  · #premium-leagues / #premium-chat - premium section'
    + '\n  · @Division Captain run their division channel; division roles (@Elite etc.) used for pings')
  console.log('\nAssign @Division Captain/@Socials Team to the right people, grant @Premium to subscribers,')
  console.log('then start the bot with: npm start\n')

  await client.destroy()
  process.exit(0)
}

main().catch(err => {
  console.error('Setup failed:', err.message)
  process.exit(1)
})