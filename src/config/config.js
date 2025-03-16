const { backupNumber } = require('../loadEnv');

require('dotenv').config();

const config = {
    botOwnerId: process.env.ADMIN_NUMBER,
    adminNumber: process.env.ADMIN_NUMBER, // Ensure this is set in your .env file
    backupNumber: process.env.BACKUP_NUMBER, // Backup number for the bot
    apiKeys: {
        weatherApiKey: process.env.WEATHER_API_KEY,
        translationApiKey: process.env.TRANSLATION_API_KEY,
    },
    botSettings: {
        commandPrefix: process.env.PREFIX || '.',  // Ensure this is correctly set
        responseDelay: 1000, // Delay in milliseconds for bot responses //
        enabled: false, // Bot starts in disabled mode
        welcomeMessagesEnabled: false, // Welcome messages start off
        goodbyeMessagesEnabled: false, // Goodbye messages start off
        groupStatus: {}, // Track bot enabled status for each group
        groupWelcomeStatus: {}, // Track welcome message status for each group
        groupGoodbyeStatus: {} // Track goodbye message status for each group
    },
    warningThreshold: {
        default: 3, // Default warning threshold
        sales: 2,   // Warning threshold for sales content
        links: 3    // Warning threshold for links
    },
    database: {
        url: process.env.SUPABASE_URL,
        key: process.env.SUPABASE_KEY,
    },
    enabledGroups: [], // List of groups where the bot is enabled
    warnings: {}, // Track warnings for users
    savedLinks: [], // Store saved links
    groupRules: {}, // Store group rules
};

module.exports = config;