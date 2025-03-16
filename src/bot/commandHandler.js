const { startScheduler, stopScheduler } = require("./scheduler");
const supabase = require("../supabaseClient");
const { formatResponseWithHeaderFooter } = require('../utils/utils');

async function handleCommand(sock, message) {
    const text = message.message?.conversation || "";
    const chatId = message.key.remoteJid;

    if (text === ".stopupdates") {
        await stopScheduler();
        const { error } = await supabase
            .from('settings')
            .upsert({ key: 'auto_updates', value: 'disabled' });

        if (error) {
            console.error('Error updating auto-update status:', error);
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter("❌ Error stopping auto-updates.") });
        } else {
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter("❌ Auto-updates have been stopped!") });
        }
    }

    if (text === ".startupdates") {
        await startScheduler();
        const { error } = await supabase
            .from('settings')
            .upsert({ key: 'auto_updates', value: 'enabled' });

        if (error) {
            console.error('Error updating auto-update status:', error);
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter("❌ Error starting auto-updates.") });
        } else {
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter("✅ Auto-updates are now active!") });
        }
    }

    // Add more command handling logic here...
}

module.exports = { handleCommand };