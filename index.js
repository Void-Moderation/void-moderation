const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const { connect } = require('mongoose');
const { loadEvents } = require('./events.js');
const { loadCommands } = require('./commandHandler.js');
const MuteManager = require('./utils/muteManager.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction
    ]
});

client.commands = new Collection();

// Datenbank-Verbindung
connect(process.env.MONGODB_URI)
    .then(() => console.log('Mit MongoDB verbunden'))
    .catch((err) => console.error('MongoDB Verbindungsfehler:', err));

async function main() {
    try {
        await loadCommands(client);
        await loadEvents(client);
        new MuteManager(client); // Initialisiere Mute-Manager
        await client.login(process.env.TOKEN);
    } catch (error) {
        console.error('Startup Error:', error);
        process.exit(1);
    }
}

main(); 