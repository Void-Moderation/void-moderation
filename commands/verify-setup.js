const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { GuildSettings } = require('../schemas.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('verify-setup')
        .setDescription('Sets up the verification system')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel for verification')
                .setRequired(true))
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('The role given after verification')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('mode')
                .setDescription('Type of verification')
                .setRequired(true)
                .addChoices(
                    { name: 'Reaction', value: 'reaction' },
                    { name: 'Captcha', value: 'captcha' }
                ))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');
        const role = interaction.options.getRole('role');
        const mode = interaction.options.getString('mode');

        try {
            // Überprüfe Bot-Berechtigungen
            if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
                return interaction.reply({
                    content: '❌ I need the "Manage Roles" permission!',
                    ephemeral: true
                });
            }

            // Überprüfe Rollen-Hierarchie
            if (role.position >= interaction.guild.members.me.roles.highest.position) {
                return interaction.reply({
                    content: '❌ The verification role is too high in the hierarchy!',
                    ephemeral: true
                });
            }

            // Erstelle Verifizierungs-Embed
            const embed = new EmbedBuilder()
                .setTitle('🔐 Server Verification')
                .setDescription(mode === 'reaction' 
                    ? 'React with ✅ to verify!'
                    : 'Click the button to solve a captcha!')
                .setColor('#00ff00')
                .setTimestamp();

            // Speichere Einstellungen
            await GuildSettings.findOneAndUpdate(
                { guildId: interaction.guild.id },
                {
                    $set: {
                        verifyChannelId: channel.id,
                        verifyRoleId: role.id,
                        verifyMode: mode
                    }
                },
                { upsert: true }
            );

            const message = await channel.send({ embeds: [embed] });
            if (mode === 'reaction') {
                await message.react('✅');
            } else {
                const button = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('verify_captcha')
                            .setLabel('Verify')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('🔐')
                    );
                await message.edit({ components: [button] });
            }

            await interaction.reply({
                content: `✅ Verification system has been set up!\n`
                    + `Channel: ${channel}\n`
                    + `Role: ${role}\n`
                    + `Mode: ${mode === 'reaction' ? 'Reaction' : 'Captcha'}`,
                ephemeral: true
            });

        } catch (error) {
            console.error('Verify Setup Fehler:', error);
            await interaction.reply({
                content: '❌ Error setting up the verification system!',
                ephemeral: true
            });
        }
    },
}; 