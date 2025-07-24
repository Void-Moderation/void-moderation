const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { GuildSettings } = require('../schemas.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('automod')
        .setDescription('Configures automatic moderation')
        .addSubcommand(subcommand =>
            subcommand
                .setName('toggle')
                .setDescription('Enables/Disables automatic moderation'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('addword')
                .setDescription('Adds a banned word')
                .addStringOption(option =>
                    option.setName('word')
                        .setDescription('The word to ban')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('removeword')
                .setDescription('Removes a banned word')
                .addStringOption(option =>
                    option.setName('word')
                        .setDescription('The word to remove')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('punishment')
                .setDescription('Sets punishment for violations')
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('Type of punishment')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Warning', value: 'warn' },
                            { name: 'Timeout', value: 'mute' },
                            { name: 'Kick', value: 'kick' }
                        )))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        try {
            let settings = await GuildSettings.findOne({ guildId: interaction.guild.id });
            if (!settings) {
                settings = new GuildSettings({ guildId: interaction.guild.id });
            }

            switch (subcommand) {
                case 'toggle':
                    settings.automod.enabled = !settings.automod.enabled;
                    await settings.save();
                    await interaction.reply({
                        content: `✅ AutoMod has been ${settings.automod.enabled ? 'enabled' : 'disabled'}!`,
                        ephemeral: true
                    });
                    break;

                case 'addword':
                    const wordToAdd = interaction.options.getString('word').toLowerCase();
                    if (!settings.automod.bannedWords.includes(wordToAdd)) {
                        settings.automod.bannedWords.push(wordToAdd);
                        await settings.save();
                        await interaction.reply({
                            content: `✅ The word "${wordToAdd}" has been added to the filter list!`,
                            ephemeral: true
                        });
                    } else {
                        await interaction.reply({
                            content: '❌ This word is already in the filter list!',
                            ephemeral: true
                        });
                    }
                    break;

                case 'removeword':
                    const wordToRemove = interaction.options.getString('word').toLowerCase();
                    const index = settings.automod.bannedWords.indexOf(wordToRemove);
                    if (index > -1) {
                        settings.automod.bannedWords.splice(index, 1);
                        await settings.save();
                        await interaction.reply({
                            content: `✅ The word "${wordToRemove}" has been removed from the filter list!`,
                            ephemeral: true
                        });
                    } else {
                        await interaction.reply({
                            content: '❌ This word is not in the filter list!',
                            ephemeral: true
                        });
                    }
                    break;

                case 'punishment':
                    const punishmentType = interaction.options.getString('type');
                    settings.automod.punishmentType = punishmentType;
                    await settings.save();
                    await interaction.reply({
                        content: `✅ The punishment for AutoMod violations has been set to "${punishmentType}"!`,
                        ephemeral: true
                    });
                    break;
            }
        } catch (error) {
            console.error('AutoMod Konfigurations-Fehler:', error);
            await interaction.reply({
                content: '❌ Error in AutoMod configuration!',
                ephemeral: true
            });
        }
    },
}; 