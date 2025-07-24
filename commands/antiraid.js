const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const { GuildSettings } = require('../schemas.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('antiraid')
        .setDescription('Configures the Anti-Raid system')
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Sets up the Anti-Raid system')
                .addIntegerOption(option =>
                    option.setName('joins')
                        .setDescription('Number of joins within time window')
                        .setRequired(true)
                        .setMinValue(2)
                        .setMaxValue(20))
                .addIntegerOption(option =>
                    option.setName('seconds')
                        .setDescription('Time window in seconds')
                        .setRequired(true)
                        .setMinValue(5)
                        .setMaxValue(60))
                .addStringOption(option =>
                    option.setName('action')
                        .setDescription('Action on raid detection')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Kick', value: 'kick' },
                            { name: 'Ban', value: 'ban' },
                            { name: 'Force Verification', value: 'verify' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('toggle')
                .setDescription('Enables/Disables the Anti-Raid system'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        try {
            let settings = await GuildSettings.findOne({ guildId: interaction.guild.id });
            if (!settings) {
                settings = new GuildSettings({ guildId: interaction.guild.id });
            }

            switch (subcommand) {
                case 'setup':
                    const joins = interaction.options.getInteger('joins');
                    const seconds = interaction.options.getInteger('seconds');
                    const action = interaction.options.getString('action');

                    settings.antiraid = {
                        enabled: true,
                        joinThreshold: joins,
                        timeWindow: seconds,
                        action: action,
                        logEnabled: true
                    };

                    await settings.save();

                    const setupEmbed = new EmbedBuilder()
                        .setTitle('🛡️ Anti-Raid System Setup')
                        .setDescription('The system has been activated with the following settings:')
                        .addFields(
                            { name: 'Joins', value: joins.toString(), inline: true },
                            { name: 'Time Window', value: `${seconds} seconds`, inline: true },
                            { name: 'Action', value: action, inline: true }
                        )
                        .setColor('#00ff00')
                        .setTimestamp();

                    await interaction.reply({
                        embeds: [setupEmbed],
                        flags: MessageFlags.Ephemeral
                    });
                    break;

                case 'toggle':
                    settings.antiraid.enabled = !settings.antiraid.enabled;
                    await settings.save();

                    await interaction.reply({
                        content: `✅ Anti-Raid system has been ${settings.antiraid.enabled ? 'enabled' : 'disabled'}!`,
                        flags: MessageFlags.Ephemeral
                    });
                    break;
            }
        } catch (error) {
            console.error('Anti-Raid Setup Fehler:', error);
            await interaction.reply({
                content: '❌ Error setting up the Anti-Raid system!',
                flags: MessageFlags.Ephemeral
            });
        }
    },
}; 