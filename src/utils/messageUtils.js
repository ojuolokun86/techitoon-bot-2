const formatResponseWithHeaderFooter = require('./utils').formatResponseWithHeaderFooter;
const commandEmojis = require('./commandEmojis');

const sendMessage = async (sock, chatId, message, mentions = []) => {
    try {
        // Ensure mentions is always an array
        if (!Array.isArray(mentions)) {
            mentions = [];
        }

        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(message), mentions });
        console.log(`✅ Message sent to ${chatId}: ${message}`);
    } catch (error) {
        console.error(`❌ Error sending message to ${chatId}:`, error);
    }
};

const sendReaction = async (sock, chatId, messageId, command) => {
    try {
        const emoji = commandEmojis[command] || '👍'; // Default to thumbs up if command not found
        await sock.sendMessage(chatId, {
            react: {
                text: emoji,
                key: { id: messageId, remoteJid: chatId }
            }
        });
        console.log(`✅ Reaction sent to message ${messageId} in ${chatId}: ${emoji}`);
    } catch (error) {
        console.error(`❌ Error sending reaction to message ${messageId} in ${chatId}:`, error);
    }
};

module.exports = { sendMessage, sendReaction };
