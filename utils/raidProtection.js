const { GuildSettings } = require('../schemas.js');
const { logModAction } = require('./logger.js');

class RaidProtection {
    constructor() {
        this.joinQueue = new Map(); // guildId -> [join_timestamps]
    }

    async handleMemberJoin(member) {
        const settings = await GuildSettings.findOne({ guildId: member.guild.id });
        if (!settings?.antiraid?.enabled) return;

        const violations = [];
        
        // Account-Alter Prüfung
        const accountAge = Date.now() - member.user.createdTimestamp;
        const minAge = settings.antiraid.minAccountAge || 7 * 24 * 60 * 60 * 1000; // 7 Tage Standard
        
        if (accountAge < minAge) {
            violations.push('Zu junges Account-Alter');
        }

        // Join-Rate Überwachung
        const guildJoins = this.joinQueue.get(member.guild.id) || [];
        const now = Date.now();
        
        // Entferne alte Joins (älter als timeWindow)
        const recentJoins = guildJoins.filter(timestamp => 
            now - timestamp < settings.antiraid.timeWindow * 1000
        );
        recentJoins.push(now);
        this.joinQueue.set(member.guild.id, recentJoins);

        if (recentJoins.length >= settings.antiraid.joinThreshold) {
            violations.push('Verdächtige Join-Rate');
        }

        // Führe Aktionen aus wenn Verletzungen vorliegen
        if (violations.length > 0) {
            const reason = `Anti-Raid: ${violations.join(', ')}`;

            try {
                switch (settings.antiraid.action) {
                    case 'kick':
                        await member.kick(reason);
                        break;
                    case 'ban':
                        await member.ban({ reason });
                        break;
                    case 'verify':
                        // Füge Verify-Rolle hinzu wenn konfiguriert
                        if (settings.verifyRoleId) {
                            await member.roles.add(settings.verifyRoleId);
                        }
                        break;
                }

                await logModAction(member.guild, {
                    action: `Anti-Raid ${settings.antiraid.action}`,
                    moderator: member.client.user,
                    target: member.user,
                    reason: reason,
                    color: '#ff0000'
                });

            } catch (error) {
                console.error('Anti-Raid Aktion Fehler:', error);
            }
        }
    }
}

module.exports = new RaidProtection(); 