const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { logModAction } = require('../utils/logger.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Deletes a specified number of messages')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Number of messages to delete (1-100)')
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(true))
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Optional: Only delete messages from this user'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        const amount = interaction.options.getInteger('amount');
        const user = interaction.options.getUser('user');
        
        try {
            await interaction.deferReply({ ephemeral: true });
            
            // Nachrichten abrufen
            const messages = await interaction.channel.messages.fetch({ limit: 100 });
            
            // Nachrichten filtern
            let filteredMessages = messages;
            if (user) {
                filteredMessages = messages.filter(msg => msg.author.id === user.id);
            }
            
            // Auf die gewünschte Anzahl begrenzen und nur Nachrichten jünger als 14 Tage
            const deletableMessages = filteredMessages
                .filter(msg => !msg.pinned && Date.now() - msg.createdTimestamp < 1209600000)
                .first(amount);

            if (!deletableMessages.length) {
                return interaction.editReply({
                    content: '❌ No deletable messages found!',
                    ephemeral: true
                });
            }

            // Nachrichten löschen
            await interaction.channel.bulkDelete(deletableMessages);

            // Logging
            await logModAction(interaction.guild, {
                action: 'Nachrichten gelöscht',
                moderator: interaction.user,
                target: user || { tag: 'Alle Benutzer', id: 'N/A' },
                reason: `${deletableMessages.length} Nachrichten gelöscht`,
                color: '#808080'
            });

            await interaction.editReply({
                content: `✅ ${deletableMessages.length} messages have been deleted!`,
                ephemeral: true
            });

        } catch (error) {
            console.error('Clear Fehler:', error);
            await interaction.editReply({
                content: '❌ Error deleting messages!',
                ephemeral: true
            });
        }
    },
}; 