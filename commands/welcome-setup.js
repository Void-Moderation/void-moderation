const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const { GuildSettings } = require('../schemas.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('welcome-setup')
        .setDescription('Sets up the welcome system')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel for welcome messages')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('message')
                .setDescription('The welcome message (Use {user} for username)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('image')
                .setDescription('URL of the welcome image (optional)')
                .setRequired(false))
        .addRoleOption(option =>
            option.setName('autorole')
                .setDescription('Optional: Role to assign automatically'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');
        const message = interaction.options.getString('message');
        const imageUrl = interaction.options.getString('image');
        const autoRole = interaction.options.getRole('autorole');

        try {
            // Überprüfe Bot-Berechtigungen
            if (autoRole && autoRole.position >= interaction.guild.members.me.roles.highest.position) {
                return interaction.reply({
                    content: '❌ The auto-role is too high in the hierarchy!',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Validiere Bild-URL wenn angegeben
            if (imageUrl && !imageUrl.match(/^https?:\/\/.+\.(jpg|jpeg|png|gif)$/i)) {
                return interaction.reply({
                    content: '❌ Invalid image URL! Please use a direct image URL (ending with .jpg, .png, etc.)',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Speichere Einstellungen
            await GuildSettings.findOneAndUpdate(
                { guildId: interaction.guild.id },
                {
                    $set: {
                        welcomeChannelId: channel.id,
                        welcomeMessage: message,
                        welcomeImageUrl: imageUrl || null,
                        autoRoles: autoRole ? [autoRole.id] : []
                    }
                },
                { upsert: true }
            );

            // Zeige Vorschau
            const previewEmbed = new EmbedBuilder()
                .setTitle('👋 Welcome System Setup')
                .addFields(
                    { name: 'Channel', value: `${channel}`, inline: true },
                    { name: 'Message', value: message.replace('{user}', interaction.user.toString()), inline: true }
                )
                .setColor('#00ff00')
                .setTimestamp();

            if (autoRole) {
                previewEmbed.addFields({ name: 'Auto-Role', value: autoRole.toString(), inline: true });
            }

            await interaction.reply({
                embeds: [previewEmbed],
                flags: MessageFlags.Ephemeral
            });

        } catch (error) {
            console.error('Welcome Setup Fehler:', error);
            await interaction.reply({
                content: '❌ Error setting up the welcome system!',
                flags: MessageFlags.Ephemeral
            });
        }
    },
}; 