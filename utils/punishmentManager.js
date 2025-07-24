const { GuildSettings, Mute } = require('../schemas.js');
const { logModAction } = require('./logger.js');

class PunishmentManager {
    constructor(client) {
        this.client = client;
        this.checkInterval = 30000; // Alle 30 Sekunden prüfen
        this.tempRoles = new Map(); // Map für temporäre Rollen
        this.init();
    }

    init() {
        setInterval(() => this.checkPunishments(), this.checkInterval);
    }

    async checkPunishments() {
        try {
            // Prüfe Mutes
            const expiredMutes = await Mute.find({
                active: true,
                endTime: { $lte: new Date() }
            });

            for (const mute of expiredMutes) {
                await this.removeMute(mute);
            }

            // Prüfe temporäre Rollen
            for (const [key, data] of this.tempRoles.entries()) {
                if (Date.now() >= data.endTime) {
                    const [guildId, userId, roleId] = key.split('-');
                    await this.removeTempRole(guildId, userId, roleId);
                }
            }
        } catch (error) {
            console.error('Punishment Check Fehler:', error);
        }
    }

    async removeMute(mute) {
        try {
            const guild = await this.client.guilds.fetch(mute.guildId);
            if (!guild) return;

            const member = await guild.members.fetch(mute.userId).catch(() => null);
            if (!member) return;

            const settings = await GuildSettings.findOne({ guildId: guild.id });
            if (!settings?.muteSystem) return;

            // Entferne Mute
            if (settings.muteSystem.useTimeout) {
                await member.timeout(null, 'Automatischer Unmute: Zeit abgelaufen');
            } else if (settings.muteSystem.timeoutRoleId) {
                const muteRole = await guild.roles.fetch(settings.muteSystem.timeoutRoleId);
                if (muteRole) {
                    await member.roles.remove(muteRole);
                }
            }

            // Update Datenbank
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
            console.error('Unmute Fehler:', error);
        }
    }

    async addTempRole(member, role, duration, reason) {
        const key = `${member.guild.id}-${member.id}-${role.id}`;
        const endTime = Date.now() + duration;

        this.tempRoles.set(key, {
            endTime,
            reason
        });

        await member.roles.add(role, reason);

        // Logging
        await logModAction(member.guild, {
            action: 'Temporäre Rolle hinzugefügt',
            moderator: this.client.user,
            target: member.user,
            reason: reason,
            duration: `${duration / 1000} Sekunden`,
            color: '#ffa500'
        });
    }

    async removeTempRole(guildId, userId, roleId) {
        try {
            const guild = await this.client.guilds.fetch(guildId);
            if (!guild) return;

            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member) return;

            const role = await guild.roles.fetch(roleId);
            if (!role) return;

            const key = `${guildId}-${userId}-${roleId}`;
            const data = this.tempRoles.get(key);
            if (!data) return;

            await member.roles.remove(role, 'Temporäre Rolle abgelaufen');
            this.tempRoles.delete(key);

            // Logging
            await logModAction(guild, {
                action: 'Temporäre Rolle entfernt',
                moderator: this.client.user,
                target: member.user,
                reason: 'Zeit abgelaufen',
                color: '#00ff00'
            });

        } catch (error) {
            console.error('Temp Role Removal Fehler:', error);
        }
    }

    async getPunishmentHistory(guild, userId) {
        try {
            const mutes = await Mute.find({ 
                guildId: guild.id,
                userId: userId 
            }).sort({ timestamp: -1 });

            return {
                mutes: mutes,
                tempRoles: Array.from(this.tempRoles.entries())
                    .filter(([key]) => key.startsWith(`${guild.id}-${userId}`))
            };
        } catch (error) {
            console.error('History Fetch Fehler:', error);
            return null;
        }
    }
}

module.exports = PunishmentManager; 