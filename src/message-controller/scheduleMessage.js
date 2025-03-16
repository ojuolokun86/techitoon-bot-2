const supabase = require('../supabaseClient');
const { formatResponseWithHeaderFooter } = require('../utils/utils');

async function scheduleMessage(sock, chatId, args) {
    try {
        console.log('Received args:', args); // Add logging to debug the args

        // Ensure args is an array of strings
        if (typeof args === 'string') {
            args = args.split(' ');
        }

        if (!Array.isArray(args) || args.length < 2) {
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Please provide a valid time and message. Example: .schedule 10:00 This is a scheduled message.') });
            return;
        }

        const time = args[0]; // Assuming the first argument is the time in HH:MM format
        const message = args.slice(1).join(' ');

        console.log('Parsed time:', time); // Add logging to debug the parsed time
        console.log('Parsed message:', message); // Add logging to debug the parsed message

        const { data, error } = await supabase
            .from('scheduled_messages')
            .insert([{ chat_id: chatId, message, time, recurring: true }]);

        if (error) {
            console.error('Error scheduling message:', error);
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Error scheduling message.') });
        } else {
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('✅ Message scheduled successfully.') });
        }
    } catch (error) {
        console.error('Error in scheduleMessage:', error);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Error scheduling message.') });
    }
}

const remind = async (sock, chatId, args) => {
    try {
        console.log('Received args:', args); // Add logging to debug the args

        // Ensure args is an array of strings
        if (typeof args === 'string') {
            args = args.split(' ');
        }

        if (!Array.isArray(args) || args.length < 2) {
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Please provide a valid time and message. Example: .remind 10:00 This is a reminder message.') });
            return;
        }

        const time = args[0]; // Assuming the first argument is the time in HH:MM format
        const message = args.slice(1).join(' ');

        console.log('Parsed time:', time); // Add logging to debug the parsed time
        console.log('Parsed message:', message); // Add logging to debug the parsed message

        const { data, error } = await supabase
            .from('scheduled_messages')
            .insert({ chat_id: chatId, message, time, recurring: true });

        if (error) {
            console.error('Error setting reminder:', error);
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Error setting reminder.') });
        } else {
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('✅ Reminder set successfully.') });
        }
    } catch (error) {
        console.error('Error in remind:', error);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Error setting reminder.') });
    }
};

const cancelSchedule = async (sock, chatId, args) => {
    try {
        console.log('Received args:', args); // Add logging to debug the args

        // Ensure args is an array of strings
        if (typeof args === 'string') {
            args = args.split(' ');
        }

        if (!Array.isArray(args) || args.length < 1) {
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Please provide a valid time to cancel. Example: .cancelSchedule 10:00') });
            return;
        }

        const time = args[0]; // Assuming the first argument is the time in HH:MM format

        console.log('Parsed time:', time); // Add logging to debug the parsed time

        const { error } = await supabase
            .from('scheduled_messages')
            .delete()
            .eq('chat_id', chatId)
            .eq('time', time);

        if (error) {
            console.error('Error canceling schedule:', error);
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Error canceling schedule.') });
        } else {
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('✅ Schedule canceled successfully.') });
        }
    } catch (error) {
        console.error('Error in cancelSchedule:', error);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Error canceling schedule.') });
    }
};

const cancelReminder = async (sock, chatId) => {
    try {
        const { error } = await supabase
            .from('scheduled_messages')
            .delete()
            .eq('chat_id', chatId);

        if (error) {
            console.error('Error canceling reminder:', error);
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Error canceling reminder.') });
        } else {
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('✅ Reminder canceled successfully.') });
        }
    } catch (error) {
        console.error('Error in cancelReminder:', error);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Error canceling reminder.') });
    }
};

// Example implementation of scheduleAnnouncement
async function scheduleAnnouncement(sock, chatId, message) {
    // Your scheduling logic here
    await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(`📅 Scheduled announcement: ${message}`) });
}

// Function to check and send scheduled messages
async function checkAndSendScheduledMessages(sock) {
    try {
        const now = new Date();
        const currentTime = `${now.getHours()}:${now.getMinutes()}`;

        const { data, error } = await supabase
            .from('scheduled_messages')
            .select('*')
            .eq('time', currentTime)
            .eq('recurring', true);

        if (error) {
            console.error('Error fetching scheduled messages:', error);
            return;
        }

        for (const message of data) {
            await sock.sendMessage(message.chat_id, { text: formatResponseWithHeaderFooter(message.message) });
        }
    } catch (error) {
        console.error('Error in checkAndSendScheduledMessages:', error);
    }
}

// Function to start the interval for checking and sending scheduled messages
function startScheduledMessageChecker(sock) {
    setInterval(() => {
        checkAndSendScheduledMessages(sock);
    }, 60000);
}

module.exports = { scheduleMessage, remind, cancelSchedule, cancelReminder, scheduleAnnouncement, startScheduledMessageChecker };