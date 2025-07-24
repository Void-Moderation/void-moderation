const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { GuildSettings } = require('../schemas.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setlogchannel')
        .setDescription('Setzt den Kanal für Moderations-Logs')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Der Kanal für die Logs')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');

        try {
            await GuildSettings.findOneAndUpdate(
                { guildId: interaction.guild.id },
                { 
                    guildId: interaction.guild.id,
                    logChannelId: channel.id 
                },
                { upsert: true }
            );

            await interaction.reply({
                content: `✅ Log-Kanal wurde auf ${channel} gesetzt!`,
                ephemeral: true
            });
        } catch (error) {
            console.error('Setlogchannel Fehler:', error);
            await interaction.reply({
                content: '❌ Fehler beim Setzen des Log-Kanals!',
                ephemeral: true
            });
        }
    },
}; 