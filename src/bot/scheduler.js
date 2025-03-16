const cron = require("node-cron");
const { exec } = require("child_process");
const supabase = require("../supabaseClient");
const { sock } = require("../bot/bot"); // Ensure this exports the bot instance

let job = null; // Holds the scheduled job

async function sendToAll(message) {
    const { data: groupData, error: groupError } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'group_id')
        .single();

    const { data: channelData, error: channelError } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'channel_id')
        .single();

    const groupId = groupData ? groupData.value : null;
    const channelId = channelData ? channelData.value : null;

    if (groupId) await sock.sendMessage(groupId, { text: message });
    if (channelId) await sock.sendMessage(channelId, { text: message });
}

function sendAutoUpdates() {
    exec("python football_bot.py", (error, stdout, stderr) => {
        if (error) {
            console.error("Error sending auto updates:", error);
            return;
        }
        console.log("Auto updates sent:", stdout);
    });
}

// Function to start scheduled updates
async function startScheduler(sock, chatId) {
    const { data: statusData, error: statusError } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'auto_updates')
        .single();

    const status = statusData ? statusData.value === "enabled" : true; // Default is enabled

    if (status && !job) {
        job = cron.schedule("0 6,18 * * *", () => {
            console.log("📢 Sending automatic football updates...");
            sendAutoUpdates();
        });
        console.log("✅ Auto-updates started!");
        await sock.sendMessage(chatId, { text: "✅ Auto-updates started!" });
    }
}

// Function to stop scheduled updates
async function stopScheduler(sock, chatId) {
    if (job) {
        job.stop();
        job = null;
        console.log("❌ Auto-updates stopped!");
        await sock.sendMessage(chatId, { text: "❌ Auto-updates stopped!" });
    }
}

module.exports = { startScheduler, stopScheduler, sendAutoUpdates };