const { EmbedBuilder } = require('discord.js');
const { GuildSettings } = require('../schemas.js');

async function logModAction(guild, options) {
    try {
        const settings = await GuildSettings.findOne({ guildId: guild.id });
        if (!settings?.logChannelId || !settings.modLogEnabled) return;

        const logChannel = await guild.channels.fetch(settings.logChannelId);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setTitle(`📝 ${options.action}`)
            .setColor(options.color || '#ff0000')
            .setTimestamp();

        // Füge Moderator-Info hinzu
        if (options.moderator) {
            embed.addFields({ 
                name: 'Moderator', 
                value: `${options.moderator.tag} (${options.moderator.id})`,
                inline: true 
            });
        }

        // Füge Target-Info hinzu wenn vorhanden
        if (options.target) {
            embed.addFields({ 
                name: 'Betroffener User', 
                value: `${options.target.tag} (${options.target.id})`,
                inline: true 
            });
        }

        // Füge Grund hinzu wenn vorhanden
        if (options.reason) {
            embed.addFields({ 
                name: 'Grund', 
                value: options.reason,
                inline: options.target ? false : true
            });
        }

        // Füge Dauer hinzu wenn vorhanden
        if (options.duration) {
            embed.addFields({ 
                name: 'Dauer', 
                value: options.duration,
                inline: true 
            });
        }

        await logChannel.send({ embeds: [embed] });
        
        // Log in Konsole für Debugging
        console.log(`Log gesendet: ${options.action} für ${options.target ? options.target.tag : ''} durch ${options.moderator ? options.moderator.tag : ''}`);
        
    } catch (error) {
        console.error('Logging Fehler:', error);
    }
}

module.exports = { logModAction }; 