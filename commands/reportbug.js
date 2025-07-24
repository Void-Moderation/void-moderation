const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reportbug')
        .setDescription('Report a bug to the bot developer')
        .addStringOption(option =>
            option.setName('description')
                .setDescription('Detailed description of the bug')
                .setRequired(true)
                .setMaxLength(1000))
        .addStringOption(option =>
            option.setName('reproduce')
                .setDescription('Steps to reproduce the bug')
                .setRequired(true)
                .setMaxLength(1000))
        .addAttachmentOption(option =>
            option.setName('screenshot')
                .setDescription('Optional: Screenshot of the bug')
                .setRequired(false)),

    async execute(interaction) {
        try {
            const description = interaction.options.getString('description');
            const reproduce = interaction.options.getString('reproduce');
            const screenshot = interaction.options.getAttachment('screenshot');

            // Erstelle Bug Report Embed für den Developer
            const reportEmbed = new EmbedBuilder()
                .setTitle('🐛 New Bug Report')
                .addFields(
                    { 
                        name: 'Reporter',
                        value: `${interaction.user.tag} (${interaction.user.id})`,
                        inline: true
                    },
                    { 
                        name: 'Server',
                        value: `${interaction.guild.name} (${interaction.guild.id})`,
                        inline: true
                    },
                    {
                        name: 'Channel',
                        value: `${interaction.channel.name} (${interaction.channel.id})`,
                        inline: true
                    },
                    {
                        name: 'Bug Description',
                        value: description
                    },
                    {
                        name: 'Steps to Reproduce',
                        value: reproduce
                    }
                )
                .setColor('#ff0000')
                .setTimestamp();

            if (screenshot) {
                if (screenshot.contentType?.startsWith('image/')) {
                    reportEmbed.setImage(screenshot.url);
                } else {
                    reportEmbed.addFields({
                        name: 'Screenshot',
                        value: 'Attachment was provided but is not an image'
                    });
                }
            }

            // Sende Report an Developer
            const developer = await interaction.client.users.fetch('1070058785084817420');
            await developer.send({ embeds: [reportEmbed] });

            // Bestätigungs-Embed für den User
            const confirmEmbed = new EmbedBuilder()
                .setTitle('✅ Bug Report Sent')
                .setDescription('Thank you for reporting this bug! Your report has been sent to the developer.')
                .addFields(
                    {
                        name: 'What happens next?',
                        value: 'The developer will review your report. If more information is needed, you might be contacted directly.'
                    },
                    {
                        name: 'Your Report',
                        value: `**Bug Description:**\n${description}\n\n**Steps to Reproduce:**\n${reproduce}`
                    }
                )
                .setColor('#00ff00')
                .setTimestamp();

            // Sende Bestätigung an User
            await interaction.reply({
                embeds: [confirmEmbed],
                ephemeral: true
            });

        } catch (error) {
            console.error('Bug Report Error:', error);
            await interaction.reply({
                content: '❌ Error sending bug report! Please try again later.',
                ephemeral: true
            });
        }
    },
}; 