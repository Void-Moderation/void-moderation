const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags, VerificationLevel } = require('discord.js');
const { GuildSettings } = require('../schemas.js');
const { logModAction } = require('../utils/logger.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('raidmode')
        .setDescription('Manages raid protection mode')
        .addSubcommand(subcommand =>
            subcommand
                .setName('enable')
                .setDescription('Enables raid protection mode')
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for activation')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('accountage')
                        .setDescription('Minimum account age in days')
                        .setMinValue(1)
                        .setMaxValue(30)
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('disable')
                .setDescription('Disables raid protection mode'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Shows current status of raid protection mode'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            const subcommand = interaction.options.getSubcommand();
            let settings = await GuildSettings.findOne({ guildId: interaction.guild.id });
            
            if (!settings) {
                settings = new GuildSettings({ guildId: interaction.guild.id });
            }

            switch (subcommand) {
                case 'enable': {
                    if (settings.raidMode?.enabled) {
                        return interaction.reply({
                            content: '❌ Raid protection mode is already enabled!',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const reason = interaction.options.getString('reason');
                    const accountAge = interaction.options.getInteger('accountage') || 7;

                    // Speichere ursprüngliche Einstellungen
                    settings.raidMode = {
                        enabled: true,
                        activatedAt: new Date(),
                        activatedBy: interaction.user.id,
                        settings: {
                            verificationLevel: 'HIGH',
                            autoModEnabled: true,
                            joinThreshold: 3,
                            accountAgeDays: accountAge,
                            kickUnverified: true
                        },
                        originalSettings: {
                            verificationLevel: interaction.guild.verificationLevel,
                            autoModEnabled: settings.automod?.enabled || false,
                            joinThreshold: settings.antiraid?.joinThreshold || 5
                        }
                    };

                    // Aktiviere strengere Einstellungen
                    await interaction.guild.setVerificationLevel(VerificationLevel.High);
                    
                    settings.automod.enabled = true;
                    settings.antiraid.enabled = true;
                    settings.antiraid.joinThreshold = 3;
                    await settings.save();

                    const embed = new EmbedBuilder()
                        .setTitle('🚨 Raid Protection Enabled')
                        .setDescription(`The server is now in heightened protection mode.`)
                        .addFields(
                            { name: 'Reason', value: reason },
                            { name: 'Enabled by', value: interaction.user.toString() },
                            { name: 'Minimum Account Age', value: `${accountAge} days` },
                            { name: 'Measures', value: 
                                '• Increased verification\n' +
                                '• Stricter AutoMod settings\n' +
                                '• Lower join threshold\n' +
                                '• Kick unverified users'
                            }
                        )
                        .setColor('#ff0000')
                        .setTimestamp();

                    await interaction.reply({ embeds: [embed] });

                    // Sende Ankündigung in System-Kanal
                    const systemChannel = interaction.guild.systemChannel;
                    if (systemChannel) {
                        await systemChannel.send({ embeds: [embed] });
                    }

                    // Logging
                    await logModAction(interaction.guild, {
                        action: 'Raid-Schutzmodus aktiviert',
                        moderator: interaction.user,
                        reason: reason,
                        color: '#ff0000'
                    });
                    break;
                }

                case 'disable': {
                    if (!settings.raidMode?.enabled) {
                        return interaction.reply({
                            content: '❌ Raid protection mode is not enabled!',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    // Stelle ursprüngliche Einstellungen wieder her
                    const originalSettings = settings.raidMode.originalSettings;
                    await interaction.guild.setVerificationLevel(originalSettings.verificationLevel);
                    
                    settings.automod.enabled = originalSettings.autoModEnabled;
                    settings.antiraid.joinThreshold = originalSettings.joinThreshold;
                    settings.raidMode.enabled = false;
                    await settings.save();

                    const embed = new EmbedBuilder()
                        .setTitle('✅ Raid Protection Disabled')
                        .setDescription('The server returns to normal security settings.')
                        .setColor('#00ff00')
                        .setTimestamp();

                    await interaction.reply({ embeds: [embed] });

                    // Logging
                    await logModAction(interaction.guild, {
                        action: 'Raid-Schutzmodus deaktiviert',
                        moderator: interaction.user,
                        color: '#00ff00'
                    });
                    break;
                }

                case 'status': {
                    const embed = new EmbedBuilder()
                        .setTitle('🛡️ Raid Protection Status')
                        .setColor(settings.raidMode?.enabled ? '#ff0000' : '#00ff00')
                        .setTimestamp();

                    if (settings.raidMode?.enabled) {
                        const activatedBy = await interaction.client.users.fetch(settings.raidMode.activatedBy);
                        embed.addFields(
                            { name: 'Status', value: '🚨 Enabled', inline: true },
                            { name: 'Enabled by', value: activatedBy.tag, inline: true },
                            { name: 'Enabled at', value: `<t:${Math.floor(settings.raidMode.activatedAt.getTime() / 1000)}:R>`, inline: true },
                            { name: 'Account Age Check', value: `${settings.raidMode.settings.accountAgeDays} days`, inline: true },
                            { name: 'Join Threshold', value: settings.antiraid.joinThreshold.toString(), inline: true }
                        );
                    } else {
                        embed.addFields(
                            { name: 'Status', value: '✅ Disabled' }
                        );
                    }

                    await interaction.reply({ embeds: [embed] });
                    break;
                }
            }

        } catch (error) {
            console.error('Raid-Mode Fehler:', error);
            await interaction.reply({
                content: '❌ Error executing the command!',
                flags: MessageFlags.Ephemeral
            });
        }
    },
}; 