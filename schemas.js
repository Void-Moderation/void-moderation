const mongoose = require('mongoose');

const warnSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    moderatorId: { type: String, required: true },
    reason: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    level: { type: Number, default: 1 }
});

const guildSettingsSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    logChannelId: { type: String, default: null },
    welcomeChannelId: { type: String, default: null },
    welcomeMessage: { type: String, default: null },
    welcomeImageUrl: { type: String, default: null },
    autoRoles: [{ type: String }],
    modLogEnabled: { type: Boolean, default: true },
    verifyChannelId: { type: String, default: null },
    verifyRoleId: { type: String, default: null },
    verifyMode: { type: String, enum: ['reaction', 'captcha'], default: 'reaction' },
    automod: {
        enabled: { type: Boolean, default: true },
        bannedWords: [{ type: String }],
        spamThreshold: { type: Number, default: 5 },
        capsThreshold: { type: Number, default: 70 },
        punishmentType: { type: String, enum: ['warn', 'mute', 'kick'], default: 'warn' },
        muteDuration: { type: String, default: '10m' }
    },
    antiraid: {
        enabled: { type: Boolean, default: false },
        joinThreshold: { type: Number, default: 5 },
        timeWindow: { type: Number, default: 10 },
        action: { type: String, enum: ['kick', 'ban', 'verify'], default: 'verify' },
        logEnabled: { type: Boolean, default: true }
    },
    tickets: {
        enabled: { type: Boolean, default: false },
        categoryId: { type: String, default: null },
        supportRoleId: { type: String, default: null },
        maxTickets: { type: Number, default: 1 },
        buttonMessage: { type: String, default: null },
        counter: { type: Number, default: 0 }
    },
    warnSystem: {
        enabled: { type: Boolean, default: true },
        actions: [{
            warnings: { type: Number, required: true },
            action: { type: String, enum: ['mute', 'kick', 'ban'], required: true },
            duration: { type: String }
        }],
        autoDecay: { type: Boolean, default: true },
        decayDays: { type: Number, default: 30 }
    },
    muteSystem: {
        enabled: { type: Boolean, default: true },
        timeoutRoleId: { type: String, default: null },
        useTimeout: { type: Boolean, default: true },
        defaultDuration: { type: String, default: '1h' }
    },
    raidMode: {
        enabled: { type: Boolean, default: false },
        activatedAt: { type: Date },
        activatedBy: { type: String },
        settings: {
            verificationLevel: { type: String },
            autoModEnabled: { type: Boolean },
            joinThreshold: { type: Number },
            accountAgeDays: { type: Number, default: 7 },
            kickUnverified: { type: Boolean, default: true }
        },
        originalSettings: {
            verificationLevel: { type: String },
            autoModEnabled: { type: Boolean },
            joinThreshold: { type: Number }
        }
    }
});

const ticketSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    channelId: { type: String, required: true },
    userId: { type: String, required: true },
    ticketNumber: { type: Number, required: true },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    createdAt: { type: Date, default: Date.now },
    closedAt: { type: Date },
    closedBy: { type: String }
});

const muteSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    moderatorId: { type: String, required: true },
    reason: { type: String, required: true },
    duration: { type: Number, required: true },
    endTime: { type: Date, required: true },
    active: { type: Boolean, default: true }
});

const Warn = mongoose.model('Warn', warnSchema);
const GuildSettings = mongoose.model('GuildSettings', guildSettingsSchema);
const Ticket = mongoose.model('Ticket', ticketSchema);
const Mute = mongoose.model('Mute', muteSchema);

module.exports = { Warn, GuildSettings, Ticket, Mute }; 