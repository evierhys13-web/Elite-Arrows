// Lightweight Discord relay. Instead of the bot polling Firestore (which costs
// reads/listeners), the app PUSHES to the bot's HTTP webhook endpoints when
// something new happens (result approved, news posted). The bot then posts to
// Discord. This costs ZERO extra Firestore operations.
//
// The relay base URL + optional secret are read from adminData (set in the
// Admin panel -> Settings -> Discord relay), so no extra Firestore reads either.

const RELAY_TIMEOUT_MS = 4000

function relayBaseUrl(adminData) {
  const base = adminData?.discordRelayUrl || adminData?.discordBotUrl || ''
  return String(base).trim().replace(/\/+$/, '')
}

export function isDiscordRelayConfigured(adminData) {
  return Boolean(relayBaseUrl(adminData))
}

async function post(adminData, endpoint, payload) {
  const base = relayBaseUrl(adminData)
  if (!base) return null
  const secret = adminData?.discordRelaySecret || ''
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), RELAY_TIMEOUT_MS)
    const res = await fetch(`${base}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secret ? { 'x-elite-arrows-secret': secret } : {})
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    })
    clearTimeout(timer)
    return res.ok ? res.json() : null
  } catch (e) {
    // Fire-and-forget relay: never let a slow/unreachable bot block the app.
    return null
  }
}

// Called after a single result is approved.
export function pushResultApproved(adminData, result) {
  return post(adminData, '/webhooks/result', {
    type: 'result',
    result
  })
}

// Called after bulk approvals - one batched announcement.
export function pushResultsApproved(adminData, results) {
  if (!Array.isArray(results) || !results.length) return null
  return post(adminData, '/webhooks/results', {
    type: 'results',
    results
  })
}

// Called after news is created.
export function pushNews(adminData, news) {
  return post(adminData, '/webhooks/news', {
    type: 'news',
    news
  })
}