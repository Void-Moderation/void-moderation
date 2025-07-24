const { GuildSettings } = require('../schemas.js');
const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

class BackupManager {
    constructor() {
        this.backupPath = path.join(process.cwd(), 'backups');
        this.init();
    }

    async init() {
        try {
            await fs.mkdir(this.backupPath, { recursive: true });
        } catch (error) {
            console.error('Backup Ordner Erstellung fehlgeschlagen:', error);
        }
    }

    async createBackup(guild, reason) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupData = {
                timestamp,
                reason,
                guildId: guild.id,
                name: guild.name,
                roles: [],
                channels: [],
                settings: null
            };

            // Sichere Rollen
            for (const [id, role] of guild.roles.cache) {
                if (role.managed || role.name === '@everyone') continue;
                backupData.roles.push({
                    id: role.id,
                    name: role.name,
                    color: role.color,
                    hoist: role.hoist,
                    position: role.position,
                    permissions: role.permissions.bitfield.toString(),
                    mentionable: role.mentionable
                });
            }

            // Sichere Kanäle
            for (const [id, channel] of guild.channels.cache) {
                const channelData = {
                    id: channel.id,
                    name: channel.name,
                    type: channel.type,
                    parent: channel.parent?.id,
                    position: channel.position,
                    permissionOverwrites: []
                };

                // Sichere Kanal-Berechtigungen
                channel.permissionOverwrites.cache.forEach(overwrite => {
                    channelData.permissionOverwrites.push({
                        id: overwrite.id,
                        type: overwrite.type,
                        allow: overwrite.allow.bitfield.toString(),
                        deny: overwrite.deny.bitfield.toString()
                    });
                });

                backupData.channels.push(channelData);
            }

            // Sichere Bot-Einstellungen
            const settings = await GuildSettings.findOne({ guildId: guild.id });
            if (settings) {
                backupData.settings = settings.toObject();
            }

            // Speichere Backup
            const fileName = `backup_${guild.id}_${timestamp}.json`;
            await fs.writeFile(
                path.join(this.backupPath, fileName),
                JSON.stringify(backupData, null, 2)
            );

            return fileName;

        } catch (error) {
            console.error('Backup Erstellung fehlgeschlagen:', error);
            throw error;
        }
    }

    async restoreBackup(guild, fileName) {
        try {
            const backupFile = await fs.readFile(
                path.join(this.backupPath, fileName),
                'utf-8'
            );
            const backupData = JSON.parse(backupFile);

            if (backupData.guildId !== guild.id) {
                throw new Error('Backup ist für einen anderen Server');
            }

            // Stelle Rollen wieder her
            for (const roleData of backupData.roles.sort((a, b) => b.position - a.position)) {
                try {
                    const existingRole = guild.roles.cache.find(r => r.name === roleData.name);
                    if (existingRole) {
                        await existingRole.edit({
                            color: roleData.color,
                            hoist: roleData.hoist,
                            permissions: BigInt(roleData.permissions),
                            mentionable: roleData.mentionable
                        });
                    } else {
                        await guild.roles.create({
                            name: roleData.name,
                            color: roleData.color,
                            hoist: roleData.hoist,
                            permissions: BigInt(roleData.permissions),
                            mentionable: roleData.mentionable,
                            position: roleData.position
                        });
                    }
                } catch (error) {
                    console.error(`Fehler beim Wiederherstellen der Rolle ${roleData.name}:`, error);
                }
            }

            // Stelle Kanäle wieder her
            for (const channelData of backupData.channels) {
                try {
                    const permissionOverwrites = channelData.permissionOverwrites.map(overwrite => ({
                        id: overwrite.id,
                        type: overwrite.type,
                        allow: BigInt(overwrite.allow),
                        deny: BigInt(overwrite.deny)
                    }));

                    const existingChannel = guild.channels.cache.get(channelData.id);
                    if (existingChannel) {
                        await existingChannel.edit({
                            name: channelData.name,
                            type: channelData.type,
                            parent: channelData.parent,
                            position: channelData.position,
                            permissionOverwrites
                        });
                    } else {
                        await guild.channels.create({
                            name: channelData.name,
                            type: channelData.type,
                            parent: channelData.parent,
                            position: channelData.position,
                            permissionOverwrites
                        });
                    }
                } catch (error) {
                    console.error(`Fehler beim Wiederherstellen des Kanals ${channelData.name}:`, error);
                }
            }

            // Stelle Bot-Einstellungen wieder her
            if (backupData.settings) {
                await GuildSettings.findOneAndUpdate(
                    { guildId: guild.id },
                    backupData.settings,
                    { upsert: true }
                );
            }

            return true;

        } catch (error) {
            console.error('Backup Wiederherstellung fehlgeschlagen:', error);
            throw error;
        }
    }

    async listBackups(guildId) {
        try {
            const files = await fs.readdir(this.backupPath);
            return files
                .filter(file => file.startsWith(`backup_${guildId}`))
                .map(file => {
                    const [, , timestamp] = file.split('_');
                    return {
                        fileName: file,
                        timestamp: timestamp.replace('.json', '')
                    };
                })
                .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        } catch (error) {
            console.error('Backup Liste Abruf fehlgeschlagen:', error);
            throw error;
        }
    }

    async deleteBackup(fileName) {
        try {
            await fs.unlink(path.join(this.backupPath, fileName));
            return true;
        } catch (error) {
            console.error('Backup Löschung fehlgeschlagen:', error);
            throw error;
        }
    }
}

module.exports = new BackupManager(); 