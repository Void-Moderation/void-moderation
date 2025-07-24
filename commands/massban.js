const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const { logModAction } = require('../utils/logger.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('massban')
        .setDescription('Bans multiple users at once')
        .addStringOption(option =>
            option.setName('users')
                .setDescription('User IDs (separated by spaces)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the ban')
                .setRequired(true))
        .addBooleanOption(option =>
            option.setName('deletemsgs')
                .setDescription('Delete messages from last 7 days?')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction) {
        try {
            // Überprüfe Bot-Berechtigungen
            if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) {
                return interaction.reply({
                    content: '❌ I need the "Ban Members" permission!',
                    flags: MessageFlags.Ephemeral
                });
            }

            const userIds = interaction.options.getString('users').split(/\s+/);
            const reason = interaction.options.getString('reason');
            const deleteMessages = interaction.options.getBoolean('deletemsgs') ?? true;

            if (userIds.length > 10) {
                return interaction.reply({
                    content: '❌ You can ban a maximum of 10 users at once!',
                    flags: MessageFlags.Ephemeral
                });
            }

            await interaction.deferReply();

            const results = {
                success: [],
                failed: [],
                notFound: [],
                noPermission: []
            };

            for (const id of userIds) {
                try {
                    // Prüfe ob ID gültig ist
                    if (!/^\d{17,19}$/.test(id)) {
                        results.notFound.push(id);
                        continue;
                    }

                    const member = await interaction.guild.members.fetch(id).catch(() => null);
                    
                    // Wenn Benutzer nicht gefunden
                    if (!member) {
                        // Versuche trotzdem zu bannen (für Benutzer die den Server bereits verlassen haben)
                        await interaction.guild.bans.create(id, {
                            deleteMessageSeconds: deleteMessages ? 7 * 24 * 60 * 60 : 0,
                            reason: `${reason} (Massenban durch ${interaction.user.tag})`
                        }).then(() => {
                            results.success.push(id);
                        }).catch(() => {
                            results.notFound.push(id);
                        });
                        continue;
                    }

                    // Prüfe Rollen-Hierarchie
                    if (member.roles.highest.position >= interaction.member.roles.highest.position) {
                        results.noPermission.push(member.user.tag);
                        continue;
                    }

                    await member.ban({
                        deleteMessageSeconds: deleteMessages ? 7 * 24 * 60 * 60 : 0,
                        reason: `${reason} (Massenban durch ${interaction.user.tag})`
                    });
                    results.success.push(member.user.tag);

                    // Logging für jeden erfolgreichen Ban
                    await logModAction(interaction.guild, {
                        action: 'Massenban',
                        moderator: interaction.user,
                        target: member.user,
                        reason: reason,
                        color: '#ff0000'
                    });

                } catch (error) {
                    console.error(`Massenban Fehler für ID ${id}:`, error);
                    results.failed.push(id);
                }
            }

            // Erstelle Zusammenfassungs-Embed
            const embed = new EmbedBuilder()
                .setTitle('🔨 Massban Result')
                .setColor(results.success.length ? '#00ff00' : '#ff0000')
                .setTimestamp();

            if (results.success.length) {
                embed.addFields({
                    name: '✅ Successfully banned',
                    value: results.success.join('\n') || 'None'
                });
            }
            if (results.noPermission.length) {
                embed.addFields({
                    name: '⚠️ No Permission',
                    value: results.noPermission.join('\n')
                });
            }
            if (results.notFound.length) {
                embed.addFields({
                    name: '❌ Not found',
                    value: results.notFound.join('\n')
                });
            }
            if (results.failed.length) {
                embed.addFields({
                    name: '❌ Error while banning',
                    value: results.failed.join('\n')
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Massenban Fehler:', error);
            const reply = interaction.deferred 
                ? interaction.editReply.bind(interaction)
                : interaction.reply.bind(interaction);
                
            await reply({
                content: '❌ Error executing massban!',
                flags: MessageFlags.Ephemeral
            });
        }
    },
}; 