const config = require('../config/config');
const { formatResponseWithHeaderFooter, welcomeMessage } = require('../utils/utils');
const supabase = require('../supabaseClient');
const { startScheduler, stopScheduler } = require('../bot/scheduler');
const { startBot } = require('../bot/bot');

const scheduledMessages = [];
const announcementIntervals = {};

const isAdminOrOwner = async (sock, chatId, sender) => {
    const groupMetadata = await sock.groupMetadata(chatId);
    const participants = groupMetadata.participants;
    
    console.log("Participants:", participants); // Debugging log

    const isAdmin = participants.some(p => p.id === sender && (p.admin === 'admin' || p.admin === 'superadmin'));
    const isOwner = sender === config.botOwnerId;

    console.log(`Checking Admin Status - Sender: ${sender}, Is Admin: ${isAdmin}, Is Owner: ${isOwner}`);

    return isAdmin || isOwner;
};

const isBotAdmin = async (sock, chatId) => {
    const groupMetadata = await sock.groupMetadata(chatId);
    const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    const isAdmin = groupMetadata.participants.some(p => p.id === botNumber && (p.admin === 'admin' || p.admin === 'superadmin'));

    console.log(`Checking Bot Admin Status - Bot Number: ${botNumber}, Is Admin: ${isAdmin}`);

    return isAdmin;
};

const clearChat = async (sock, chatId, sender) => {
    if (!await isAdminOrOwner(sock, chatId, sender)) {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('❌ Only admins or the bot owner can use this command.') });
        return;
    }

    try {
        console.log("Attempting to clear chat...");
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter("🗑 Clearing entire chat (including media)...") });

        // Correct way to clear chat
        await sock.chatModify({ clear: true }, chatId);

        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter("✅ Chat has been cleared.") });
        console.log(`Cleared chat in: ${chatId}`);
    } catch (error) {
        console.error("Error clearing chat:", error);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter("⚠️ Could not clear the chat.") });
    }
};

const tagAll = async (sock, chatId, message, sender) => {
    if (!await isAdminOrOwner(sock, chatId, sender)) {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('❌ Only admins or the bot owner can use this command.') });
        return;
    }

    try {
        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata.participants.map(p => p.id);

        let text = `│👥 Group : ${groupMetadata.subject}\n`;
        text += `│👤 Hey😀 : @${sender.split('@')[0]}\n`;
        text += `│📜 Message : *${message}*\n`;
        text += `╰─────────────━┈⊷\n\n`;

        // Add mentions to the text (actual mentions, not just text)
        text += participants.map(id => `😟 @${id.split('@')[0]}`).join('\n');

        // Send message with actual mentions
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(text), mentions: participants });
    } catch (error) {
        console.error('Error tagging all participants:', error);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(`⚠️ Could not tag all participants: ${error.message}`) });
    }
};

const startAnnouncement = async (sock, chatId, message, sender) => {
    if (!await isAdminOrOwner(sock, chatId, sender)) {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('❌ Only admins or the bot owner can use this command.') });
        return;
    }

    try {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(`📢 Announcement:\n\n${message}`) });

        // Schedule the announcement to repeat every hour
        if (announcementIntervals[chatId]) {
            clearInterval(announcementIntervals[chatId]);
        }
        announcementIntervals[chatId] = setInterval(async () => {
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(`📢 Announcement:\n\n${message}`) });
        }, 3600000); // 1 hour in milliseconds
    } catch (error) {
        console.error('Error starting announcement:', error);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Could not start announcement mode.') });
    }
};

const stopAnnouncement = async (sock, chatId, sender) => {
    if (!await isAdminOrOwner(sock, chatId, sender)) {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('❌ Only admins or the bot owner can use this command.') });
        return;
    }

    try {
        // Clear the announcement interval
        if (announcementIntervals[chatId]) {
            clearInterval(announcementIntervals[chatId]);
            delete announcementIntervals[chatId];
        }

        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('🔊 Announcement mode has been stopped.') });
    } catch (error) {
        console.error('Error stopping announcement:', error);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Could not stop announcement mode.') });
    }
};

const muteChat = async (sock, chatId, sender) => {
    if (!await isAdminOrOwner(sock, chatId, sender)) {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('❌ Only admins or the bot owner can use this command.') });
        return;
    }

    try {
        await sock.groupSettingUpdate(chatId, 'announcement');
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('🔇 Group has been muted.') });
    } catch (error) {
        console.error('Error muting chat:', error);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Could not mute the group.') });
    }
};

const unmuteChat = async (sock, chatId, sender) => {
    if (!await isAdminOrOwner(sock, chatId, sender)) {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('❌ Only admins or the bot owner can use this command.') });
        return;
    }

    try {
        await sock.groupSettingUpdate(chatId, 'not_announcement');
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('🔊 Group has been unmuted.') });
    } catch (error) {
        console.error('Error unmuting chat:', error);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Could not unmute the group.') });
    }
};

const setGroupRules = async (sock, chatId, rules, sender) => {
    if (!await isAdminOrOwner(sock, chatId, sender)) {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('❌ Only admins or the bot owner can use this command.') });
        return;
    }

    const { data, error } = await supabase
        .from('group_settings')
        .upsert({ group_id: chatId, group_rules: rules }, { onConflict: 'group_id' });

    if (error) {
        console.error('Error setting group rules:', error);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Could not set group rules.') });
    } else {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(`📜 Group rules set: ${rules}`) });
    }
};

const setTournamentRules = async (sock, chatId, rules, sender) => {
    if (!await isAdminOrOwner(sock, chatId, sender)) {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('❌ Only admins or the bot owner can use this command.') });
        return;
    }

    const { data, error } = await supabase
        .from('group_settings')
        .upsert({ group_id: chatId, tournament_rules: rules }, { onConflict: 'group_id' });

    if (error) {
        console.error('Error setting tournament rules:', error);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Could not set tournament rules.') });
    } else {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(`📜 Tournament rules set: ${rules}`) });
    }
};

const setLanguage = async (sock, chatId, language, sender) => {
    if (!await isAdminOrOwner(sock, chatId, sender)) {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('❌ Only admins or the bot owner can use this command.') });
        return;
    }

    const { data, error } = await supabase
        .from('group_settings')
        .upsert({ group_id: chatId, language }, { onConflict: 'group_id' });

    if (error) {
        console.error('Error setting language:', error);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Could not set language.') });
    } else {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(`🌐 Language set to: ${language}`) });
    }
};

const banUser = async (sock, chatId, args, sender) => {
    if (!await isAdminOrOwner(sock, chatId, sender)) {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('❌ Only admins or the bot owner can use this command.') });
        return;
    }

    if (args.length > 0) {
        const userToBan = args[0].replace('@', '') + "@s.whatsapp.net";

        // Check if the bot is an admin
        const groupMetadata = await sock.groupMetadata(chatId);
        const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const isBotAdmin = groupMetadata.participants.some(p => p.id === botNumber && (p.admin === 'admin' || p.admin === 'superadmin'));

        if (!isBotAdmin) {
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('❌ The bot needs to be an admin to perform this action.') });
            return;
        }

        // Prevent banning the bot owner
        if (userToBan === config.botOwnerId) {
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('❌ You cannot ban the bot owner.') });
            return;
        }

        await sock.groupParticipantsUpdate(chatId, [userToBan], 'remove');
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(`🚫 User ${args[0]} has been banned.`) });
    } else {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('Usage: .ban @user') });
    }
};

const deleteMessage = async (sock, chatId, msg) => {
    if (!await isAdminOrOwner(sock, chatId, msg.key.participant || msg.key.remoteJid)) {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('❌ Only admins or the bot owner can use this command.') });
        return;
    }

    if (msg.message.extendedTextMessage && msg.message.extendedTextMessage.contextInfo) {
        const messageId = msg.message.extendedTextMessage.contextInfo.stanzaId;
        await sock.sendMessage(chatId, { delete: { id: messageId, remoteJid: chatId, fromMe: false } });
    }
};

const startWelcome = async (sock, chatId, sender) => {
    if (!await isAdminOrOwner(sock, chatId, sender)) {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('❌ Only admins or the bot owner can use this command.') });
        return;
    }

    const { data, error } = await supabase
        .from('group_settings')
        .upsert({ group_id: chatId, welcome_messages_enabled: true }, { onConflict: 'group_id' });

    if (error) {
        console.error('Error enabling welcome messages:', error);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Could not enable welcome messages.') });
    } else {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('✅ Welcome messages have been enabled for this group.') });
    }
};

const stopWelcome = async (sock, chatId, sender) => {
    if (!await isAdminOrOwner(sock, chatId, sender)) {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('❌ Only admins or the bot owner can use this command.') });
        return;
    }

    const { data, error } = await supabase
        .from('group_settings')
        .upsert({ group_id: chatId, welcome_messages_enabled: false }, { onConflict: 'group_id' });

    if (error) {
        console.error('Error disabling welcome messages:', error);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Could not disable welcome messages.') });
    } else {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('❌ Welcome messages have been disabled for this group.') });
    }
};

const startGoodbye = async (sock, chatId, sender) => {
    if (!await isAdminOrOwner(sock, chatId, sender)) {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('❌ Only admins or the bot owner can use this command.') });
        return;
    }

    const { data, error } = await supabase
        .from('group_settings')
        .upsert({ group_id: chatId, goodbye_messages_enabled: true }, { onConflict: 'group_id' });

    if (error) {
        console.error('Error enabling goodbye messages:', error);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Could not enable goodbye messages.') });
    } else {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('✅ Goodbye messages have been enabled for this group.') });
    }
};

const stopGoodbye = async (sock, chatId, sender) => {
    if (!await isAdminOrOwner(sock, chatId, sender)) {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('❌ Only admins or the bot owner can use this command.') });
        return;
    }

    const { data, error } = await supabase
        .from('group_settings')
        .upsert({ group_id: chatId, goodbye_messages_enabled: false }, { onConflict: 'group_id' });

    if (error) {
        console.error('Error disabling goodbye messages:', error);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Could not disable goodbye messages.') });
    } else {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('❌ Goodbye messages have been disabled for this group.') });
    }
};

const enableBot = async (sock, chatId, sender) => {
    if (sender !== config.botOwnerId) {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('❌ Only the bot owner can enable the bot.') });
        console.log(`Unauthorized attempt to enable bot by ${sender}`);
        return;
    }

    try {
        const { data, error } = await supabase
            .from('group_settings')
            .upsert({ group_id: chatId, bot_enabled: true }, { onConflict: ['group_id'] });

        if (error) {
            console.error('Error enabling bot:', error);
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('❌ Error enabling the bot.') });
            return;
        }

        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('✅ Bot has been enabled in this group.') });
        console.log(`✅ Bot enabled in group: ${chatId} by ${sender}`);
    } catch (error) {
        console.error('Error enabling bot:', error);
    }
};

const disableBot = async (sock, chatId, sender) => {
    if (sender !== config.botOwnerId) {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('❌ Only the bot owner can disable the bot.') });
        console.log(`Unauthorized attempt to disable bot by ${sender}`);
        return;
    }

    try {
        const { data, error } = await supabase
            .from('group_settings')
            .upsert({ group_id: chatId, bot_enabled: false }, { onConflict: ['group_id'] });

        if (error) {
            console.error('Error disabling bot:', error);
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('❌ Error disabling the bot.') });
            return;
        }

        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('🚫 Bot has been disabled in this group.') });
        console.log(`🚫 Bot disabled in group: ${chatId} by ${sender}`);
    } catch (error) {
        console.error('Error disabling bot:', error);
    }
};

const promoteUser = async (sock, chatId, userId, sender) => {
    if (!await isAdminOrOwner(sock, chatId, sender)) {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('❌ Only admins or the bot owner can use this command.') });
        return;
    }

    if (!await isBotAdmin(sock, chatId)) {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('❌ The bot needs to be an admin to perform this action.') });
        return;
    }

    try {
        await sock.groupParticipantsUpdate(chatId, [userId], 'promote');
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(`✅ User @${userId.split('@')[0]} has been promoted.`) });
    } catch (error) {
        console.error('Error promoting user:', error);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('❌ Error promoting user.') });
    }
};

const demoteUser = async (sock, chatId, userId, sender) => {
    if (!await isAdminOrOwner(sock, chatId, sender)) {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('❌ Only admins or the bot owner can use this command.') });
        return;
    }

    if (!await isBotAdmin(sock, chatId)) {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('❌ The bot needs to be an admin to perform this action.') });
        return;
    }

    try {
        await sock.groupParticipantsUpdate(chatId, [userId], 'demote');
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(`❌ User @${userId.split('@')[0]} has been demoted.`) });
    } catch (error) {
        console.error('Error demoting user:', error);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('❌ Error demoting user.') });
    }
};

module.exports = {
    clearChat,
    tagAll,
    startAnnouncement,
    stopAnnouncement,
    muteChat,
    unmuteChat,
    setGroupRules,
    setTournamentRules,
    setLanguage,
    banUser,
    deleteMessage,
    startWelcome,
    stopWelcome,
    startGoodbye,
    stopGoodbye,
    enableBot,
    disableBot,
    promoteUser,
    demoteUser
};