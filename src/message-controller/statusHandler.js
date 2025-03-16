const supabase = require('../supabaseClient');

const handleStatusUpdate = async (sock, statusUpdate) => {
    const { key, participant } = statusUpdate;
    const sender = participant || key.remoteJid;

    console.log(`Received status update from ${sender}`);

    try {
        // Mark the current status as viewed
        await sock.sendReceipt(sender, key, ['read']);
        console.log(`Status from ${sender} marked as viewed`);
    } catch (error) {
        console.error(`Error marking status from ${sender} as viewed:`, error);
    }
};

// Function to view all unseen statuses when bot starts
const viewUnseenStatuses = async (sock) => {
    try {
        const statuses = await sock.fetchStatus();
        if (!statuses || statuses.length === 0) {
            console.log("No unseen statuses found.");
            return;
        }

        for (const status of statuses) {
            const sender = status.sender;
            console.log(`Viewing unseen status from ${sender}`);

            await sock.sendReceipt(sender, status.key, ['read']);
            console.log(`Unseen status from ${sender} marked as viewed`);
        }

        console.log("All unseen statuses have been marked as viewed.");
    } catch (error) {
        console.error("Error fetching unseen statuses:", error);
    }
};

module.exports = { handleStatusUpdate, viewUnseenStatuses };