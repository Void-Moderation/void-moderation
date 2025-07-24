const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const { GuildSettings, Ticket } = require('../schemas.js');
const { logModAction } = require('./logger.js');

class TicketManager {
    async createTicket(interaction) {
        try {
            const settings = await GuildSettings.findOne({ 
                guildId: interaction.guild.id,
                'tickets.enabled': true 
            });
            
            if (!settings?.tickets) {
                return interaction.reply({
                    content: '❌ Das Ticket-System ist nicht eingerichtet!',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Prüfe maximale Anzahl offener Tickets
            const userTickets = await Ticket.countDocuments({
                guildId: interaction.guild.id,
                userId: interaction.user.id,
                status: 'open'
            });

            if (userTickets >= settings.tickets.maxTickets) {
                return interaction.reply({
                    content: `❌ Du hast bereits ${userTickets} offene Tickets!`,
                    flags: MessageFlags.Ephemeral
                });
            }

            // Prüfe ob die Kategorie existiert und vom richtigen Typ ist
            const category = await interaction.guild.channels.fetch(settings.tickets.categoryId);
            if (!category || category.type !== ChannelType.GuildCategory) {
                return interaction.reply({
                    content: '❌ Die Ticket-Kategorie wurde nicht gefunden oder ist ungültig!',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Erhöhe Ticket-Counter
            const ticketNumber = settings.tickets.counter + 1;
            await GuildSettings.updateOne(
                { guildId: interaction.guild.id },
                { $inc: { 'tickets.counter': 1 } }
            );

            // Erstelle Ticket-Kanal
            const channel = await interaction.guild.channels.create({
                name: `ticket-${ticketNumber}`,
                parent: category.id,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    {
                        id: interaction.guild.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: interaction.user.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                    },
                    {
                        id: settings.tickets.supportRoleId,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                    }
                ]
            });

            // Erstelle Ticket in der Datenbank
            const ticket = new Ticket({
                guildId: interaction.guild.id,
                channelId: channel.id,
                userId: interaction.user.id,
                ticketNumber: ticketNumber
            });
            await ticket.save();

            // Erstelle Ticket-Embed
            const embed = new EmbedBuilder()
                .setTitle(`Ticket #${ticketNumber}`)
                .setDescription('Willkommen! Bitte beschreibe dein Anliegen.\nEin Teammitglied wird sich in Kürze um dich kümmern.')
                .setColor('#00ff00')
                .addFields(
                    { name: 'Erstellt von', value: interaction.user.toString(), inline: true },
                    { name: 'Status', value: '🟢 Offen', inline: true }
                )
                .setTimestamp();

            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('close_ticket')
                        .setLabel('Ticket schließen')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒'),
                    new ButtonBuilder()
                        .setCustomId('claim_ticket')
                        .setLabel('Ticket übernehmen')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('✋')
                );

            await channel.send({
                content: `${interaction.user} | <@&${settings.tickets.supportRoleId}>`,
                embeds: [embed],
                components: [buttons]
            });

            await interaction.reply({
                content: `✅ Dein Ticket wurde erstellt: ${channel}`,
                flags: MessageFlags.Ephemeral
            });

            // Logging
            await logModAction(interaction.guild, {
                action: 'Ticket erstellt',
                moderator: interaction.client.user,
                target: interaction.user,
                reason: `Ticket #${ticketNumber}`,
                color: '#00ff00'
            });

        } catch (error) {
            console.error('Ticket Erstellung Fehler:', error);
            await interaction.reply({
                content: '❌ Fehler beim Erstellen des Tickets!',
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }
    }

    async closeTicket(interaction) {
        try {
            const ticket = await Ticket.findOne({
                channelId: interaction.channel.id,
                status: 'open'
            });

            if (!ticket) {
                return interaction.reply({
                    content: '❌ Dieses Ticket wurde bereits geschlossen!',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Update Ticket Status
            ticket.status = 'closed';
            ticket.closedAt = new Date();
            ticket.closedBy = interaction.user.id;
            await ticket.save();

            const embed = new EmbedBuilder()
                .setTitle('Ticket wird geschlossen')
                .setDescription('Dieses Ticket wird in 5 Sekunden archiviert...')
                .setColor('#ff0000')
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

            // Logging
            await logModAction(interaction.guild, {
                action: 'Ticket geschlossen',
                moderator: interaction.user,
                target: { id: ticket.userId, tag: 'User' },
                reason: `Ticket #${ticket.ticketNumber}`,
                color: '#ff0000'
            });

            // Verzögertes Löschen des Kanals
            setTimeout(async () => {
                await interaction.channel.delete().catch(console.error);
            }, 5000);

        } catch (error) {
            console.error('Ticket Schließen Fehler:', error);
            await interaction.reply({
                content: '❌ Fehler beim Schließen des Tickets!',
                flags: MessageFlags.Ephemeral
            });
        }
    }

    async claimTicket(interaction) {
        try {
            const ticket = await Ticket.findOne({
                channelId: interaction.channel.id,
                status: 'open'
            });

            if (!ticket) {
                return interaction.reply({
                    content: '❌ Dieses Ticket wurde bereits geschlossen!',
                    flags: MessageFlags.Ephemeral
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('Ticket übernommen')
                .setDescription(`${interaction.user} kümmert sich nun um dieses Ticket.`)
                .setColor('#ffa500')
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Ticket Claim Fehler:', error);
            await interaction.reply({
                content: '❌ Fehler beim Übernehmen des Tickets!',
                flags: MessageFlags.Ephemeral
            });
        }
    }
}

module.exports = new TicketManager(); 