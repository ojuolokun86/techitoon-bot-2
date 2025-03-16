const supabase = require('../supabaseClient');

// This file contains utility functions that assist with various tasks, such as formatting messages, logging errors, and managing user statistics.

function formatMessage(message) {
    return message.trim().charAt(0).toUpperCase() + message.slice(1);
}

function logError(error) {
    console.error(`[ERROR] ${new Date().toISOString()}: ${error}`);
}

function isOwner(userId) {
    const ownerId = '2348026977793';
    return userId === ownerId;
}

function manageUserStats(userId, action) {
    // Placeholder for user statistics management logic
    // This could include incrementing message counts, tracking activity, etc.
}

const formatResponseWithHeaderFooter = (message) => {
    return `
🚀 𝙏𝙚𝙘𝙝𝙞𝙩𝙤𝙤𝙣 𝘽𝙤𝙩 🚀

${message}

━━━━━━━━━━━━━━━
  🤖 𝙏𝙚𝙘𝙝𝙞𝙩𝙤𝙤𝙣 𝘼𝙄
━━━━━━━━━━━━━━━
`;
};

const welcomeMessage = (groupName, user) => {
    return `🔥 Welcome to ${groupName}, @${user}! 🔥

🏆 This is where legends rise, champions battle, and history is made! ⚽💥 Get ready for intense competitions, thrilling matches, and unforgettable moments on the pitch.

🚀 Rules are simple: Respect, Play Fair & Enjoy the Game! 💪🎮

🔹 Tournaments? Leagues? Need Info? – DM the admin.
🔹 Stay active, stay competitive, and most importantly… HAVE FUN!

👑 Welcome to the ${groupName}! Now, let’s make history! 🔥⚽`;
};

const updateUserStats = async (userId, command) => {
    // Implement the logic to update user statistics for commands
};

const showGroupStats = async (sock, chatId) => {
    const groupMetadata = await sock.groupMetadata(chatId);
    const participants = groupMetadata.participants;

    // Example logic to determine the most active member
    const userStats = {}; // This should be populated with actual user stats
    let mostActiveMember = null;
    let maxMessages = 0;

    for (const participant of participants) {
        const userId = participant.id.split('@')[0];
        const messageCount = userStats[userId] || 0; // Replace with actual message count
        if (messageCount > maxMessages) {
            maxMessages = messageCount;
            mostActiveMember = userId;
        }
    }

    let statsText = `📊 *Group Statistics*:\n\n`;
    statsText += `👥 *Total Members:* ${participants.length}\n\n`;

    if (mostActiveMember) {
        statsText += `🏆 *Most Active Member:* @${mostActiveMember} with ${maxMessages} messages\n\n`;
    }

    for (const participant of participants) {
        const userId = participant.id.split('@')[0];
        statsText += `👤 @${userId}\n`;
        // Add more stats for each user if available
    }

    await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(statsText), mentions: participants.map(p => p.id) });
};

async function warnUser(sock, jid, user, reason) {
    const warningMessage = `⚠️ Warning: ${reason}, @${user.split("@")[0]}.`;

    // Send warning message
    await sock.sendMessage(jid, { text: warningMessage, mentions: [user] });

    console.log(`✅ Warned ${user} in ${jid}`);
}

async function isWelcomeMessageEnabled(chatId) {
    try {
        const { data, error } = await supabase
            .from('group_settings')
            .select('welcome_messages_enabled')
            .eq('group_id', chatId)
            .single();

        if (error) {
            console.error('Error fetching group settings:', error);
            return false;
        }

        return data.welcome_messages_enabled;
    } catch (error) {
        console.error('Error checking welcome message setting:', error);
        return false;
    }
}

module.exports = {
    formatMessage,
    logError,
    isOwner,
    manageUserStats,
    formatResponseWithHeaderFooter,
    welcomeMessage,
    updateUserStats,
    showGroupStats,
    warnUser,
    isWelcomeMessageEnabled,
};