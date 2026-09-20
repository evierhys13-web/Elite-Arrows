// Elite Arrows darts league Discord bot.
// v1 scope: mirror the app's league table, results and fixtures on Discord,
// plus announcements. Data comes from Firestore and mirrors the app's own
// scoring logic (see scoring.js / standings.js).

import 'dotenv/config'
import http from 'node:http'
import {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  SlashCommandBuilder
} from 'discord.js'
import {
  startListeners,
  getUsers,
  getResults,
  getFixtures,
  getSeasons,
  getAdminData,
  onDataChanged,
  onNewResult,
  onNewNews,
  resolveResultPlayerName,
  getDivisionForResult
} from './firebase.js'
import { buildStandings, getCurrentSeason } from './standings.js'
import {
  tableEmbed,
  resultEmbed,
  upcomingLeagueFixtures,
  fixturesEmbed,
  newsEmbed,
  recentLeagueResults,
  resultsEmbed
} from './format.js'

const DIVISION_CHOICES = ['Overall', 'Elite', 'Emerald', 'Diamond', 'Platinum']

// ---- tiny keep-alive health server (Render free tier spins down otherwise) ----
const port = Number(process.env.PORT) || 8080
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ ok: true, service: 'elite-arrows-discord-bot' }))
}).listen(port, () => {
  console.log(`health server listening on :${port} — /healthz`)
})

// ---- table message tracking (in-memory; /post-table re-creates after restart) ----
const tableMessages = new Map() // division -> { channelId, messageId }
let tablePosted = false
let hostGuild = null

async function findChannel(name) {
  if (!hostGuild) return null
  try {
    const channels = await hostGuild.channels.fetch()
    return channels.find(c => c.name === name && c.type === 0) || null
  } catch (e) {
    console.error(`could not fetch channels: ${e.message}`)
    return null
  }
}

function buildTables() {
  return buildStandings({
    users: getUsers(),
    results: getResults(),
    fixtures: getFixtures(),
    seasons: getSeasons(),
    adminData: getAdminData(),
    selectedSeason: null
  })
}

async function postTableMessage(division, embed) {
  const channel = await findChannel('table')
  if (!channel) {
    console.error('no #table channel found - run `npm run setup` or create it')
    return
  }
  const existing = tableMessages.get(division)
  if (existing) {
    try {
      const msg = await channel.messages.fetch(existing.messageId)
      await msg.edit({ embeds: [embed] })
      return
    } catch (e) {
      tableMessages.delete(division)
    }
  }
  const sent = await channel.send({ embeds: [embed] })
  tableMessages.set(division, { channelId: channel.id, messageId: sent.id })
}

async function refreshTableMessages(sendMissing = true) {
  const tables = buildTables()
  const season = getCurrentSeason(getAdminData())
  const divisions = ['Overall', ...DIVISION_CHOICES.filter(d => d !== 'Overall')]
  for (const division of divisions) {
    const rows = tables[division]
    if (!rows) continue
    const hadMessage = tableMessages.has(division)
    if (!hadMessage && !sendMissing && !tablePosted) continue
    try {
      await postTableMessage(division, tableEmbed({ division, rows, season }))
    } catch (e) {
      console.error(`table post failed for ${division}: ${e.message}`)
    }
  }
  tablePosted = true
}

let tableTimer = null
function scheduleTableRefresh() {
  clearTimeout(tableTimer)
  tableTimer = setTimeout(() => {
    refreshTableMessages(false).catch(e => console.error('auto table refresh failed:', e.message))
  }, 30000)
}

// ---- admin gate (Admins only model) ----
function isAdminUser(interaction) {
  if (!interaction.member) return false
  if (interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) return true
  return interaction.member.roles.cache.some(r => r.name === 'Admin')
}

// ---- command declarations ----
const commands = [
  new SlashCommandBuilder()
    .setName('table')
    .setDescription('Current league table')
    .addStringOption(o => o.setName('division').setDescription('Division (default Overall)').setRequired(false)
      .addChoices(...DIVISION_CHOICES.map(d => ({ name: d, value: d })))),
  new SlashCommandBuilder()
    .setName('results')
    .setDescription('Recent league results')
    .addStringOption(o => o.setName('division').setDescription('Division filter').setRequired(false)
      .addChoices(...DIVISION_CHOICES.slice(1).map(d => ({ name: d, value: d })))),
  new SlashCommandBuilder()
    .setName('fixtures')
    .setDescription('Upcoming league fixtures'),
  new SlashCommandBuilder()
    .setName('next-match')
    .setDescription('The next few league fixtures'),
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('What this bot can do'),
  new SlashCommandBuilder()
    .setName('post-table')
    .setDescription('[Admin] Post/refresh the league table in #table'),
  new SlashCommandBuilder()
    .setName('post-fixtures')
    .setDescription('[Admin] Post upcoming fixtures to #fixtures'),
  new SlashCommandBuilder()
    .setName('post-announcement')
    .setDescription('[Admin] Post an announcement to #announcements')
    .addStringOption(o => o.setName('title').setDescription('Announcement title').setRequired(true))
    .addStringOption(o => o.setName('message').setDescription('Announcement message').setRequired(true))
    .addBooleanOption(o => o.setName('mention').setDescription('Mention @everyone').setRequired(false))
]

const permissionDenied = (interaction) =>
  interaction.reply({
    content: ':no_entry_sign: This command is restricted to **Admins** only.',
    ephemeral: true
  })

async function handleCommand(interaction) {
  const name = interaction.commandName
  const season = getCurrentSeason(getAdminData())

  switch (name) {
    case 'table': {
      const requested = interaction.options.getString('division') || 'Overall'
      const tables = buildTables()
      const division = tables[requested] ? requested : 'Overall'
      await interaction.reply({ embeds: [tableEmbed({ division, rows: tables[division], season })] })
      return
    }
    case 'results': {
      const requested = interaction.options.getString('division')
      let entries = recentLeagueResults(getResults(), getUsers(), getFixtures(), season, 10)
      if (requested && requested !== 'Overall') entries = entries.filter(e => e.division === requested)
      await interaction.reply({ embeds: [resultsEmbed(entries, season)] })
      return
    }
    case 'fixtures': {
      const fixtures = upcomingLeagueFixtures(getFixtures(), getUsers(), season)
      await interaction.reply({ embeds: [fixturesEmbed(fixtures, season, 8)] })
      return
    }
    case 'next-match': {
      const fixtures = upcomingLeagueFixtures(getFixtures(), getUsers(), season)
      await interaction.reply({ embeds: [fixturesEmbed(fixtures, season, 4)] })
      return
    }
    case 'help': {
      await interaction.reply({
        embeds: [{
          color: 0x38bdf8,
          title: '\u{1F916} Elite Arrows Bot',
          description: 'Live data straight from the Elite Arrows app.',
          fields: [
            { name: '/table', value: 'Current league standings (use division option for a specific division).', inline: false },
            { name: '/results', value: 'The most recent league results.', inline: false },
            { name: '/fixtures', value: 'Who is playing next, and when.', inline: false },
            { name: '/next-match', value: 'Quick look at the next few fixtures.', inline: false },
            { name: 'Auto-posts', value: 'New approved results land in **#results** and new announcements in **#announcements**.', inline: false },
            { name: 'Admin commands', value: '/post-table · /post-fixtures · /post-announcement', inline: false }
          ]
        }]
      })
      return
    }
    case 'post-table': {
      if (!isAdminUser(interaction)) return permissionDenied(interaction)
      await interaction.deferReply({ ephemeral: true })
      await refreshTableMessages(true)
      await interaction.editReply({ content: ':white_check_mark: **#table** updated.' })
      return
    }
    case 'post-fixtures': {
      if (!isAdminUser(interaction)) return permissionDenied(interaction)
      const fixtures = upcomingLeagueFixtures(getFixtures(), getUsers(), season)
      const channel = await findChannel('fixtures')
      if (!channel) return interaction.reply({ content: ':x: No #fixtures channel found.', ephemeral: true })
      await channel.send({ embeds: [fixturesEmbed(fixtures, season, 8)] })
      await interaction.reply({ content: ':white_check_mark: Fixtures posted to **#fixtures**.', ephemeral: true })
      return
    }
    case 'post-announcement': {
      if (!isAdminUser(interaction)) return permissionDenied(interaction)
      const title = interaction.options.getString('title', true)
      const message = interaction.options.getString('message', true)
      const mention = interaction.options.getBoolean('mention') === true
      const channel = await findChannel('announcements')
      if (!channel) return interaction.reply({ content: ':x: No #announcements channel found.', ephemeral: true })
      const embed = newsEmbed({ title, message, authorName: interaction.member.displayName, createdAt: new Date().toISOString() })
      await channel.send({ embeds: [embed], content: mention ? '@everyone' : undefined })
      await interaction.reply({ content: ':white_check_mark: Announcement posted to **#announcements**.', ephemeral: true })
      return
    }
  }
}

async function main() {
  await startListeners()

  const client = new Client({ intents: [GatewayIntentBits.Guilds] })

  client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`)
    client.user.setActivity('the league table', { type: 3 /* Watching */ })

    hostGuild = client.guilds.cache.get(process.env.GUILD_ID) || null
    if (!hostGuild) {
      console.warn(`GUILD_ID ${process.env.GUILD_ID} not found - is the bot invited?`)
    } else {
      await client.application.commands.set(commands.map(c => c.toJSON()), hostGuild.id)
      console.log(`Registered ${commands.length} commands in ${hostGuild.name}`)
    }
  })

  client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return
    try {
      await handleCommand(interaction)
    } catch (e) {
      console.error(`command ${interaction.commandName} failed:`, e)
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ content: `:x: Something went wrong: ${e.message}` })
      } else {
        await interaction.reply({ content: `:x: Something went wrong: ${e.message}`, ephemeral: true })
      }
    }
  })

  // ---- live data mirrors ----
  onNewResult(async result => {
    const channel = await findChannel('results')
    if (!channel) return console.error('no #results channel found')
    const embed = resultEmbed(
      result,
      { resolveName: resolveResultPlayerName, divisionForResult: getDivisionForResult }
    )
    try {
      await channel.send({ embeds: [embed] })
    } catch (e) {
      console.error('failed to post result:', e.message)
    }
    scheduleTableRefresh()
  })

  onNewNews(async news => {
    const channel = await findChannel('announcements')
    if (!channel) return console.error('no #announcements channel found')
    const embed = newsEmbed(news)
    try {
      await channel.send({ embeds: [embed], content: news.pinned ? '@everyone' : undefined })
    } catch (e) {
      console.error('failed to post announcement:', e.message)
    }
  })

  onDataChanged(() => scheduleTableRefresh())

  await client.login(process.env.DISCORD_TOKEN)

  const shutdown = async () => {
    console.log('shutting down...')
    try { await client.destroy() } catch {}
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})