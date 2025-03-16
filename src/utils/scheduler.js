const cron = require('node-cron');
const supabase = require('../supabaseClient');
const { formatResponseWithHeaderFooter } = require('./utils');
const { sendMessage } = require('./messageUtils');

const resetOldWarnings = async (sock) => {
    try {
        // Calculate the date 7 days ago
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // Fetch warnings older than 7 days
        const { data: oldWarnings, error } = await supabase
            .from('warnings')
            .select('*')
            .lt('created_at', sevenDaysAgo.toISOString());

        if (error) {
            console.error('Error fetching old warnings:', error);
            return;
        }

        if (!oldWarnings || oldWarnings.length === 0) {
            console.log('No old warnings to reset.');
            return;
        }

        // Delete old warnings
        const { error: deleteError } = await supabase
            .from('warnings')
            .delete()
            .lt('created_at', sevenDaysAgo.toISOString());

        if (deleteError) {
            console.error('Error deleting old warnings:', deleteError);
            return;
        }

        // Notify users about the reset warnings
        for (const warning of oldWarnings) {
            const resetMessage = `✅ @${warning.user_id.split('@')[0]}'s warnings have been automatically reset after 7 days.`;
            await sendMessage(sock, warning.group_id, resetMessage, [warning.user_id]);
            console.log(`✅ Warnings for user ${warning.user_id} reset in group: ${warning.group_id}`);
        }
    } catch (error) {
        console.error('Error resetting old warnings:', error);
    }
};

// Schedule the job to run every day at midnight
cron.schedule('0 0 * * *', () => {
    console.log('Running scheduled job to reset old warnings...');
    resetOldWarnings();
});

module.exports = { resetOldWarnings };