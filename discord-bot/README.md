# Elite Arrows Discord Bot

Mirrors the Elite Arrows darts league on Discord: the **league table**, **results**, **fixtures** and **announcements**, straight from the app's Firestore (same scoring logic as the app, so the numbers always match).

## What you get

| Feature | How |
| --- | --- |
| `/table [division]` | Full standings (Overall + each division) |
| `/results [division]` | Recent league results |
| `/fixtures` / `/next-match` | Upcoming league fixtures |
| Auto: new approved result → post to `#results` | Listens to Firestore |
| Auto: new announcement (news) → post to `#announcements` | Listens to Firestore |
| `/post-table` | [Admin] Post/refresh the pinned table in `#table` |
| `/post-fixtures` | [Admin] Post fixtures to `#fixtures` |
| `/post-announcement` | [Admin] Post to `#announcements` (optional @everyone) |
| `npm run setup` | Creates roles, categories and channels for you |

Admins-only model: only people with the **@Admin** role (or Manage Server) can use the admin commands.

## Setup (one time, ~10 minutes)

### 1. Create the server (Discord app)
Discord → server list → **+** → "Create My Own" → name it *Elite Arrows Darts League*.

### 2. Create the bot application
1. Go to <https://discord.com/developers/applications> → **New Application** → name it *Elite Arrows*.
2. **Bot** → **Reset Token** → copy it (called `DISCORD_TOKEN`).
3. In **OAuth2 → URL Generator**: scope `bot` + `applications.commands`, permissions **Administrator** (simplest — it needs to manage channels/roles/messages). Open the generated URL and add the bot to your server.

### 3. Get your server ID
Discord → **Settings → Advanced → Developer Mode** on → right-click your server name → **Copy Server ID** (called `GUILD_ID`).

### 4. Download the Firebase service-account key
Firebase console → **Project settings → Service accounts** → **Generate new private key** → save as `discord-bot/service-account.json`.
> This needs to be done once from the Firebase console — it's the only console step for this setup. The key is never committed to git.

### 5. Configure
```
cd discord-bot
cp .env.example .env
```
Fill `.env` with your `DISCORD_TOKEN`, `GUILD_ID`, and point at your key:
```
FIREBASE_SERVICE_ACCOUNT=./service-account.json
```
(`FIREBASE_PROJECT_ID` defaults to `elitearrowsapp` — change only if you use a different project.)

### 6. Install, provision, run
```
npm install
npm run setup      # creates roles, categories and channels in your server
npm start          # bot goes live
```

Then try in Discord: `/table` → `/post-table` (in `#table`) → `/post-fixtures` → `/help`.

## Hosting for free (24/7)

### Option A — Render (free)
1. Push this repo to GitHub.
2. Render.com → **New → Web Service** → connect the repo → **Build & Deploy**:
   - Runtime: **Node**
   - Build: `npm install`
   - Start: `npm start`
   - Instance Type: **Free** (web service)
3. Environment variables (secrets):
   - `DISCORD_TOKEN`
   - `GUILD_ID`
   - `FIREBASE_PROJECT_ID` = `elitearrowsapp`
   - `FIREBASE_SERVICE_ACCOUNT_JSON` = the **entire contents** of `service-account.json` pasted as one line
4. Deploy. Then add a free UptimeRobot monitor hitting `https://YOUR-APP.onrender.com/healthz` every 5 minutes so the bot stays awake on the free tier.

The repo also ships `render.yaml` — if you deploy via Blueprint ("New → Blueprint"), Render will create the service for you; you still fill in the secrets.

### Option B — your own machine
Just run `npm start` (needs the PC on). Perfect for development or if the bot only needs to be live while you play.

## How the data works

- The bot reads Firestore **read-only** (service account): `results`, `users`, `fixtures`, `seasons`, `news` and `adminData/main`.
- Scoring is an exact port of the app's `src/utils/playerStats.js` + `leagueScoring.js` + `leagueResults.js` + `resultIdentity.js` (see `src/scoring.js`), and the table mirrors `src/pages/Table.jsx` (see `src/standings.js`).
- Table posts are edited in place rather than re-posted, so `#table` stays tidy. After a restart, messages are re-created next time an admin runs `/post-table`.

## Files

```
src/index.js      bot entry: commands + live Firestore listeners
src/firebase.js   Firestore cache + change events
src/scoring.js    exact port of the app's scoring engine
src/standings.js  league table builder (mirrors Table.jsx)
src/format.js     Discord embed builders
src/setup.js      one-time server provisioning
.env.example      configuration template
render.yaml       Render deploy config
```