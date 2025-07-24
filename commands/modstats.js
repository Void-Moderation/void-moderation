const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const { GuildSettings, Warn, Mute } = require('../schemas.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('modstats')
        .setDescription('Shows moderation statistics')
        .addSubcommand(subcommand =>
            subcommand
                .setName('overview')
                .setDescription('Shows general moderation statistics'))

        .addSubcommand(subcommand =>
            subcommand
                .setName('active')
                .setDescription('Shows active punishments'))

        .addSubcommand(subcommand =>
            subcommand
                .setName('moderator')
                .setDescription('Shows statistics of a moderator')
                .addUserOption(option =>
                    option.setName('moderator')
                        .setDescription('The moderator')
                        .setRequired(true)))

        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        try {
            const subcommand = interaction.options.getSubcommand();
            const settings = await GuildSettings.findOne({ guildId: interaction.guild.id });

            switch (subcommand) {
                case 'overview': {
                    // Sammle Statistiken
                    const totalWarns = await Warn.countDocuments({ guildId: interaction.guild.id });
                    const totalMutes = await Mute.countDocuments({ guildId: interaction.guild.id });
                    const activeMutes = await Mute.countDocuments({ 
                        guildId: interaction.guild.id,
                        active: true
                    });

                    // Server Sicherheits-Status
                    const securityChecks = [
                        {
                            name: 'AutoMod',
                            status: settings.automod?.enabled ? '✅' : '❌'
                        },
                        {
                            name: 'Anti-Raid',
                            status: settings.antiraid?.enabled ? '✅' : '❌'
                        },
                        {
                            name: 'Mod-Log',
                            status: settings.modLogEnabled ? '✅' : '❌'
                        },
                        {
                            name: 'Verification',
                            status: settings.verifyRoleId ? '✅' : '❌'
                        }

                    ];

                    const embed = new EmbedBuilder()
                        .setTitle('📊 Moderation Overview')

                        .addFields(
                            { 
                                name: 'Statistics', 
                                value: `Warns: ${totalWarns}\nMutes: ${totalMutes}\nActive Mutes: ${activeMutes}`,
                                inline: true
                            },

                            {
                                name: 'Security Features',
                                value: securityChecks.map(check => 
                                    `${check.status} ${check.name}`
                                ).join('\n'),
                                inline: true
                            }

                        )
                        .setColor('#00ff00')
                        .setTimestamp();

                    await interaction.reply({ embeds: [embed] });
                    break;
                }

                case 'active': {
                    const activeMutes = await Mute.find({ 
                        guildId: interaction.guild.id,
                        active: true 
                    });

                    const embed = new EmbedBuilder()
                        .setTitle('🔄 Active Punishments')
                        .setColor('#ffa500')
                        .setTimestamp();


                    if (activeMutes.length > 0) {
                        const mutesField = await Promise.all(activeMutes.map(async mute => {
                            const user = await interaction.client.users.fetch(mute.userId);
                            return `${user.tag} - Endet: <t:${Math.floor(mute.endTime.getTime() / 1000)}:R>`;
                        }));

                        embed.addFields({
                            name: '🔇 Active Mutes',
                            value: mutesField.join('\n')
                        });

                    } else {
                        embed.setDescription('No active punishments');
                    }


                    await interaction.reply({ embeds: [embed] });
                    break;
                }

                case 'moderator': {
                    const moderator = interaction.options.getUser('moderator');
                    
                    // Sammle Moderator-Statistiken
                    const warns = await Warn.countDocuments({ 
                        guildId: interaction.guild.id,
                        moderatorId: moderator.id
                    });
                    
                    const mutes = await Mute.countDocuments({
                        guildId: interaction.guild.id,
                        moderatorId: moderator.id
                    });

                    // Letzte Aktionen
                    const recentWarns = await Warn.find({ 
                        guildId: interaction.guild.id,
                        moderatorId: moderator.id 
                    })
                    .sort({ timestamp: -1 })
                    .limit(5);

                    const embed = new EmbedBuilder()
                        .setTitle(`👮 Moderator Statistics: ${moderator.tag}`)
                        .addFields(
                            { 
                                name: 'Total Actions',

                                value: `Warns: ${warns}\nMutes: ${mutes}`,
                                inline: true
                            }
                        )
                        .setColor('#00ff00')
                        .setTimestamp()
                        .setThumbnail(moderator.displayAvatarURL());

                    if (recentWarns.length > 0) {
                        const warnsField = await Promise.all(recentWarns.map(async warn => {
                            const user = await interaction.client.users.fetch(warn.userId);
                            return `${user.tag} - ${warn.reason}`;
                        }));

                        embed.addFields({
                            name: 'Last Warns',
                            value: warnsField.join('\n')
                        });

                    }

                    await interaction.reply({ embeds: [embed] });
                    break;
                }
            }

        } catch (error) {
            console.error('ModStats Error:', error);
            await interaction.reply({
                content: '❌ Error fetching statistics!',
                flags: MessageFlags.Ephemeral
            });

        }
    },
}; 