const { Events, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { GuildSettings } = require('./schemas.js');
const captchaGenerator = require('./utils/captcha.js');
const automod = require('./utils/automod.js');
const { logModAction } = require('./utils/logger.js');
const raidManager = require('./utils/raidManager.js');
const ticketManager = require('./utils/ticketManager.js');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { ChannelType } = require('discord.js');
const { ActivityType } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

// Pfade zu den Blocklist-Dateien
const BLOCKLIST_PATH = {
    users: path.join(__dirname, 'data', 'blocked_users.json'),
    guilds: path.join(__dirname, 'data', 'blocked_guilds.json')
};

// Lade Blocklisten
const BLOCKED = {
    users: new Set(),
    guilds: new Set()
};

// Funktion zum Laden der Blocklisten
async function loadBlocklists() {
    try {
        // Erstelle data Ordner falls nicht vorhanden
        await fs.mkdir(path.join(__dirname, 'data'), { recursive: true });

        // Lade User-Blocklist
        try {
            const userData = await fs.readFile(BLOCKLIST_PATH.users, 'utf-8');
            BLOCKED.users = new Set(JSON.parse(userData));
        } catch (e) {
            await fs.writeFile(BLOCKLIST_PATH.users, '[]');
        }

        // Lade Guild-Blocklist
        try {
            const guildData = await fs.readFile(BLOCKLIST_PATH.guilds, 'utf-8');
            BLOCKED.guilds = new Set(JSON.parse(guildData));
        } catch (e) {
            await fs.writeFile(BLOCKLIST_PATH.guilds, '[]');
        }
    } catch (error) {
        console.error('Error loading blocklists:', error);
    }
}

// Funktion zum Speichern der Blocklisten
async function saveBlocklists() {
    try {
        await fs.writeFile(
            BLOCKLIST_PATH.users, 
            JSON.stringify(Array.from(BLOCKED.users), null, 2)
        );
        await fs.writeFile(
            BLOCKLIST_PATH.guilds, 
            JSON.stringify(Array.from(BLOCKED.guilds), null, 2)
        );
    } catch (error) {
        console.error('Error saving blocklists:', error);
    }
}

function loadEvents(client) {
    // Lade Blocklisten beim Start
    loadBlocklists();

    // Ready Event
    client.once(Events.ClientReady, () => {
        console.log(`✅ Bot ist online als ${client.user.tag}!`);
        console.log(`🤖 Aktiv auf ${client.guilds.cache.size} Servern`);
        
        client.user.setPresence({
            activities: [{ 
                name: '/help für Hilfe',
                type: 3
            }],
            status: 'online'
        });
    });

    // Interaction Create Event
    client.on(Events.InteractionCreate, async interaction => {
        if (!interaction.isChatInputCommand()) return;

        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            const errorMessage = { 
                content: 'Bei der Ausführung des Befehls ist ein Fehler aufgetreten!',
                ephemeral: true 
            };
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        }
    });

    // Reaction Add Event für Verifizierung
    client.on(Events.MessageReactionAdd, async (reaction, user) => {
        if (user.bot) return;
        
        try {
            // Wenn die Reaktion partiell ist, fülle sie auf
            if (reaction.partial) {
                await reaction.fetch();
            }

            const settings = await GuildSettings.findOne({ 
                guildId: reaction.message.guild.id,
                verifyChannelId: reaction.message.channel.id,
                verifyMode: 'reaction'
            });
            
            if (!settings?.verifyRoleId) return;
            
            const member = await reaction.message.guild.members.fetch(user.id);
            // Prüfe ob es die richtige Reaktion ist
            if (reaction.emoji.name === '✅') {
                await member.roles.add(settings.verifyRoleId);
                // Optional: Bestätigungsnachricht senden
                await user.send({
                    content: `✅ Du wurdest erfolgreich auf ${reaction.message.guild.name} verifiziert!`
                }).catch(() => {}); // Ignoriere Fehler wenn DMs deaktiviert sind
            }
            
        } catch (error) {
            console.error('Verifikations-Fehler:', error);
        }
    });

    // Button Interaction für Captcha
    client.on(Events.InteractionCreate, async interaction => {
        if (!interaction.isButton() || interaction.customId !== 'verify_captcha') return;
        
        try {
            // Prüfe ob der Benutzer bereits verifiziert ist
            const settings = await GuildSettings.findOne({ 
                guildId: interaction.guild.id,
                verifyChannelId: interaction.channel.id,
                verifyMode: 'captcha'
            });
            
            if (!settings?.verifyRoleId) return;

            const member = await interaction.guild.members.fetch(interaction.user.id);
            if (member.roles.cache.has(settings.verifyRoleId)) {
                return interaction.reply({
                    content: '❌ Du bist bereits verifiziert!',
                    flags: MessageFlags.Ephemeral
                });
            }

            const { code } = captchaGenerator.generateCode();

            const modal = new ModalBuilder()
                .setCustomId(`captcha_${code}`)
                .setTitle('🔐 Server Verification')
                .setDescription('Click the button to solve a captcha!')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('verify_captcha')
                            .setLabel('Verify')
                            .setEmoji('🔐')
                            .setStyle(ButtonStyle.Primary)
                    )
                );

            // Zeige das Modal
            await interaction.showModal(modal);

        } catch (error) {
            console.error('Captcha Fehler:', error);
            interaction.reply({
                content: '❌ Bitte versuche es erneut.',
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }
    });

    // Modal Submit für Captcha
    client.on(Events.InteractionCreate, async interaction => {
        if (!interaction.isModalSubmit() || !interaction.customId.startsWith('captcha_')) return;

        const correctCode = interaction.customId.replace('captcha_', '');
        const userInput = interaction.fields.getTextInputValue('captcha_input');

        try {
            if (userInput.toUpperCase() === correctCode) {
                const settings = await GuildSettings.findOne({ guildId: interaction.guild.id });
                if (settings?.verifyRoleId) {
                    await interaction.member.roles.add(settings.verifyRoleId);
                    const embed = new EmbedBuilder()
                        .setTitle('✅ Verification Successful')
                        .setDescription('You now have access to the server!')
                        .setColor('#00ff00')
                        .setTimestamp();

                    await interaction.reply({ 
                        embeds: [embed],
                        flags: MessageFlags.Ephemeral
                    });
                }
            } else {
                const embed = new EmbedBuilder()
                    .setTitle('❌ Verification Failed')
                    .setDescription('The entered code was incorrect. Please try again.')
                    .setColor('#ff0000')
                    .setTimestamp();

                await interaction.reply({ 
                    embeds: [embed],
                    flags: MessageFlags.Ephemeral
                });
            }
        } catch (error) {
            console.error('Captcha Verifizierungs-Fehler:', error);
            await interaction.reply({
                content: '❌ Error during verification!',
                flags: MessageFlags.Ephemeral
            });
        }
    });

    // Message Create Event für AutoMod
    client.on(Events.MessageCreate, async message => {
        await automod.processMessage(message);
    });

    // Willkommens-Event
    client.on(Events.GuildMemberAdd, async member => {
        try {
            // Anti-Raid Check
            await raidManager.handleJoin(member);

            const settings = await GuildSettings.findOne({ guildId: member.guild.id });
            if (!settings?.welcomeChannelId || !settings.welcomeMessage) return;

            const channel = await member.guild.channels.fetch(settings.welcomeChannelId);
            if (!channel) return;

            // Sende Willkommensnachricht
            const welcomeMessage = settings.welcomeMessage
                .replace('{user}', member.toString())
                .replace('{server}', member.guild.name)
                .replace('{count}', member.guild.memberCount.toString());

            const embed = new EmbedBuilder()
                .setTitle('👋 Welcome!')
                .setDescription(welcomeMessage)
                .setColor('#00ff00')
                .setThumbnail(member.user.displayAvatarURL())
                .setImage(settings.welcomeImageUrl || null)
                .setTimestamp();

            await channel.send({ embeds: [embed] });

            // Auto-Rolle vergeben
            if (settings.autoRoles?.length > 0) {
                for (const roleId of settings.autoRoles) {
                    const role = await member.guild.roles.fetch(roleId);
                    if (role && role.position < member.guild.members.me.roles.highest.position) {
                        await member.roles.add(role).catch(console.error);
                    }
                }
            }

            // Logging
            await logModAction(member.guild, {
                action: 'Mitglied beigetreten',
                moderator: client.user,
                target: member.user,
                reason: `Willkommensnachricht gesendet${settings.autoRoles?.length ? ' und Auto-Rolle(n) vergeben' : ''}`,
                color: '#00ff00'
            });

        } catch (error) {
            console.error('Willkommenssystem Fehler:', error);
        }
    });

    // Message Delete Event
    client.on(Events.MessageDelete, async message => {
        if (message.author?.bot) return;

        try {
            const settings = await GuildSettings.findOne({ guildId: message.guild.id });
            if (!settings?.logChannelId) return;

            const embed = new EmbedBuilder()
                .setTitle('🗑️ Message Deleted')
                .setColor('#ff0000')
                .addFields(
                    { name: 'Author', value: `${message.author.tag} (${message.author.id})`, inline: true },
                    { name: 'Channel', value: `${message.channel}`, inline: true },
                    { name: 'Content', value: message.content || '*No text content*' }
                )
                .setTimestamp();

            // Wenn die Nachricht Anhänge hatte
            if (message.attachments.size > 0) {
                embed.addFields({
                    name: 'Attachments',
                    value: message.attachments.map(a => a.url).join('\n')
                });
            }

            const logChannel = await message.guild.channels.fetch(settings.logChannelId);
            await logChannel.send({ embeds: [embed] });

        } catch (error) {
            console.error('Message Delete Log Fehler:', error);
        }
    });

    // Message Update Event
    client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
        if (oldMessage.author?.bot) return;
        if (oldMessage.content === newMessage.content) return;

        try {
            const settings = await GuildSettings.findOne({ guildId: oldMessage.guild.id });
            if (!settings?.logChannelId) return;

            const embed = new EmbedBuilder()
                .setTitle('✏️ Message Edited')
                .setColor('#ffa500')
                .addFields(
                    { name: 'Author', value: `${oldMessage.author.tag} (${oldMessage.author.id})`, inline: true },
                    { name: 'Channel', value: `${oldMessage.channel}`, inline: true },
                    { name: 'Old Content', value: oldMessage.content || '*No text content*' },
                    { name: 'New Content', value: newMessage.content || '*No text content*' }
                )
                .setTimestamp();

            const logChannel = await oldMessage.guild.channels.fetch(settings.logChannelId);
            await logChannel.send({ embeds: [embed] });

        } catch (error) {
            console.error('Message Update Log Fehler:', error);
        }
    });

    // Ticket Button Handler
    client.on(Events.InteractionCreate, async interaction => {
        if (!interaction.isButton()) return;
        
        try {
            switch (interaction.customId) {
                case 'create_ticket':
                    await ticketManager.createTicket(interaction);
                    break;
                case 'close_ticket':
                    // Prüfe Berechtigungen
                    const settings = await GuildSettings.findOne({ guildId: interaction.guild.id });
                    if (!settings?.tickets?.supportRoleId) return;

                    const member = await interaction.guild.members.fetch(interaction.user.id);
                    const hasPermission = member.roles.cache.has(settings.tickets.supportRoleId) || 
                                        member.permissions.has(PermissionFlagsBits.Administrator);

                    if (!hasPermission) {
                        return interaction.reply({
                            content: '❌ Du hast keine Berechtigung, Tickets zu schließen!',
                            flags: MessageFlags.Ephemeral
                        });
                    }
                    await ticketManager.closeTicket(interaction);
                    break;
                case 'claim_ticket':
                    // Prüfe Support-Rolle
                    const guildSettings = await GuildSettings.findOne({ guildId: interaction.guild.id });
                    if (!guildSettings?.tickets?.supportRoleId) return;

                    const supportMember = await interaction.guild.members.fetch(interaction.user.id);
                    if (!supportMember.roles.cache.has(guildSettings.tickets.supportRoleId)) {
                        return interaction.reply({
                            content: '❌ Du musst ein Supporter sein, um Tickets zu übernehmen!',
                            flags: MessageFlags.Ephemeral
                        });
                    }
                    await ticketManager.claimTicket(interaction);
                    break;
            }
        } catch (error) {
            console.error('Ticket Button Fehler:', error);
            await interaction.reply({
                content: '❌ Es ist ein Fehler aufgetreten!',
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }
    });

    // Füge nach dem Ready Event hinzu:
    client.on(Events.MessageCreate, async message => {
        // Ignoriere Bot-Nachrichten und Nachrichten die nicht mit -admin beginnen
        if (message.author.bot || !message.content.startsWith('-admin')) return;

        // Prüfe ob der Benutzer berechtigt ist
        if (message.author.id !== '1070058785084817420') return;

        const args = message.content.slice('-admin '.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        // Help Command für Admin Commands
        if (command === 'help') {
            const embed = new EmbedBuilder()
                .setTitle('🛠️ Admin Commands')
                .setDescription('List of all available admin commands')
                .addFields(
                    { 
                        name: '-admin showservers', 
                        value: 'Shows detailed list of all servers the bot is in'
                    },
                    { 
                        name: '-admin leave <server_id>', 
                        value: 'Makes the bot leave the specified server'
                    },
                    { 
                        name: '-admin createinvite <server_id>', 
                        value: 'Creates a permanent invite for the specified server'
                    },
                    { 
                        name: '-admin globalannounce <title> | <description> | <color hex>', 
                        value: 'Sends an announcement embed to all servers\nExample: -admin globalannounce New Update! | Bot has been updated | #ff0000'
                    }
                )
                .setColor('#00ff00')
                .setTimestamp();

            await message.reply({ embeds: [embed] });
        }

        // Global Announcement Command
        if (command === 'globalannounce') {
            try {
                const content = args.join(' ').split('|').map(part => part.trim());
                if (content.length < 2) {
                    return message.reply('❌ Please use the format: -admin globalannounce <title> | <description> | <color hex>');
                }

                const [title, description, color = '#00ff00'] = content;

                const announceEmbed = new EmbedBuilder()
                    .setTitle(title)
                    .setDescription(description)
                    .setColor(color)
                    .setTimestamp()
                    .setFooter({ text: 'Global Announcement' });

                let successCount = 0;
                let failCount = 0;
                const guilds = await client.guilds.fetch();

                // Sende die Ankündigung an jeden Server
                for (const [id, guild] of guilds) {
                    try {
                        const fetchedGuild = await guild.fetch();
                        // Versuche zuerst den System-Channel, dann den ersten verfügbaren Text-Channel
                        const channel = fetchedGuild.systemChannel || 
                            fetchedGuild.channels.cache
                                .filter(c => c.type === ChannelType.GuildText &&
                                    c.permissionsFor(fetchedGuild.members.me).has(PermissionFlagsBits.SendMessages))
                                .first();

                        if (channel) {
                            await channel.send({ embeds: [announceEmbed] });
                            successCount++;
                        } else {
                            failCount++;
                        }
                    } catch (err) {
                        console.error(`Fehler beim Senden an Guild ${id}:`, err);
                        failCount++;
                    }
                }

                // Sende Zusammenfassung
                const summaryEmbed = new EmbedBuilder()
                    .setTitle('📢 Global Announcement Summary')
                    .addFields(
                        { name: 'Successfully Sent', value: successCount.toString(), inline: true },
                        { name: 'Failed', value: failCount.toString(), inline: true },
                        { name: 'Total Servers', value: guilds.size.toString(), inline: true }
                    )
                    .setColor('#00ff00')
                    .setTimestamp();

                await message.reply({ embeds: [summaryEmbed] });

            } catch (error) {
                console.error('Global Announcement Error:', error);
                await message.reply('❌ Error sending global announcement!');
            }
        }

        // Create Invite Command
        if (command === 'createinvite') {
            try {
                if (!args[0]) {
                    return message.reply('❌ Please provide a server ID!');
                }

                const guild = await client.guilds.fetch(args[0]);
                if (!guild) {
                    return message.reply('❌ Server not found or bot is not a member!');
                }

                // Finde den ersten verfügbaren Text-Channel
                const channel = guild.channels.cache
                    .filter(c => c.type === ChannelType.GuildText && 
                        c.permissionsFor(guild.members.me).has(PermissionFlagsBits.CreateInstantInvite))
                    .first();

                if (!channel) {
                    return message.reply('❌ No suitable channel found to create an invite!');
                }

                // Erstelle einen permanenten Invite
                const invite = await channel.createInvite({
                    maxAge: 0, // Kein Ablauf
                    maxUses: 0, // Unbegrenzte Nutzungen
                    unique: true,
                    reason: 'Admin requested invite'
                });

                // Erstelle Embed für die Antwort
                const embed = new EmbedBuilder()
                    .setTitle('🔗 Invite Created')
                    .setDescription(`Successfully created an invite for ${guild.name}`)
                    .addFields(
                        { name: 'Server Name', value: guild.name, inline: true },
                        { name: 'Server ID', value: guild.id, inline: true },
                        { name: 'Channel', value: channel.name, inline: true },
                        { name: 'Invite Link', value: `discord.gg/${invite.code}`, inline: false }
                    )
                    .setColor('#00ff00')
                    .setTimestamp();

                // Sende Bestätigung
                await message.reply({ embeds: [embed] });

            } catch (error) {
                console.error('Create Invite Error:', error);
                await message.reply('❌ Error creating invite! Make sure the bot has the required permissions.');
            }
        }

        // Leave Command
        if (command === 'leave') {
            try {
                if (!args[0]) {
                    return message.reply('❌ Please provide a server ID!');
                }

                const guild = await client.guilds.fetch(args[0]);
                if (!guild) {
                    return message.reply('❌ Server not found or bot is not a member!');
                }

                // Erstelle Embed für die Bestätigung
                const embed = new EmbedBuilder()
                    .setTitle('🚪 Left Server')
                    .setDescription(`Successfully left the following server:`)
                    .addFields(
                        { name: 'Server Name', value: guild.name, inline: true },
                        { name: 'Server ID', value: guild.id, inline: true },
                        { name: 'Member Count', value: guild.memberCount.toString(), inline: true }
                    )
                    .setColor('#ff0000')
                    .setTimestamp();

                // Verlasse den Server
                await guild.leave();

                // Sende Bestätigung
                await message.reply({ embeds: [embed] });

            } catch (error) {
                console.error('Leave Command Error:', error);
                await message.reply('❌ Error leaving the server! Make sure the ID is valid.');
            }
        }

        if (command === 'showservers') {
            try {
                let description = '';
                const guilds = await message.client.guilds.fetch();
                
                for (const [id, guild] of guilds) {
                    const fetchedGuild = await guild.fetch();
                    const owner = await fetchedGuild.fetchOwner();
                    let invite = 'Keine Berechtigung';
                    
                    try {
                        // Versuche einen Invite zu erstellen
                        const inviteChannel = fetchedGuild.channels.cache
                            .filter(c => c.type === ChannelType.GuildText)
                            .first();
                        
                        if (inviteChannel) {
                            const newInvite = await inviteChannel.createInvite({
                                maxAge: 0,
                                maxUses: 0
                            });
                            invite = `discord.gg/${newInvite.code}`;
                        }
                    } catch (err) {
                        console.error(`Konnte keinen Invite für ${fetchedGuild.name} erstellen:`, err);
                    }

                    description += `\n\n__**${fetchedGuild.name}**__\n` +
                        `**ID:** ${fetchedGuild.id}\n` +
                        `**Owner:** ${owner.user.tag} (${owner.user.id})\n` +
                        `**Members:** ${fetchedGuild.memberCount}\n` +
                        `**Created:** <t:${Math.floor(fetchedGuild.createdTimestamp / 1000)}:R>\n` +
                        `**Invite:** ${invite}`;
                }

                // Erstelle Embeds (Discord hat ein Limit von 4096 Zeichen pro Embed)
                const embedPages = [];
                const chunks = description.match(/.{1,4000}/s); // Split in 4000 Zeichen Chunks

                chunks.forEach((chunk, index) => {
                    const embed = new EmbedBuilder()
                        .setTitle(`🔍 Server List (Page ${index + 1}/${chunks.length})`)
                        .setDescription(chunk)
                        .setColor('#00ff00')
                        .setFooter({ text: `Total Servers: ${guilds.size}` })
                        .setTimestamp();
                    embedPages.push(embed);
                });

                // Sende alle Embeds
                for (const embed of embedPages) {
                    await message.author.send({ embeds: [embed] });
                }

                // Bestätige im Channel
                await message.reply({
                    content: '✅ Server list has been sent to your DMs!',
                    ephemeral: true
                });

            } catch (error) {
                console.error('Show Servers Error:', error);
                await message.reply('❌ Error fetching server list!');
            }
        }

        // Status Command
        if (command === 'status') {
            try {
                const args = message.content.slice('-admin status'.length).trim().split('|').map(arg => arg.trim());
                
                if (args.length < 2) {
                    return message.reply('❌ Format: `-admin status <type> | <status>`\nTypes: PLAYING, WATCHING, LISTENING, COMPETING');
                }

                const type = args[0].toUpperCase();
                const status = args[1];

                // Prüfe ob der Type gültig ist
                const validTypes = ['PLAYING', 'WATCHING', 'LISTENING', 'COMPETING'];
                if (!validTypes.includes(type)) {
                    return message.reply('❌ Invalid type! Use: PLAYING, WATCHING, LISTENING, or COMPETING');
                }

                // Setze den Status
                message.client.user.setActivity(status, {
                    type: ActivityType[type]
                });

                // Erstelle Bestätigungs-Embed
                const embed = new EmbedBuilder()
                    .setTitle('🔄 Bot Status Updated')
                    .addFields(
                        { name: 'Type', value: type, inline: true },
                        { name: 'Status', value: status, inline: true }
                    )
                    .setColor('#00ff00')
                    .setTimestamp();

                await message.reply({ embeds: [embed] });

            } catch (error) {
                console.error('Status Command Error:', error);
                await message.reply('❌ Error updating status!');
            }
        }

        // Blocklist Commands
        if (command === 'block') {
            try {
                const args = message.content.slice('-admin block'.length).trim().split(/ +/);
                if (args.length < 2) {
                    return message.reply('❌ Format: `-admin block <user/guild> <ID>`');
                }

                const type = args[0].toLowerCase();
                const id = args[1];

                if (!['user', 'guild'].includes(type)) {
                    return message.reply('❌ Type must be either "user" or "guild"');
                }

                if (type === 'user') {
                    BLOCKED.users.add(id);
                    await saveBlocklists(); // Speichere Änderungen
                } else {
                    BLOCKED.guilds.add(id);
                    await saveBlocklists(); // Speichere Änderungen
                    // Wenn der Bot bereits auf dem Server ist, verlasse ihn
                    const guild = client.guilds.cache.get(id);
                    if (guild) {
                        await guild.leave();
                    }
                }

                const embed = new EmbedBuilder()
                    .setTitle('🚫 Block Added')
                    .setDescription(`Successfully blocked ${type}: ${id}`)
                    .setColor('#ff0000')
                    .setTimestamp();

                await message.reply({ embeds: [embed] });

            } catch (error) {
                console.error('Block Command Error:', error);
                await message.reply('❌ Error adding block!');
            }
        }

        if (command === 'unblock') {
            try {
                const args = message.content.slice('-admin unblock'.length).trim().split(/ +/);
                if (args.length < 2) {
                    return message.reply('❌ Format: `-admin unblock <user/guild> <ID>`');
                }

                const type = args[0].toLowerCase();
                const id = args[1];

                if (!['user', 'guild'].includes(type)) {
                    return message.reply('❌ Type must be either "user" or "guild"');
                }

                const removed = type === 'user' ? 
                    BLOCKED.users.delete(id) : 
                    BLOCKED.guilds.delete(id);

                const embed = new EmbedBuilder()
                    .setTitle(removed ? '✅ Block Removed' : '❌ Not Found')
                    .setDescription(removed ? 
                        `Successfully unblocked ${type}: ${id}` : 
                        `This ${type} was not blocked`)
                    .setColor(removed ? '#00ff00' : '#ff0000')
                    .setTimestamp();

                await message.reply({ embeds: [embed] });

                if (removed) {
                    await saveBlocklists(); // Speichere Änderungen nur wenn etwas entfernt wurde
                }

            } catch (error) {
                console.error('Unblock Command Error:', error);
                await message.reply('❌ Error removing block!');
            }
        }

        if (command === 'blocklist') {
            try {
                const embed = new EmbedBuilder()
                    .setTitle('📋 Block List')
                    .addFields(
                        {
                            name: '🚫 Blocked Users',
                            value: BLOCKED.users.size > 0 ? 
                                Array.from(BLOCKED.users).join('\n') : 
                                'No blocked users'
                        },
                        {
                            name: '🚫 Blocked Servers',
                            value: BLOCKED.guilds.size > 0 ? 
                                Array.from(BLOCKED.guilds).join('\n') : 
                                'No blocked servers'
                        }
                    )
                    .setColor('#ff0000')
                    .setTimestamp();

                await message.reply({ embeds: [embed] });

            } catch (error) {
                console.error('Blocklist Command Error:', error);
                await message.reply('❌ Error fetching blocklist!');
            }
        }
    });

    // Guild Create (Bot joined a server)
    client.on(Events.GuildCreate, async guild => {
        try {
            // Prüfe ob Server geblockt ist
            if (BLOCKED.guilds.has(guild.id)) {
                await guild.leave();
                return;
            }

            // Prüfe ob Server-Owner geblockt ist
            const owner = await guild.fetchOwner();
            if (BLOCKED.users.has(owner.id)) {
                await guild.leave();
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle('🎉 Joined New Server')
                .setDescription(`The bot has been added to a new server!`)
                .addFields(
                    { name: 'Server Name', value: guild.name, inline: true },
                    { name: 'Server ID', value: guild.id, inline: true },
                    { name: 'Member Count', value: guild.memberCount.toString(), inline: true },
                    { name: 'Owner', value: `${owner.user.tag} (${owner.user.id})`, inline: true },
                    { name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true }
                )
                .setColor('#00ff00')
                .setTimestamp();

            // Benachrichtige den Admin
            const admin = await client.users.fetch('1070058785084817420');
            await admin.send({ embeds: [embed] });

        } catch (error) {
            console.error('Guild Create Notification Error:', error);
        }
    });

    // Guild Delete (Bot left/was kicked from a server)
    client.on(Events.GuildDelete, async guild => {
        try {
            const embed = new EmbedBuilder()
                .setTitle('👋 Left Server')
                .setDescription(`The bot has been removed from a server!`)
                .addFields(
                    { name: 'Server Name', value: guild.name, inline: true },
                    { name: 'Server ID', value: guild.id, inline: true },
                    { name: 'Member Count', value: guild.memberCount.toString(), inline: true },
                    { name: 'Was In Server For', value: `<t:${Math.floor(guild.joinedTimestamp / 1000)}:R>`, inline: true }
                )
                .setColor('#ff0000')
                .setTimestamp();

            // Benachrichtige den Admin
            const admin = await client.users.fetch('1070058785084817420');
            await admin.send({ embeds: [embed] });

        } catch (error) {
            console.error('Guild Delete Notification Error:', error);
        }
    });
}

module.exports = { loadEvents }; 