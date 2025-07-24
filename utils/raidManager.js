const { EmbedBuilder } = require('discord.js');
const { GuildSettings } = require('../schemas.js');
const { logModAction } = require('./logger.js');

class RaidManager {
    constructor() {
        this.joinQueue = new Map(); // guildId -> [{userId, timestamp}]
    }

    async handleJoin(member) {
        try {
            const settings = await GuildSettings.findOne({ 
                guildId: member.guild.id,
                'antiraid.enabled': true 
            });
            
            if (!settings?.antiraid) return;

            const { joinThreshold, timeWindow, action } = settings.antiraid;
            const now = Date.now();
            
            // Hole oder initialisiere Queue für diesen Server
            let queue = this.joinQueue.get(member.guild.id) || [];
            
            // Entferne alte Einträge
            queue = queue.filter(join => now - join.timestamp < timeWindow * 1000);
            
            // Füge neuen Join hinzu
            queue.push({ userId: member.id, timestamp: now });
            this.joinQueue.set(member.guild.id, queue);

            // Prüfe auf Raid
            if (queue.length >= joinThreshold) {
                await this.handleRaid(member.guild, queue, action);
                // Queue zurücksetzen nach Raid-Erkennung
                this.joinQueue.delete(member.guild.id);
            }
        } catch (error) {
            console.error('Raid Detection Fehler:', error);
        }
    }

    async handleRaid(guild, raidQueue, action) {
        try {
            const embed = new EmbedBuilder()
                .setTitle('🚨 Raid erkannt!')
                .setDescription(`Es wurde ein möglicher Raid erkannt!\n${raidQueue.length} Benutzer sind in kurzer Zeit beigetreten.`)
                .setColor('#ff0000')
                .setTimestamp();

            // Führe Aktion für jeden Benutzer aus
            for (const join of raidQueue) {
                const member = await guild.members.fetch(join.userId).catch(() => null);
                if (!member) continue;

                switch (action) {
                    case 'kick':
                        await member.kick('Anti-Raid Schutz').catch(console.error);
                        break;
                    case 'ban':
                        await member.ban({ reason: 'Anti-Raid Schutz' }).catch(console.error);
                        break;
                    case 'verify':
                        // Wenn Verifizierung aktiviert ist, wird die Rolle entfernt/hinzugefügt
                        const settings = await GuildSettings.findOne({ guildId: guild.id });
                        if (settings?.verifyRoleId) {
                            await member.roles.remove(settings.verifyRoleId).catch(console.error);
                        }
                        break;
                }
            }

            // Logging
            await logModAction(guild, {
                action: 'Raid erkannt',
                moderator: guild.client.user,
                target: { tag: 'System', id: '0' },
                reason: `${raidQueue.length} Joins in kurzer Zeit - Aktion: ${action}`,
                color: '#ff0000'
            });

        } catch (error) {
            console.error('Raid Handler Fehler:', error);
        }
    }
}

module.exports = new RaidManager(); 