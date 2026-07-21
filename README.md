# nr25-access-bot

A Discord bot with owner-controlled usage access. The bot owner is hardcoded
and can grant or revoke access for individual users or entire roles.

## Features

- **Hardcoded owner** (`1215001848105279498`) who always has full access and can
  never be locked out.
- **`/allow`** — owner grants a user and/or role access to the bot.
- **`/deny`** — owner revokes a user's and/or role's access.
- **`/accesslist`** — owner views the current allowed users and roles.
- **`/ping`** — example command gated behind usage access (only the owner or
  allowed users/roles can run it).

Access is stored per-server in `data/access.json`.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in the values:
   - `DISCORD_TOKEN` — bot token from the Discord Developer Portal.
   - `CLIENT_ID` — your application's client ID.
   - `GUILD_ID` — (optional) a server ID for instant command registration.
3. Register slash commands (also done automatically on startup):
   ```bash
   npm run deploy
   ```
4. Start the bot:
   ```bash
   npm start
   ```

## Inviting the bot

Invite with the `bot` and `applications.commands` scopes. No special gateway
permissions are required beyond sending messages.

## Deployment

The bot is deployed on the VPS and kept alive with `pm2`:

```bash
pm2 start src/index.js --name nr25-access-bot
pm2 save
```
