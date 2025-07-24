# Void Moderation Bot

Just a simple Moderation bot.

## 🔧 Features

- **Moderation Tools**: Ban, kick, mute, warn, timeouts, mass actions
- **Auto-Moderation**: Bad word filters, spam protection, punishments
- **Anti-Raid**: Configurable thresholds & automated actions
- **Verification System**: Captcha or reaction-based
- **Ticket System**: Fully integrated support tickets
- **Backups**: Save and restore server configs
- **Welcome Messages**: With optional images
- **Logging**: Moderation, join/leave, message edits & deletes

## ⚙️ Setup

1. Clone the repository  
   ```bash
   git clone https://github.com/Void-Moderation/Void-Moderation.git
   cd Void-Moderation```
2. Install dependencies
   ```bash
   npm install```
3. Edit the `.env.example` file with the following and rename it to `.env`:
   ```
   TOKEN=your_discord_bot_token
   CLIENT_ID=your_discord_user_id (not the bot´s)
   MONGODB_URI=your_mongodb_connection_string
   ```
4. Start the bot: `npm start`

## Commands

<details>
<summary>🛡️ Moderation Commands</summary>

| Command | Description |
|---------|-------------|
| `/ban` | Bans a user from the server |
| `/tempban` | Temporarily bans a user |
| `/softban` | Kicks a user and deletes their messages |
| `/kick` | Kicks a user from the server |
| `/mute` | Temporarily mutes a user |
| `/unmute` | Unmutes a user |
| `/warn` | Warns a user |
| `/clear` | Deletes a specified number of messages |
| `/timeout` | Timeouts a user for a specified duration |
| `/lockdown` | Locks/unlocks channels for normal users |
| `/massban` | Bans multiple users at once |

</details>

<details>
<summary>⚙️ Setup Commands</summary>

| Command | Description |
|---------|-------------|
| `/welcome-setup` | Sets up the welcome system |
| `/verify-setup` | Sets up the verification system |
| `/ticket-setup` | Sets up the ticket system |
| `/autorole` | Manages automatic roles |
| `/setlogchannel` | Sets the channel for moderation logs |

</details>

<details>
<summary>🎫 Ticket Commands</summary>

| Command | Description |
|---------|-------------|
| `/ticket-setup` | Sets up the ticket system |
| `/tickets` | Shows ticket statistics |

</details>

<details>
<summary>🔨 Auto-Moderation Commands</summary>

| Command | Description |
|---------|-------------|
| `/automod` | Configures automatic moderation |
| `/antiraid` | Configures the Anti-Raid system |
| `/warnsystem` | Configures the warning system |
| `/raidmode` | Manages raid protection mode |

</details>

<details>
<summary>📊 Statistics Commands</summary>

| Command | Description |
|---------|-------------|
| `/modstats` | Shows moderation statistics |

</details>

<details>
<summary>💾 Backup Commands</summary>

| Command | Description |
|---------|-------------|
| `/backup` | Creates, lists, and restores server backups |

</details>

<details>
<summary>🛠️ Bot Admin Commands</summary>

| Command | Description |
|---------|-------------|
| `-admin showservers` | Shows detailed list of all servers the bot is in |
| `-admin leave <server_id>` | Makes the bot leave the specified server |
| `-admin createinvite <server_id>` | Creates a permanent invite for the specified server |
| `-admin globalannounce <title> \| <description> \| <color hex>` | Sends an announcement embed to all servers |

</details>

## Requirements

- Node.js v16.9.0 or higher
- MongoDB database
- Discord.js v14.17.3

## License

MIT

## Support

For bug reports or feature requests, please create am issue on this Github Page.