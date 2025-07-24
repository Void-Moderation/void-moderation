const { EmbedBuilder } = require('discord.js');
const { Warn, GuildSettings } = require('../schemas.js');
const ms = require('ms');

class WarnManager {
    async processWarning(interaction, target, reason) {
        try {
            const settings = await GuildSettings.findOne({ guildId: interaction.guild.id });
            if (!settings?.warnSystem?.enabled) return null;

            // Entferne verfallene Warnungen wenn aktiviert
            if (settings.warnSystem.autoDecay) {
                const decayDate = new Date(Date.now() - (settings.warnSystem.decayDays * 24 * 60 * 60 * 1000));
                await Warn.deleteMany({
                    guildId: interaction.guild.id,
                    userId: target.id,
                    timestamp: { $lt: decayDate }
                });
            }

            // Erstelle neue Warnung
            const warning = new Warn({
                guildId: interaction.guild.id,
                userId: target.id,
                moderatorId: interaction.user.id,
                reason: reason,
                timestamp: new Date()
            });
            await warning.save();

            // Zähle aktive Warnungen
            const warnCount = await Warn.countDocuments({
                guildId: interaction.guild.id,
                userId: target.id
            });

            // Finde passende Eskalationsstufe
            const action = settings.warnSystem.actions
                .filter(a => a.warnings <= warnCount)
                .sort((a, b) => b.warnings - a.warnings)[0];

            if (action) {
                const member = await interaction.guild.members.fetch(target.id);
                
                switch (action.action) {
                    case 'mute':
                        if (action.duration) {
                            const duration = ms(action.duration);
                            await member.timeout(duration, `Automatische Aktion nach ${warnCount} Verwarnungen`);
                        }
                        break;
                    case 'kick':
                        await member.kick(`Automatische Aktion nach ${warnCount} Verwarnungen`);
                        break;
                    case 'ban':
                        await member.ban({
                            reason: `Automatische Aktion nach ${warnCount} Verwarnungen`
                        });
                        break;
                }

                return {
                    warnCount,
                    action: action.action,
                    duration: action.duration
                };
            }

            return { warnCount };

        } catch (error) {
            console.error('Warn Processing Fehler:', error);
            return null;
        }
    }

    async getWarnList(guildId, userId) {
        try {
            const warnings = await Warn.find({ guildId, userId })
                .sort({ timestamp: -1 });

            const embed = new EmbedBuilder()
                .setTitle('⚠️ Verwarnungen')
                .setDescription(warnings.length ? warnings.map((warn, i) => 
                    `${i + 1}. ${warn.reason}\n` +
                    `└ Von: <@${warn.moderatorId}> | Am: <t:${Math.floor(warn.timestamp.getTime() / 1000)}:f>`
                ).join('\n\n') : 'Keine Verwarnungen vorhanden')
                .setColor('#ffa500')
                .setTimestamp();

            return embed;
        } catch (error) {
            console.error('Warn List Fehler:', error);
            return null;
        }
    }
}

module.exports = new WarnManager(); 