# Discord integration

This document covers bot setup, the relay protocol, supported response formats and the platform limitation that shapes the design.

---

## 1. The limitation (read first)

**A Discord bot cannot invoke another bot's slash command.** Discord interactions are created by users; the API exposes no supported way for a bot to trigger an application command. User-account automation ("self-bots") and token impersonation violate Discord's Terms of Service and are not implemented anywhere in this project.

What is supported:

- A bot can read messages in channels it can access (embeds always; message content requires the privileged intent).
- A bot can post messages, including in a channel watched by an integration you control.
- A bot can call a target service's **official HTTP API** if that service provides one.
- A bot can receive **webhooks** from a service that supports them.

ORION CONTROL therefore provides a **relay adapter**: the worker posts a request in your private channel and parses the reply from an authorised integration bot. If no such relay exists, automated retrieval is impossible; the mock adapter keeps the pipeline testable and labels everything Simulated.

Discord references:

- Application commands: <https://docs.discord.com/developers/interactions/application-commands>
- Bots and companion apps: <https://docs.discord.com/developers/platform/bots>
- Receiving and responding to interactions: <https://docs.discord.com/developers/interactions/receiving-and-responding>

---

## 2. Create the bot

1. Go to <https://discord.com/developers/applications> → **New Application**.
2. **Bot** tab → **Add Bot** → copy the token. Treat it like a password.
3. **Privileged Gateway Intents**
   - Leave **Message Content** off unless you need to read plain message text (embeds work without it).
   - If you enable it, set `DISCORD_ENABLE_MESSAGE_CONTENT=true` in the worker environment. Requesting a privileged intent that is disabled prevents login.
4. **OAuth2 → URL Generator**: scopes `bot`, permissions:
   - View Channels
   - Send Messages
   - Read Message History
   - Embed Links (if the integration replies with embeds)

   Administrator is **not** required.
5. Invite the bot to your server.

---

## 3. Configure the private channel

1. Create a private channel, e.g. `#orion-ops`.
2. Deny `@everyone`; allow the ORION CONTROL bot and the target integration bot.
3. Copy IDs (enable **Developer Mode** in Discord settings → right-click → Copy ID):
   - server (guild) id → `DISCORD_GUILD_ID`
   - channel id → `DISCORD_CHANNEL_ID`
   - optional responder bot id → `DISCORD_TARGET_BOT_ID`

The worker validates at startup that the channel exists, is text-based, belongs to the guild, and that the bot can view it and send messages. If validation fails it exits with a specific message instead of posting.

---

## 4. Worker settings for relay mode

```dotenv
INTEGRATION_MODE=channel
DISCORD_BOT_TOKEN=…
DISCORD_GUILD_ID=…
DISCORD_CHANNEL_ID=…
DISCORD_TARGET_BOT_ID=…        # optional but recommended
DISCORD_ENABLE_MESSAGE_CONTENT=false
```

Start the worker:

```bash
npm run dev:worker
```

Expected log:

```
Discord connected as OrionControl#1234.
Discord target validated: #orion-ops in "My Community" (view=true, send=true, history=true).
Worker ready. Polling https://… every 2000ms.
```

Run **Discord Integration → Run channel diagnostics** in the dashboard. The result lists the resolved guild/channel names and the bot's permissions. Raw IDs are masked before being stored.

---

## 5. Relay protocol

For a statistics retrieval the worker posts:

```
**ORION CONTROL · automated request**
Request: Current server statistics
Marker: `orion:ab12cd34`

Please post the current server statistics in this channel (server rows and totals).
```

The marker contains the first eight characters of the task id. The adapter accepts the first message from an authorised bot in that channel after the request:

- author must be a bot (never a human, never the worker itself),
- author must match `DISCORD_TARGET_BOT_ID` when set,
- message must be in the configured channel,
- timestamp must not predate the request by more than two seconds.

Replying in the channel with the marker echoed is recommended for exact correlation but is not required.

Timeout: the lower of the task's server timeout (60 s) and `DISCORD_TASK_TIMEOUT`. A timeout produces `RESPONSE_TIMEOUT` with a retryable flag.

---

## 6. Supported response formats

### 6.1 JSON (recommended)

Send a JSON object, optionally inside a code fence. The parser finds the first parseable JSON object in the message or embeds.

Statistics:

```json
{
  "servers": [
    {
      "id": "eu-aurora",
      "name": "Aurora Relay",
      "region": "EU West",
      "status": "online",
      "playersOnline": 42,
      "maxPlayers": 64,
      "activeMatches": 4,
      "latencyMs": 28,
      "version": "2.4.1"
    }
  ],
  "matches": [
    {
      "id": "m-1",
      "serverId": "eu-aurora",
      "mode": "Conquest",
      "map": "Meridian",
      "players": 18,
      "maxPlayers": 24,
      "startedAt": "2026-11-18T12:00:00.000Z",
      "status": "live"
    }
  ]
}
```

`summary` is optional; if omitted, ORION CONTROL computes it from the server rows. `source` is always overridden to `retrieved`; `retrievedAt` is the time the message was parsed. Unknown fields are rejected by schema validation, which is intentional.

Player directory:

```json
{
  "players": [
    {
      "externalId": "player-1",
      "displayName": "NovaRider",
      "platform": "PC",
      "rank": "Elite",
      "status": "online",
      "lastSeenAt": "2026-11-18T12:00:00.000Z"
    }
  ]
}
```

### 6.2 Pipe-separated server rows

```
Aurora Relay | EU West | online | 42/64 | 4 | 28ms
Vanguard Core | NA East | degraded | 51/64 | 5 | 74ms
```

Columns: name, region, status, players/capacity, active matches (optional), latency (optional). Status must be `online`, `degraded` or `offline` (aliases such as `up`, `warning`, `down` are accepted).

### 6.3 Key/value summary

```
Players online: 148
Active matches: 12
Servers: 3 / 4
Health: 92%
```

This produces a **summary-only** snapshot with an explicit warning: no per-server rows exist, so the server table is empty and the health score is 0% unless a health value was reported. Totals are never invented.

### 6.4 Player rows

```
NovaRider | PC | Elite | online
PixelFoe | Console | Vanguard | in match
```

Columns: name, platform, rank, status. Rows without a status are recorded as offline and a warning is added.

### 6.5 JSON inside embeds

Embed fields are flattened as `Field name: value` lines, so embeds containing the formats above also parse. Message content is only visible without the privileged intent for bots' embed content; keep responses in embeds or enable the intent if you need plain text.

If nothing matches, the task fails with `UNPARSED_RESPONSE`. The raw message (content, embeds, attachments, author, timestamp) is stored on the task for inspection. ORION CONTROL does not guess missing values.

---

## 7. Using a target with an official API

If the target provides a documented HTTP API or webhook:

1. Add an adapter in `apps/worker/src/integrations/` implementing `IntegrationAdapter`.
2. Return `{ rawResponse, parsedResponse }` where `parsedResponse` matches the shared statistics or player-directory schema.
3. Select it in `createIntegrationAdapter()`.
4. Keep credentials on the Chromebook only.

No changes to the website are needed: it validates and stores whatever the adapter returns.

---

## 8. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `Discord login failed` | Wrong token, bot not invited, or a privileged intent requested but disabled in the portal |
| `Guild … is not available` | Wrong `DISCORD_GUILD_ID`, or the bot is not a member of that guild |
| `Channel … was not found` | Wrong `DISCORD_CHANNEL_ID`, or the bot cannot see the channel |
| `lacks View Channel or Send Messages` | Grant those permissions to the bot role in that channel |
| `RESPONSE_TIMEOUT` | No authorised bot replied in time; the target cannot be relayed to, or `DISCORD_TARGET_BOT_ID` is wrong |
| `UNPARSED_RESPONSE` | Reply format not recognised — inspect the raw response and use one of the formats above |
| Worker reports `discordConnected: false` | Gateway disconnected; the worker keeps heartbeating and the library reconnects. Tasks fail with a retryable code until it resumes |
| No message content visible | Expected without the privileged intent; prefer embeds or enable `DISCORD_ENABLE_MESSAGE_CONTENT` |

---

## 9. What ORION CONTROL will never do

- Run a self-bot or use a user token.
- Impersonate a user or another bot.
- Attempt to trigger another bot's slash commands through unsupported means.
- Ask for Administrator permissions when channel-level permissions suffice.
- Store the Discord token in the database, browser bundle or logs.
