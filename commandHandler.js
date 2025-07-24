const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

async function loadCommands(client) {
    const commands = [];
    const commandsPath = path.join(__dirname, 'commands');

    // Erstelle commands Ordner falls nicht vorhanden
    if (!fs.existsSync(commandsPath)) {
        fs.mkdirSync(commandsPath);
    }

    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const command = require(`./commands/${file}`);
        if ('data' in command && 'execute' in command) {
            commands.push(command.data.toJSON());
            client.commands.set(command.data.name, command);
            console.log(`✅ Command ${command.data.name} wurde geladen`);
        } else {
            console.log(`⚠️ Command ${file} fehlen erforderliche "data" oder "execute" Eigenschaften`);
        }
    }

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    try {
        console.log('Slash-Commands werden synchronisiert...');
        
        // Lösche alle bestehenden Commands
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: [] }
        );

        // Registriere neue Commands
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );

        console.log(`✅ ${commands.length} Slash-Commands wurden erfolgreich synchronisiert!`);
    } catch (error) {
        console.error('❌ Fehler beim Synchronisieren der Slash-Commands:', error);
    }
}

module.exports = { loadCommands }; 