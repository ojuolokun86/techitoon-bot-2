require('dotenv').config();
const challonge = require('challonge');
const supabase = require('../supabaseClient');
const { formatResponseWithHeaderFooter } = require('../utils/utils');
const tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');

// Dynamic import for node-fetch
let fetch;
(async () => {
    fetch = (await import('node-fetch')).default;
})();

// Challonge API Setup
const challongeClient = challonge.createClient({
    apiKey: process.env.CHALLONGE_API_KEY
});

let tournament = {
    fixtures: [],
    registeredAdmins: [],
    chatLocked: false
};

// Function to unlock the chat after 1 hour
function unlockChatAfterFixtures(sock, chatId) {
    // Schedule unlock chat after 1 hour of dropping the fixtures
    setTimeout(async () => {
        if (tournament.chatLocked) {
            tournament.chatLocked = false;
            console.log("Chat is now unlocked.");
            await sock.groupSettingUpdate(chatId, 'not_announcement');
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('Chat is now unlocked!') });
        }
    }, 3600000); // 1 hour = 3600000 milliseconds
}

// Command to register admin in charge
const registerAdmin = async (sock, chatId, args, mentionedIds) => {
    const mentionedUser = mentionedIds[0];

    if (args.length === 2 && args[1] === 'admin' && mentionedUser) {
        const userId = mentionedUser.split('@')[0]; // Get the user ID (without @)
        
        if (!tournament.registeredAdmins.includes(userId)) {
            tournament.registeredAdmins.push(userId);
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(`User @${userId} has been registered as admin in charge!`), mentions: [mentionedUser] });
            console.log(`Registered ${userId} as admin.`);
        } else {
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(`User @${userId} is already an admin.`), mentions: [mentionedUser] });
        }
    } else {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('Invalid command format. Use .register @user admin') });
    }
};

// Command to drop fixtures (for testing)
const dropFixtures = async (sock, chatId) => {
    tournament.fixtures = [
        // Example fixtures (this would be dynamically generated in a real scenario)
        { match: 'Team1 vs Team2', time: 'March 10, 2025 8:00 PM' },
        { match: 'Team3 vs Team4', time: 'March 10, 2025 9:00 PM' }
    ];
    
    // Post the fixtures in the group
    for (const fixture of tournament.fixtures) {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(`Fixture: ${fixture.match} at ${fixture.time}`) });
    }

    // Lock the chat after posting fixtures
    tournament.chatLocked = true;
    await sock.groupSettingUpdate(chatId, 'announcement');
    console.log("Chat locked after dropping fixtures.");
    await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('Chat is now locked! It will reopen in 1 hour.') });

    // Unlock the chat after 1 hour
    unlockChatAfterFixtures(sock, chatId);
};

// Start Tournament & Auto-Create Group
const startTournament = async (sock, chatId, args) => {
    const [name, league, type] = args;
    if (!name || !league || !type) {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('Please provide the tournament name, league, and type.') });
        return;
    }

    // Check if the tournament already exists
    const { data: existingTournament } = await supabase
        .from('tournaments')
        .select('id')
        .eq('name', name)
        .maybeSingle();

    if (existingTournament) {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(`Tournament "${name}" already exists.`) });
        return;
    }

    // Save the tournament to the database
    const { error } = await supabase
        .from('tournaments')
        .insert([{ 
            name, 
            league, 
            type, 
            group_id: chatId, 
            admin: [chatId],  // Store as array
            teams: [],  // Initialize empty teams
            players: [],  // Initialize empty players
            status: 'ongoing'  // Set status to ongoing
        }]);

    if (error) {
        console.error('Error starting tournament:', error);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('Error starting tournament.') });
        return;
    }

    await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(`Tournament "${name}" in league "${league}" has started!`) });
};

// Add Team to Tournament
const addTeam = async (sock, chatId, args) => {
    const [tournamentName, teamName, logo] = args;
    if (!tournamentName || !teamName || !logo) {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('Please provide the tournament name, team name, and logo URL.') });
        return;
    }

    // Fetch the tournament
    const { data: tournament, error: fetchError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('name', tournamentName)
        .single();

    if (fetchError || !tournament) {
        console.error('Error fetching tournament:', fetchError);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('Tournament not found.') });
        return;
    }

    // Ensure teams array exists
    const updatedTeams = Array.isArray(tournament.teams) ? [...tournament.teams] : [];

    // Check if team already exists
    if (updatedTeams.some(team => team.name === teamName)) {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(`Team "${teamName}" is already in the tournament.`) });
        return;
    }

    updatedTeams.push({ name: teamName, logo });

    const { error } = await supabase
        .from('tournaments')
        .update({ teams: updatedTeams })
        .eq('id', tournament.id);

    if (error) {
        console.error('Error adding team:', error);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('Error adding team.') });
        return;
    }

    await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(`Team "${teamName}" has been added to tournament "${tournamentName}"!`) });
};

// Register User to Team
const registerUser = async (sock, chatId, args) => {
    const userId = args[0].replace('@', '') + '@s.whatsapp.net';
    const teamName = args.slice(1).join(' ');

    if (!teamName) {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('Please provide a team name.') });
        return;
    }

    // Fetch the tournament
    const { data: tournament, error: fetchError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('group_id', chatId)
        .eq('status', 'ongoing')
        .single();

    if (fetchError || !tournament) {
        console.error('Error fetching tournament:', fetchError);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('No active tournament found in this group.') });
        return;
    }

    // Ensure players array exists
    const updatedPlayers = Array.isArray(tournament.players) ? [...tournament.players] : [];

    // Ensure team exists before registering player
    if (!tournament.teams.some(team => team.name === teamName)) {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(`Team "${teamName}" does not exist in this tournament.`) });
        return;
    }

    updatedPlayers.push({ user_id: userId, team_name: teamName });

    const { error } = await supabase
        .from('tournaments')
        .update({ players: updatedPlayers })
        .eq('id', tournament.id);

    if (error) {
        console.error('Error registering user:', error);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('Error registering user.') });
        return;
    }

    await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(`User @${userId.split('@')[0]} has been registered to team "${teamName}"!`), mentions: [userId] });
};

// End Tournament
const endTournament = async (sock, chatId, args) => {
    const tournamentName = args.join(' ');
    if (!tournamentName) {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('Please provide the name of the tournament to end.') });
        return;
    }

    // Update the tournament status in the database and clear teams/players
    const { error } = await supabase
        .from('tournaments')
        .update({ status: 'ended', teams: [], players: [] })
        .eq('name', tournamentName);

    if (error) {
        console.error('Error ending tournament:', error);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('Error ending tournament.') });
        return;
    }

    await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(`Tournament "${tournamentName}" has ended!`) });
};

// Fetch Tournament Status
const tournamentStatus = async (sock, chatId) => {
    // Fetch the ongoing tournaments from the database
    const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .eq('status', 'ongoing');

    if (error) {
        console.error('Error fetching tournament status:', error);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('Error fetching tournament status.') });
        return;
    }

    if (data.length === 0) {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('No ongoing tournaments.') });
        return;
    }

    let statusMessage = '📊 *Ongoing Tournaments:* 📊\n\n';
    data.forEach((tournament, index) => {
        statusMessage += `${index + 1}. ${tournament.name}\n`;
    });

    await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(statusMessage) });
};

// Lock Chat on Deadline
const lockChat = async (sock, chatId) => {
    await sock.groupSettingUpdate(chatId, 'announcement');
    await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('Chat is now locked! It will reopen in 2 hours.') });

    setTimeout(async () => {
        await sock.groupSettingUpdate(chatId, 'not_announcement');
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('Chat is now open again!') });
    }, 2 * 60 * 60 * 1000);
};

// CHALLONGE API: Create Tournament
const createChallongeTournament = async (sock, chatId, args) => {
    const tournamentName = args.join(' ');
    if (!tournamentName) {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('Please provide the tournament name.') });
        return;
    }

    challongeClient.tournaments.create({
        tournament: {
            name: tournamentName,
            url: tournamentName.replace(/\s+/g, '-').toLowerCase(),
            tournament_type: 'single elimination'
        }
    }, async (err, data) => {
        if (err) {
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('Error creating tournament on Challonge.') });
        } else {
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(`Tournament "${tournamentName}" created on Challonge!`) });
        }
    });
};

// Recognize text from image using OCR (Tesseract.js)
const recognizeTextFromImage = async (imagePath) => {
    try {
        const { data: { text } } = await tesseract.recognize(imagePath, 'eng', {
            logger: (m) => console.log(m),
        });
        console.log('Recognized Text:', text);
        return text;
    } catch (err) {
        console.error('OCR failed:', err);
        return null;
    }
};

// Analyze the text to detect match results, fixtures, or complaints
const analyzeRecognizedText = (text) => {
    // Check if the text contains match results or fixtures
    if (text.includes("vs")) {
        // Assume the text contains match results or fixture info
        const fixtureMatch = parseMatchFixture(text);
        if (fixtureMatch) {
            console.log('Fixture/Match Found:', fixtureMatch);
            // Save the match to database or take necessary action
        }
    } else if (text.toLowerCase().includes("complaint")) {
        // Handle complaints
        console.log('Complaint Found:', text);
        // Save complaint or notify admins
    } else {
        console.log('Unable to recognize valid fixture/result/complaint in text');
    }
};

// Parse the match fixture from recognized text (this will be a simple example)
const parseMatchFixture = (text) => {
    const regex = /([A-Za-z0-9 ]+) vs ([A-Za-z0-9 ]+)/;
    const match = text.match(regex);
    
    if (match) {
        const team1 = match[1].trim();
        const team2 = match[2].trim();
        return {
            match: `${team1} vs ${team2}`,
            time: new Date().toLocaleString() // Example, you could parse time if available
        };
    }
    return null;
};

// Handle incoming media messages
const handleIncomingMedia = async (sock, message) => {
    const chatId = message.key.remoteJid;
    const messageType = Object.keys(message.message)[0];

    if (messageType === 'imageMessage') {
        const media = await sock.downloadMediaMessage(message);
        
        // Save the image to local storage
        const imagePath = path.join(__dirname, 'images', `${Date.now()}.jpg`);
        fs.writeFileSync(imagePath, media);

        // Recognize text from the image using OCR
        const recognizedText = await recognizeTextFromImage(imagePath);
        if (recognizedText) {
            analyzeRecognizedText(recognizedText);
        }
    }
};

// Export Functions
module.exports = {
    startTournament,
    addTeam,
    registerUser,
    endTournament,
    tournamentStatus,
    lockChat,
    createChallongeTournament,
    registerAdmin,
    dropFixtures,
    handleIncomingMedia
};
