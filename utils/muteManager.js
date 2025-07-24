const { Mute, GuildSettings } = require('../schemas.js');
const { logModAction } = require('./logger.js');

class MuteManager {
    constructor(client) {
        this.client = client;
        this.checkInterval = 60000; // Prüfe jede Minute
        this.init();
    }

    init() {
        setInterval(() => this.checkExpiredMutes(), this.checkInterval);
    }

    async checkExpiredMutes() {
        try {
            const expiredMutes = await Mute.find({
                active: true,
                endTime: { $lte: new Date() }
            });

            for (const mute of expiredMutes) {
                try {
                    const guild = await this.client.guilds.fetch(mute.guildId);
                    if (!guild) continue;

                    const settings = await GuildSettings.findOne({ guildId: guild.id });
                    if (!settings?.muteSystem) continue;

                    const member = await guild.members.fetch(mute.userId).catch(() => null);
                    if (!member) continue;

                    // Führe Unmute aus
                    if (settings.muteSystem.useTimeout) {
                        await member.timeout(null, 'Automatischer Unmute: Zeit abgelaufen');
                    } else if (settings.muteSystem.timeoutRoleId) {
                        const muteRole = await guild.roles.fetch(settings.muteSystem.timeoutRoleId);
                        if (muteRole) {
                            await member.roles.remove(muteRole, 'Automatischer Unmute: Zeit abgelaufen');
                        }
                    }

                    // Update Mute-Status
                    mute.active = false;
                    await mute.save();

                    // Logging
                    await logModAction(guild, {
                        action: 'Automatischer Unmute',
                        moderator: this.client.user,
                        target: member.user,
                        reason: 'Zeit abgelaufen',
                        color: '#00ff00'
                    });

                } catch (error) {
                    console.error(`Fehler beim automatischen Unmute in Guild ${mute.guildId}:`, error);
                }
            }
        } catch (error) {
            console.error('Fehler beim Prüfen der Mutes:', error);
        }
    }
}

module.exports = MuteManager; 