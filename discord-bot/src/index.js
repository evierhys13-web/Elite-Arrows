// Elite Arrows darts league Discord bot.
// Purpose: take snapshots of the league's relevant info (table, results,
// fixtures) and keep them posted in the matching channels, updated automatically
// as data changes. Data comes from Firestore and mirrors the app's own scoring
// logic (see scoring.js / standings.js).

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
  refreshResultsCache,
  isCoreDataAvailable,
  isCollectionSynced,
  getResultsReadable,
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
  resultsEmbed,
  rankForStat,
  recordsEmbed,
  relayResultEmbed
} from './format.js'
import { SITE_URL, SITE_SECTIONS, pageUrl, APPLICATIONS_URL, MERCH_URL } from './site.js'

const DIVISION_CHOICES = ['Overall', 'Elite', 'Emerald', 'Diamond', 'Platinum']

// ---- tiny keep-alive + liveness health server (Render free tier spins down otherwise) ----
// Also serves the app's zero-read webhook relay: the website POSTs approved
// results / news here, the bot posts them to Discord. No Firestore reads.
const port = Number(process.env.PORT) || 8080
const RELAY_MODE = process.env.DISCORD_RELAY_MODE === 'webhook'
const RELAY_SECRET = process.env.DISCORD_RELAY_SECRET || ''

const readBody = (req) => new Promise((resolve, reject) => {
  let data = ''
  req.on('data', chunk => { data += chunk; if (data.length > 5e6) req.destroy() })
  req.on('end', () => {
    try { resolve(data ? JSON.parse(data) : {}) } catch (e) { reject(e) }
  })
  req.on('error', reject)
})

function sendJson(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-elite-arrows-secret'
  })
  res.end(JSON.stringify(body))
}

http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return sendJson(res, 204, {})

  if (req.method === 'GET') {
    if (req.url.startsWith('/healthz') || req.url === '/') {
      return sendJson(res, 200, {
        ok: true,
        service: 'elite-arrows-discord-bot',
        relay: RELAY_MODE,
        uptime: Math.round(process.uptime())
      })
    }
    return sendJson(res, 404, { ok: false })
  }

  if (req.method === 'POST' && req.url.startsWith('/webhooks/')) {
    if (RELAY_SECRET) {
      const provided = req.headers['x-elite-arrows-secret']
      if (provided !== RELAY_SECRET) return sendJson(res, 401, { ok: false, error: 'unauthorized' })
    }
    let payload
    try {
      payload = await readBody(req)
    } catch {
      return sendJson(res, 400, { ok: false, error: 'invalid json' })
    }

    try {
      if (req.url === '/webhooks/result' && payload.result) {
        const channel = await findChannel('results')
        if (!channel) return sendJson(res, 200, { ok: false, error: 'no #results channel' })
        const embed = relayResultEmbed(payload.result)
        await channel.send({ embeds: [embed] })
        return sendJson(res, 200, { ok: true, posted: 'result' })
      }
      if (req.url === '/webhooks/results' && Array.isArray(payload.results)) {
        const channel = await findChannel('results')
        if (!channel) return sendJson(res, 200, { ok: false, error: 'no #results channel' })
        const embeds = payload.results.slice(0, 10).map(relayResultEmbed)
        await channel.send({ embeds })
        return sendJson(res, 200, { ok: true, posted: embeds.length })
      }
      if (req.url === '/webhooks/news' && payload.news) {
        const channel = await findChannel('announcements')
        if (!channel) return sendJson(res, 200, { ok: false, error: 'no #announcements channel' })
        const embed = newsEmbed({ ...payload.news, authorName: payload.news.authorName })
        await channel.send({
          embeds: [embed],
          content: payload.news.pinned ? '@everyone' : undefined
        })
        return sendJson(res, 200, { ok: true, posted: 'news' })
      }
      return sendJson(res, 400, { ok: false, error: 'unknown webhook' })
    } catch (e) {
      console.error(`webhook ${req.url} failed:`, e.message)
      return sendJson(res, 500, { ok: false, error: e.message })
    }
  }

  return sendJson(res, 404, { ok: false })
}).listen(port, () => {
  console.log(`health server listening on :${port} — /healthz (relay mode: ${RELAY_MODE ? 'webhook' : 'firestore'})`)
})

let hostGuild = null

const stripEmoji = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[\u{1F000}-\u{1FFFF}\u{1FA00}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]+/gu, '')
    .replace(/[^a-z0-9]/g, '')

async function findChannel(name) {
  if (!hostGuild) return null
  try {
    const channels = await hostGuild.channels.fetch()
    const keyword = stripEmoji(name)
    return channels.find(c =>
      c.type === 0 &&
      (c.name === name || stripEmoji(c.name) === keyword || stripEmoji(c.name).includes(keyword))
    ) || null
  } catch (e) {
    console.error(`could not fetch channels: ${e.message}`)
    return null
  }
}

// VDL-style per-division channels are named `<division>-division` (e.g. #elite-division).
async function findDivisionChannel(division) {
  if (!hostGuild) return null
  try {
    const channels = await hostGuild.channels.fetch()
    const target = `${stripEmoji(division)}-division`
    return channels.find(c => c.type === 0 && stripEmoji(c.name) === target) || null
  } catch (e) {
    console.error(`could not fetch division channels: ${e.message}`)
    return null
  }
}

// ---- snapshot engine: one maintained message per snapshot, edited in place ----
const snapshotMessages = new Map() // key -> { channelId, messageId }

async function postOrEdit(key, channel, embed) {
  const existing = snapshotMessages.get(key)
  if (existing && existing.channelId === channel.id) {
    try {
      const msg = await channel.messages.fetch(existing.messageId)
      if (msg) {
        await msg.edit({ embeds: [embed] })
        return
      }
    } catch (e) {
      snapshotMessages.delete(key)
    }
  }
  const sent = await channel.send({ embeds: [embed] })
  snapshotMessages.set(key, { channelId: channel.id, messageId: sent.id })
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

async function applySnapshots() {
  // If we cannot read Firestore and have no cached data yet, don't post anything:
  // an empty snapshot would look like a genuine "no data" state when it's really a
  // temporary outage. Existing snapshot messages are left untouched.
  if (!isCoreDataAvailable()) {
    console.log('data unavailable - skipping snapshot sync (no misleading empty embeds)')
    return
  }

  const tables = buildTables()
  const season = getCurrentSeason(getAdminData())

  // Table + results depend on the results read. If results haven't been readable yet
  // (quota outage, no cache), skip them rather than post misleading empty/zero data.
  const resultsReadable = getResultsReadable()

  // #table: one message per division (Overall + each division).
  const tableChannel = await findChannel('table')
  let postedTables = 0
  if (resultsReadable) {
    if (tableChannel) {
      for (const division of DIVISION_CHOICES) {
        const rows = tables[division]
        if (!rows || !rows.length) continue
        await postOrEdit(`table:${division}`, tableChannel, tableEmbed({ division, rows, season }))
        postedTables += 1
      }
    } else {
      console.error('no #table channel found for snapshot')
    }

    // VDL-style: each division also gets its own table pinned in its own channel.
    for (const division of DIVISION_CHOICES.slice(1)) {
      const rows = tables[division]
      if (!rows || !rows.length) continue
      const divChannel = await findDivisionChannel(division)
      if (!divChannel) continue
      await postOrEdit(`table:${division}`, divChannel, tableEmbed({ division, rows, season }))
    }
  } else {
    console.log('results not readable - skipping #table snapshot')
  }

  // #results: the 12 most recent league results.
  if (resultsReadable) {
    const resultsChannel = await findChannel('results')
    if (resultsChannel) {
      const entries = recentLeagueResults(getResults(), getUsers(), getFixtures(), season, 12)
      await postOrEdit('results', resultsChannel, resultsEmbed(entries, season))
    } else {
      console.error('no #results channel found for snapshot')
    }
  } else {
    console.log('results not readable - skipping #results snapshot')
  }

  // #fixtures: the next upcoming league fixtures (real value from the live watch or cache).
  if (isCollectionSynced('fixtures')) {
    const fixturesChannel = await findChannel('fixtures')
    if (fixturesChannel) {
      const fixtures = upcomingLeagueFixtures(getFixtures(), getUsers(), season)
      await postOrEdit('fixtures', fixturesChannel, fixturesEmbed(fixtures, season, 8))
    } else {
      console.error('no #fixtures channel found for snapshot')
    }
  } else {
    console.log('fixtures not synced - skipping #fixtures snapshot')
  }

  console.log(`snapshots synced: #table x${postedTables}, #results, #fixtures (${season})`)
}

let snapshotDebounce = null
function scheduleSnapshots() {
  clearTimeout(snapshotDebounce)
  snapshotDebounce = setTimeout(() => {
    applySnapshots().catch(e => console.error('snapshot refresh failed:', e.message))
  }, 15000)
}

// Refresh data from Firestore once a cycle, then resync the snapshots.
async function refreshCycle() {
  await refreshResultsCache()
  await applySnapshots()
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
    .setName('records')
    .setDescription('League record holders (180s, average, checkout, wins)')
    .addStringOption(o => o.setName('stat').setDescription('Record to show').setRequired(false)
      .addChoices(
        { name: 'Most 180s', value: '180s' },
        { name: 'Best average', value: 'average' },
        { name: 'Best checkout', value: 'checkout' },
        { name: 'Most wins', value: 'wins' }
      )),
  new SlashCommandBuilder()
    .setName('lfg')
    .setDescription('Post a friendly-match request to #friendly-matches')
    .addStringOption(o => o.setName('format').setDescription('Format you want to play').setRequired(false))
    .addStringOption(o => o.setName('when').setDescription('When you are free').setRequired(false))
    .addStringOption(o => o.setName('details').setDescription('Anything else (DartCounter id, rules…)').setRequired(false)),
  new SlashCommandBuilder()
    .setName('division')
    .setDescription('Join or leave your division role (drives the per-division channels)')
    .addStringOption(o => o.setName('role').setDescription('Which division you play in').setRequired(true)
      .addChoices(...DIVISION_CHOICES.slice(1).map(d => ({ name: d, value: d }))))
    .addBooleanOption(o => o.setName('leave').setDescription('Remove the role instead of adding it').setRequired(false)),
  new SlashCommandBuilder()
    .setName('links')
    .setDescription('Every Elite Arrows site page, one click away'),
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('What this bot can do'),
  new SlashCommandBuilder()
    .setName('post-table')
    .setDescription('[Admin] Snapshot the league table into #table'),
  new SlashCommandBuilder()
    .setName('post-fixtures')
    .setDescription('[Admin] Snapshot the upcoming fixtures into #fixtures'),
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
    case 'records': {
      const stat = interaction.options.getString('stat') || '180s'
      const tables = buildTables()
      const entries = rankForStat(tables.Overall || [], stat)
      await interaction.reply({ embeds: [recordsEmbed(entries, stat, season)] })
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
            { name: '/records', value: 'League record holders — 180s, averages, best checkouts, wins.', inline: false },
            { name: '/lfg', value: 'Looking for game — post a friendly-match request to **#friendly-matches**.', inline: false },
            { name: '/division', value: 'Join/leave your division role so matches and reminders ping the right channel.', inline: false },
            { name: '/links', value: 'Every page of the Elite Arrows site, one click away.', inline: false },
            { name: 'Auto-snapshots', value: 'The bot keeps **#table** (and each **#<division>-division** channel) updated automatically as results come in.', inline: false },
            { name: 'Auto-posts', value: 'New approved results land in **#results** and new announcements in **#announcements**.', inline: false },
            { name: 'Admin commands', value: '/post-table · /post-fixtures · /post-announcement', inline: false }
          ]
        }]
      })
      return
    }
    case 'lfg': {
      const format = interaction.options.getString('format') || 'friendly match'
      const when = interaction.options.getString('when') || 'anytime'
      const details = interaction.options.getString('details') || ''
      const channel = await findChannel('friendly-matches')
      if (!channel) {
        return interaction.reply({ content: ':x: No #friendly-matches channel found — did you run `npm run setup`?', ephemeral: true })
      }
      const lines = [`**${interaction.member.displayName}** is looking for a **${format}**.`, `When: ${when}`, details].filter(Boolean)
      await channel.send({ embeds: [{
        color: 0x38bdf8,
        title: '\u{1F3AF} LFG — Friendly Match',
        description: lines.join('\n'),
        timestamp: new Date().toISOString()
      }] })
      await interaction.reply({ content: `:white_check_mark: Request posted to **#friendly-matches**.`, ephemeral: true })
      return
    }
    case 'division': {
      const roleName = interaction.options.getString('role', true)
      const leave = interaction.options.getBoolean('leave') === true
      const role = hostGuild?.roles.cache.find(r => r.name === roleName)
      if (!role) {
        return interaction.reply({ content: `:x: Could not find the **@${roleName}** role — did you run \`npm run setup\`?`, ephemeral: true })
      }
      if (!interaction.member) {
        return interaction.reply({ content: ':x: Could not read your roles.', ephemeral: true })
      }
      const has = interaction.member.roles.cache.has(role.id)
      if (leave || has) {
        await interaction.member.roles.remove(role)
        await interaction.reply({ content: `:outbox_tray: Removed **@${roleName}**.`, ephemeral: true })
      } else {
        await interaction.member.roles.add(role)
        await interaction.reply({ content: `:inbox_tray: Added **@${roleName}**.`, ephemeral: true })
      }
      return
    }
    case 'links': {
      const fields = SITE_SECTIONS.map(section => ({
        name: section.name,
        value: section.items.map(item => `- **[${item.label}](${pageUrl(item.path)})**`).join('\n'),
        inline: false
      }))
      fields.push(
        { name: 'Player / Role Applications', value: `- [Apply here](${APPLICATIONS_URL})`, inline: false },
        { name: 'Merch', value: `- [Elite Arrows Merch](${MERCH_URL})`, inline: false }
      )
      await interaction.reply({
        embeds: [{
          color: 0xfbbf24,
          title: '\u{1F517} Elite Arrows — Everything on the Site',
          description: `The app is the hub. Every page, one click: **${SITE_URL}**`,
          fields
        }]
      })
      return
    }
    case 'post-table':
    case 'post-fixtures': {
      if (!isAdminUser(interaction)) return permissionDenied(interaction)
      await interaction.deferReply({ ephemeral: true })
      await refreshCycle()
      await interaction.editReply({ content: ':white_check_mark: Snapshots updated in **#table**, **#results** and **#fixtures**.' })
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

    // Initial snapshot, then keep them fresh on a cycle (data refetch + resync).
    // The cycle is gentle (2h) to respect the project's free Firestore read quota;
    // live changes are handled by the Firestore watchers, not this timer.
    refreshCycle().catch(e => console.error('initial snapshot failed:', e.message))
    setInterval(() => {
      refreshCycle().catch(e => console.error('periodic snapshot failed:', e.message))
    }, 2 * 60 * 60 * 1000)
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

  // ---- live mirrors ----
  // In relay mode the app pushes new results/news to the webhook endpoints, so
  // don't double-post from the Firestore watchers. The watchers still refresh
  // the table/results snapshots.
  onNewResult(async result => {
    const channel = !RELAY_MODE ? await findChannel('results') : null
    if (channel) {
      const embed = resultEmbed(
        result,
        { resolveName: resolveResultPlayerName, divisionForResult: getDivisionForResult }
      )
      try {
        await channel.send({ embeds: [embed] })
      } catch (e) {
        console.error('failed to post result:', e.message)
      }
    }
    // Results cache is refreshed by the watcher; resync the channel snapshots shortly after.
    scheduleSnapshots()
  })

  onNewNews(async news => {
    const channel = !RELAY_MODE ? await findChannel('announcements') : null
    if (!channel) return console[RELAY_MODE ? 'debug' : 'error']('announcements relay handled by webhook' + (RELAY_MODE ? '' : ': no channel found'))
    const embed = newsEmbed(news)
    try {
      await channel.send({ embeds: [embed], content: news.pinned ? '@everyone' : undefined })
    } catch (e) {
      console.error('failed to post announcement:', e.message)
    }
  })

  onDataChanged(() => scheduleSnapshots())

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
  console.error('Fatal:', err.stack || err.message)
  process.exit(1)
})