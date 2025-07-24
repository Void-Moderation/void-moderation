const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const { GuildSettings, Ticket } = require('../schemas.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tickets')
        .setDescription('Shows ticket statistics')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        try {
            const settings = await GuildSettings.findOne({ guildId: interaction.guild.id });
            if (!settings?.tickets?.enabled) {
                return interaction.reply({
                    content: '❌ The ticket system is not activated!',
                    flags: MessageFlags.Ephemeral
                });
            }

            const totalTickets = settings.tickets.counter;
            const openTickets = await Ticket.countDocuments({
                guildId: interaction.guild.id,
                status: 'open'
            });
            const closedTickets = await Ticket.countDocuments({
                guildId: interaction.guild.id,
                status: 'closed'
            });

            const embed = new EmbedBuilder()
                .setTitle('📊 Ticket Statistics')
                .addFields(
                    { name: 'Total Tickets', value: totalTickets.toString(), inline: true },
                    { name: 'Open Tickets', value: openTickets.toString(), inline: true },
                    { name: 'Closed Tickets', value: closedTickets.toString(), inline: true }
                )
                .setColor('#00ff00')
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Ticket Stats Fehler:', error);
            await interaction.reply({
                content: '❌ Error retrieving statistics!',
                flags: MessageFlags.Ephemeral
            });
        }
    },
}; 