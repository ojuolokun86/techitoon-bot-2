const { sendMessage, sendReaction } = require('../utils/messageUtils');
const supabase = require('../supabaseClient');
const { issueWarning, resetWarnings, listWarnings, getRemainingWarnings } = require('../message-controller/warning');
const config = require('../config/config');
const { updateUserStats } = require('../utils/utils');
const commonCommands = require('../message-controller/commonCommands');
const adminCommands = require('../message-controller/adminActions');
const botCommands = require('../message-controller/botCommands');
const scheduleCommands = require('../message-controller/scheduleMessage');
const pollCommands = require('../message-controller/polls');
const tournamentCommands = require('../message-controller/tournament');
const { exec } = require("child_process");
const { removedMessages, leftMessages } = require('../utils/goodbyeMessages');
const { formatResponseWithHeaderFooter, welcomeMessage } = require('../utils/utils');
const { startBot } = require('../bot/bot');

const salesKeywords = [
    'sell', 'sale', 'selling', 'buy', 'buying', 'trade', 'trading', 'swap', 'swapping', 'exchange', 'price',
    'available for sale', 'dm for price', 'account for sale', 'selling my account', 'who wants to buy', 'how much?',
    '$', '₦', 'paypal', 'btc'
];

const linkRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|wa\.me\/[^\s]+|chat\.whatsapp\.com\/[^\s]+|t\.me\/[^\s]+|bit\.ly\/[^\s]+|[\w-]+\.(com|net|org|info|biz|xyz|live|tv|me|link)(\/\S*)?)/gi;

const handleProtectionMessages = async (sock, message) => {
    const chatId = message.key.remoteJid;
    const sender = message.key.participant || message.key.remoteJid;

    // Fetch group/channel settings from Supabase
    let groupSettings = null;
    if (chatId.endsWith('@g.us') || chatId.endsWith('@broadcast')) {
        const { data, error } = await supabase
            .from('group_settings')
            .select('bot_enabled')
            .eq('group_id', chatId)
            .single();
        groupSettings = data;
        if (error && error.code !== 'PGRST116') {
            console.error('Error fetching group settings:', error);
        }
    }

    // Check if the bot is enabled in the group/channel
    if ((chatId.endsWith('@g.us') || chatId.endsWith('@broadcast')) && (!groupSettings || !groupSettings.bot_enabled)) {
        console.log('🛑 Bot is disabled in this group/channel. Skipping protection actions.');
        return;
    }

    try {
        const msgText = message.message?.conversation || message.message?.extendedTextMessage?.text || 
                        message.message?.imageMessage?.caption || message.message?.videoMessage?.caption || '';

        console.log(`Checking message for protection: ${msgText} from ${sender} in ${chatId}`);

        // Get group metadata to check admin status with retry mechanism
        let groupMetadata;
        const maxRetries = 3;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                groupMetadata = await sock.groupMetadata(chatId);
                break; // Break if successful
            } catch (error) {
                if (attempt === maxRetries) {
                    console.error('Error fetching group metadata after multiple attempts:', error);
                    // Log the error instead of sending it to the chat
                    return;
                }
                console.log(`Retrying to fetch group metadata (Attempt ${attempt}/${maxRetries})...`);
            }
        }

        const isAdmin = groupMetadata.participants.some(p => p.id === sender && (p.admin === 'admin' || p.admin === 'superadmin'));

        if (isAdmin) {
            console.log(`Skipping protection check for admin: ${sender}`);
            return;
        }

        // **Sales Content Detection**
        const containsSalesKeywords = salesKeywords.some(keyword => msgText.toLowerCase().includes(keyword));
        if (containsSalesKeywords && (message.message?.imageMessage || message.message?.videoMessage)) {
            await sock.sendMessage(chatId, { delete: message.key });
            console.log(`⚠️ Media message from ${sender} deleted in group: ${chatId} (sales content detected)`);

            // **Send warning request to warning.js**
            const remainingWarnings = await getRemainingWarnings(chatId, sender, 'sales');
            if (remainingWarnings <= 0) {
                await sock.groupParticipantsUpdate(chatId, [sender], 'remove');
                console.log(`🚫 User ${sender} kicked from group: ${chatId} after reaching sales warning threshold.`);
            } else {
                await issueWarning(sock, chatId, sender, "Posting sales content", config.warningThreshold.sales);
            }
            return;
        }

        // **Link Detection**
        if (linkRegex.test(msgText)) {
            await sock.sendMessage(chatId, { delete: message.key });
            console.log(`⚠️ Message from ${sender} deleted in group: ${chatId} (link detected)`);

            // **Send warning request to warning.js**
            const remainingWarnings = await getRemainingWarnings(chatId, sender, 'links');
            if (remainingWarnings <= 0) {
                await sock.groupParticipantsUpdate(chatId, [sender], 'remove');
                console.log(`🚫 User ${sender} kicked from group: ${chatId} after reaching link warning threshold.`);
            } else {
                await issueWarning(sock, chatId, sender, "Posting links", config.warningThreshold.links);
            }
            return;
        }
    } catch (error) {
        console.error('Error handling protection messages:', error);
    }
};

let antiDeleteGroups = new Set(); // Store groups with anti-delete enabled

const enableAntiDelete = async (chatId) => {
    const { error } = await supabase.from('anti_delete_groups').insert([{ chat_id: chatId }]);
    if (error) {
        console.error("Failed to enable anti-delete:", error);
    } else {
        antiDeleteGroups.add(chatId);
    }
};

const disableAntiDelete = async (chatId) => {
    const { error } = await supabase.from('anti_delete_groups').delete().eq('chat_id', chatId);
    if (error) {
        console.error("Failed to disable anti-delete:", error);
    } else {
        antiDeleteGroups.delete(chatId);
    }
};

const saveMessageToDatabase = async (chatId, messageId, sender, messageContent) => {
    console.log(`Saving message to database: chatId=${chatId}, messageId=${messageId}, sender=${sender}, messageContent=${messageContent}`);
    const { error } = await supabase
        .from('anti_delete_messages')
        .insert([
            { 
                chat_id: chatId, 
                message_id: messageId, 
                sender: sender, 
                message_content: messageContent, 
                timestamp: new Date().toISOString() // Add timestamp
            }
        ]);

    if (error) {
        console.error('Error saving message to database:', error);
    } else {
        console.log('Message saved successfully');
    }
};

const handleAntiDelete = async (sock, message, botNumber) => {
    const chatId = message.key.remoteJid;
    const sender = message.key.participant || message.key.remoteJid;

    if (message.messageStubType === 'message_revoke_for_everyone' && sender !== botNumber) {
        console.log("Deleted message data:", message);
        const deletedMessageKey = message.messageProtocolContextInfo?.stanzaId || message.key.id;

        console.log(`🛑 Message deleted in ${chatId} by ${sender}`);

        // Fetch deleted message from database
        const { data, error } = await supabase
            .from('anti_delete_messages')
            .select('*')
            .eq('chat_id', chatId)
            .eq('message_id', deletedMessageKey)
            .single();

        if (error) {
            console.error("Error fetching deleted message:", error);
        }
        if (!data) {
            console.log("⚠️ No deleted message found for ID:", deletedMessageKey);
            return;
        }

        console.log(`✅ Restoring message from database:`, data);

        await sock.sendMessage(chatId, {
            text: `🔄 *Restored Message from @${sender.split('@')[0]}:*\n${data.message_content}`,
            mentions: [sender]
        });
    }
};

// Store messages before deletion
function initializeMessageCache(sock) {
    sock.ev.on("messages.upsert", async ({ messages }) => {
        for (const msg of messages) {
            const chatId = msg.key.remoteJid;
            const sender = msg.key.participant || chatId;
            const messageId = msg.key.id;

            if (!msg.message) return;  // Ignore empty messages

            const messageText = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
            if (!messageText) return; // Ignore unsupported message types

            // Check if the message is a deleted message
            if (messageText.toLowerCase().includes("this message was deleted")) {
                console.log("Ignoring deleted message");
                return; // Skip processing
            }

            console.log(`Processing message: chatId=${chatId}, messageId=${messageId}, sender=${sender}, messageText=${messageText}`);

            // Check if anti-delete is enabled in the group or if it's a private chat
            const { data, error } = await supabase
                .from('anti_delete_groups')
                .select('chat_id')
                .eq('chat_id', chatId)
                .single();

            if (error) {
                console.error('Error checking anti-delete status:', error);
                return;
            }

            // Store messages if (1) it's a private chat or (2) anti-delete is enabled in the group
            if (!chatId.includes("@g.us") || data) {
                await saveMessageToDatabase(chatId, messageId, sender, messageText);
            }
        }
    });

    // Listen for message deletions
    sock.ev.on("messages.update", async (update) => {
        for (const msg of update) {
            if (msg.messageStubType === "message_revoke_for_everyone") {
                await handleAntiDelete(sock, msg, sock.user.id);
            }
        }
    });
}

// Auto-delete old messages from the database
const deleteOldMessages = async () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const { error } = await supabase
        .from('anti_delete_messages')
        .delete()
        .lt('timestamp', threeDaysAgo.toISOString());

    if (error) console.error("Failed to delete old messages:", error);
};

// Run every hour
setInterval(deleteOldMessages, 60 * 60 * 1000);

module.exports = { handleProtectionMessages, handleAntiDelete, initializeMessageCache, enableAntiDelete, disableAntiDelete };
