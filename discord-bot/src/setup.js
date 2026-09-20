// One-time provisioning: creates the league server structure (roles, categories,
// channels) with the "Admins only" permission model from the plan.
//
// Usage: npm run setup   (reads DISCORD_TOKEN + GUILD_ID from .env)
// Idempotent: existing roles/channels are left untouched.

import 'dotenv/config'
import { Client, GatewayIntentBits, PermissionFlagsBits } from 'discord.js'

const ALLOW_EVERYONE = [
  PermissionFlagsBits.ViewChannel
]

const DENY_EVERYONE = []

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

function overwritesFor(guild, { everyoneSend = true }) {
  const ow = []
  if (!everyoneSend) {
    ow.push({ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] })
  } else {
    ow.push({ id: guild.roles.everyone.id, allow: [PermissionFlagsBits.SendMessages] })
  }
  ow.push({ id: guild.roles.everyone.id, allow: ALLOW_EVERYONE, deny: DENY_EVERYONE })
  return ow
}

async function ensureRole(guild, name, options = {}) {
  let role = guild.roles.cache.find(r => r.name === name)
  if (!role) {
    role = await guild.roles.create({ name, mentionable: true, hoist: true, ...options })
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

  console.log(`\nProvisioning "${guild.name}"...\n`)

  const adminRole = await ensureRole(guild, 'Admin', { colors: [0xfbbf24] })
  const playerRole = await ensureRole(guild, 'Player', { colors: [0x38bdf8] })

  const adminOverrides = ow => [
    ...ow,
    { id: adminRole.id, allow: ADMIN_OVERWRITES }
  ]

  // Announcements
  const announcements = await ensureCategory(guild, 'Announcements')
  const announceOverrides = adminOverrides(overwritesFor(guild, { everyoneSend: false }))
  await ensureChannel(guild, announcements, 'announcements', 0, announceOverrides)

  // League
  const league = await ensureCategory(guild, 'League')
  const everyoneOw = overwritesFor(guild, { everyoneSend: true })
  await ensureChannel(guild, league, 'fixtures', 0, adminOverrides(everyoneOw))
  await ensureChannel(guild, league, 'results', 0, adminOverrides(everyoneOw))
  await ensureChannel(guild, league, 'table', 0, adminOverrides(overwritesFor(guild, { everyoneSend: false })))
  await ensureChannel(guild, league, 'commands', 0, adminOverrides(everyoneOw))

  // Social
  const social = await ensureCategory(guild, 'Social')
  await ensureChannel(guild, social, 'general', 0, adminOverrides(everyoneOw))
  await ensureChannel(guild, social, 'suggestions', 0, adminOverrides(everyoneOw))

  // Voice
  const voice = await ensureCategory(guild, 'Voice')
  const voiceOverrides = adminOverrides(overwritesFor(guild, { everyoneSend: true }))
  await ensureChannel(guild, voice, 'match-comms', 2, voiceOverrides)

  console.log('\nDone! Recommended invite link (Administrator permission so the bot can manage channels):')
  console.log(`https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`)
  console.log('\nAssign @Admin to your co-admins, then start the bot with: npm start\n')

  await client.destroy()
  process.exit(0)
}

main().catch(err => {
  console.error('Setup failed:', err.message)
  process.exit(1)
})