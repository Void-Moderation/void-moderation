const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tempban')
        .setDescription('Temporarily bans a user from the server')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to ban')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('Ban duration (1h, 1d, 1w)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the temporary ban')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction) {
        const target = interaction.options.getUser('user');
        const duration = interaction.options.getString('duration');
        const reason = interaction.options.getString('reason');

        // Konvertiere Zeitstring in Millisekunden
        const timeInMs = duration
            .replace('w', '*7*24*60*60*1000')
            .replace('d', '*24*60*60*1000')
            .replace('h', '*60*60*1000')
            .split('*')
            .reduce((a, b) => a * b);

        if (isNaN(timeInMs)) {
            return interaction.reply({
                content: '❌ Invalid duration! Use format: 1h, 1d, 1w',
                ephemeral: true
            });
        }

        try {
            const member = await interaction.guild.members.fetch(target.id);

            // Überprüfe Rollen-Hierarchie
            if (member.roles.highest.position >= interaction.member.roles.highest.position) {
                return interaction.reply({
                    content: '❌ You cannot ban members with higher/equal roles!',
                    ephemeral: true
                });
            }

            // DM vor dem Bann
            await member.send({
                content: `📢 You have been temporarily banned from **${interaction.guild.name}**!\n`
                    + `Duration: ${duration}\n`
                    + `Reason: ${reason}`
            }).catch(() => null);

            await member.ban({ reason: `${reason} (Tempban: ${duration})` });

            // Plane Entbannung
            setTimeout(async () => {
                try {
                    await interaction.guild.members.unban(target.id, 'Tempban expired');
                    // Informiere den Channel über die Entbannung
                    const channel = await interaction.guild.channels.fetch(interaction.channelId);
                    channel.send(`✅ ${target.tag} has been automatically unbanned (Tempban expired)`);
                } catch (error) {
                    console.error('Entbann Fehler:', error);
                }
            }, timeInMs);

            await interaction.reply({
                content: `✅ ${target.tag} has been banned for ${duration}!\n`
                    + `Reason: ${reason}`,
                ephemeral: false
            });

        } catch (error) {
            console.error('Tempban Fehler:', error);
            await interaction.reply({
                content: '❌ Error during temporary ban!',
                ephemeral: true
            });
        }
    },
}; 