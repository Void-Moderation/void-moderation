const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const { logModAction } = require('../utils/logger.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('testlog')
        .setDescription('Tests the logging system')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            await logModAction(interaction.guild, {
                action: 'Test Log',
                moderator: interaction.user,
                target: interaction.user,
                reason: 'Testing the logging system',
                color: '#00ff00'
            });

            const embed = new EmbedBuilder()
                .setTitle('✅ Log Test')
                .setDescription('A test log has been sent. Check the log channel.')
                .setColor('#00ff00')
                .setTimestamp();

            await interaction.reply({
                embeds: [embed],
                flags: MessageFlags.Ephemeral
            });
        } catch (error) {
            console.error('Test Log Fehler:', error);
            await interaction.reply({
                content: '❌ Error testing the logging system!',
                flags: MessageFlags.Ephemeral
            });
        }
    },
}; 