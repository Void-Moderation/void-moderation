const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const { GuildSettings } = require('../schemas.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warnsystem')
        .setDescription('Configures the warning system')
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Adds a warning level')
                .addIntegerOption(option =>
                    option.setName('warnings')
                        .setDescription('Number of warnings')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(10))
                .addStringOption(option =>
                    option.setName('action')
                        .setDescription('Action when reaching warning level')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Timeout', value: 'mute' },
                            { name: 'Kick', value: 'kick' },
                            { name: 'Ban', value: 'ban' }
                        ))
                .addStringOption(option =>
                    option.setName('duration')
                        .setDescription('Duration for timeout (e.g. 1h, 1d)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Removes a warning level')
                .addIntegerOption(option =>
                    option.setName('warnungen')
                        .setDescription('Warning level to remove')
                        .setRequired(true)))

        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Shows all warning levels'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('decay')
                .setDescription('Configures the decay of warnings')
                .addBooleanOption(option =>
                    option.setName('active')
                        .setDescription('Automatic decay active?')
                        .setRequired(true))

                .addIntegerOption(option =>
                    option.setName('days')
                        .setDescription('Days until decay')
                        .setMinValue(1)
                        .setMaxValue(365)))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),


    async execute(interaction) {
        try {
            const subcommand = interaction.options.getSubcommand();
            let settings = await GuildSettings.findOne({ guildId: interaction.guild.id });
            
            if (!settings) {
                settings = new GuildSettings({ guildId: interaction.guild.id });
            }

            switch (subcommand) {
                case 'add': {
                    const warnings = interaction.options.getInteger('warnings');
                    const action = interaction.options.getString('action');
                    const duration = interaction.options.getString('duration');

                    // Validiere Dauer für Timeout
                    if (action === 'mute' && !duration?.match(/^\d+[mhd]$/)) {
                        return interaction.reply({
                            content: '❌ Invalid duration format! Use e.g. 30m, 12h, 7d',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    // Prüfe auf Duplikate
                    if (settings.warnSystem.actions.some(a => a.warnings === warnings)) {
                        return interaction.reply({
                            content: '❌ This warning level already exists!',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    settings.warnSystem.actions.push({
                        warnings,
                        action,
                        duration: action === 'mute' ? duration : undefined
                    });

                    // Sortiere nach Anzahl der Warnungen
                    settings.warnSystem.actions.sort((a, b) => a.warnings - b.warnings);
                    await settings.save();

                    await interaction.reply({
                        content: `✅ Warning level added: ${warnings} warnings = ${action}${duration ? ` for ${duration}` : ''}`,
                        flags: MessageFlags.Ephemeral
                    });
                    break;
                }

                case 'remove': {
                    const warnings = interaction.options.getInteger('warnings');
                    const index = settings.warnSystem.actions.findIndex(a => a.warnings === warnings);


                    if (index === -1) {
                        return interaction.reply({
                            content: '❌ This warning level does not exist!',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    settings.warnSystem.actions.splice(index, 1);
                    await settings.save();

                    await interaction.reply({
                        content: `✅ Warning level for ${warnings} warnings has been removed!`,
                        flags: MessageFlags.Ephemeral
                    });
                    break;
                }

                case 'list': {
                    if (!settings.warnSystem.actions.length) {
                        return interaction.reply({
                            content: '❌ No warning levels configured!',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const embed = new EmbedBuilder()
                        .setTitle('⚠️ Warning System Levels')
                        .setDescription(settings.warnSystem.actions.map(a => 
                            `• ${a.warnings} warnings = ${a.action}${a.duration ? ` for ${a.duration}` : ''}`
                        ).join('\n'))
                        .addFields({
                            name: 'Automatic Decay',
                            value: settings.warnSystem.autoDecay 
                                ? `Active (${settings.warnSystem.decayDays} days)`
                                : 'Disabled'
                        })
                        .setColor('#ffa500')
                        .setTimestamp();

                    await interaction.reply({
                        embeds: [embed],
                        flags: MessageFlags.Ephemeral
                    });
                    break;
                }

                case 'decay': {
                    const active = interaction.options.getBoolean('active');
                    const days = interaction.options.getInteger('days');


                    settings.warnSystem.autoDecay = active;
                    if (days) settings.warnSystem.decayDays = days;
                    await settings.save();

                    await interaction.reply({
                        content: `✅ Automatic decay ${active ? `enabled (${settings.warnSystem.decayDays} days)` : 'disabled'}!`,
                        flags: MessageFlags.Ephemeral
                    });
                    break;
                }
            }

        } catch (error) {
            console.error('Warnsystem Error:', error);
            await interaction.reply({
                content: '❌ Error in warning system configuration!',
                flags: MessageFlags.Ephemeral
            });
        }

    },
}; 