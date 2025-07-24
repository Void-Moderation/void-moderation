const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Shows all available commands')
        .addStringOption(option =>
            option.setName('category')
                .setDescription('Command category to show')
                .setRequired(false)
                .addChoices(
                    { name: '🛡️ Moderation', value: 'moderation' },
                    { name: '⚙️ Setup', value: 'setup' },
                    { name: '🎫 Tickets', value: 'tickets' },
                    { name: '🔨 Auto-Moderation', value: 'automod' }
                )),

    async execute(interaction) {
        const category = interaction.options.getString('category');
        
        try {
            if (category) {
                // Zeige spezifische Kategorie
                const embed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTimestamp();

                switch (category) {
                    case 'moderation':
                        embed.setTitle('🛡️ Moderation Commands')
                            .addFields(
                                { name: '/ban', value: 'Bans a user from the server' },
                                { name: '/tempban', value: 'Temporarily bans a user' },
                                { name: '/softban', value: 'Kicks a user and deletes their messages' },
                                { name: '/kick', value: 'Kicks a user from the server' },
                                { name: '/mute', value: 'Temporarily mutes a user' },
                                { name: '/unmute', value: 'Unmutes a user' },
                                { name: '/warn', value: 'Warns a user' },
                                { name: '/clear', value: 'Deletes a specified number of messages' }
                            );
                        break;

                    case 'setup':
                        embed.setTitle('⚙️ Setup Commands')
                            .addFields(
                                { name: '/welcome-setup', value: 'Sets up the welcome system' },
                                { name: '/verify-setup', value: 'Sets up the verification system' },
                                { name: '/ticket-setup', value: 'Sets up the ticket system' },
                                { name: '/autorole', value: 'Manages automatic roles' },
                                { name: '/setlogchannel', value: 'Sets the channel for moderation logs' }
                            );
                        break;

                    case 'tickets':
                        embed.setTitle('🎫 Ticket Commands')
                            .addFields(
                                { name: '/ticket-setup', value: 'Sets up the ticket system' },
                                { name: '/tickets', value: 'Shows ticket statistics' }
                            );
                        break;

                    case 'automod':
                        embed.setTitle('🔨 Auto-Moderation Commands')
                            .addFields(
                                { name: '/automod', value: 'Configures automatic moderation' },
                                { name: '/antiraid', value: 'Configures the Anti-Raid system' },
                                { name: '/warnsystem', value: 'Configures the warning system' },
                                { name: '/raidmode', value: 'Manages raid protection mode' }
                            );
                        break;
                }

                await interaction.reply({ embeds: [embed] });
            } else {
                // Zeige Übersicht aller Kategorien
                const embed = new EmbedBuilder()
                    .setTitle('📚 Command Help')
                    .setDescription('Select a category to see specific commands:')
                    .addFields(
                        { 
                            name: '🛡️ Moderation', 
                            value: 'Ban, kick, mute, warn and other moderation commands\n`/help category:moderation`',
                            inline: true 
                        },
                        { 
                            name: '⚙️ Setup', 
                            value: 'Commands to set up various bot features\n`/help category:setup`',
                            inline: true 
                        },
                        { 
                            name: '🎫 Tickets', 
                            value: 'Ticket system related commands\n`/help category:tickets`',
                            inline: true 
                        },
                        { 
                            name: '🔨 Auto-Moderation', 
                            value: 'Auto-moderation and raid protection commands\n`/help category:automod`',
                            inline: true 
                        }
                    )
                    .setColor('#00ff00')
                    .setTimestamp()
                    .setFooter({ text: 'Use /help category:[category] to see specific commands' });

                await interaction.reply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Help Command Error:', error);
            await interaction.reply({
                content: '❌ Error displaying help menu!',
                ephemeral: true
            });
        }
    },
}; 