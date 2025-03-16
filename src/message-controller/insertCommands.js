const supabase = require('../supabaseClient'); // Adjust the path if necessary

const commands = [
    { command: 'ping', response: '🏓 Pong! Bot is active.', access_level: 'all', function_name: '' },
    { command: 'menu', response: 'Here is the menu.', access_level: 'all', function_name: 'sendHelpMenu' },
    { command: 'joke', response: 'Here is a joke.', access_level: 'all', function_name: 'sendJoke' },
    { command: 'quote', response: 'Here is a quote.', access_level: 'all', function_name: 'sendQuote' },
    { command: 'weather', response: 'Here is the weather.', access_level: 'all', function_name: 'handleWeatherCommand' },
    { command: 'translate', response: 'Here is the translation.', access_level: 'all', function_name: 'handleTranslateCommand' },
    { command: 'admin', response: 'Here are the admins.', access_level: 'all', function_name: 'listAdmins' },
    { command: 'info', response: 'Here is the group info.', access_level: 'all', function_name: 'sendGroupInfo' },
    { command: 'rules', response: 'Here are the group rules.', access_level: 'all', function_name: 'sendGroupRules' },
    { command: 'clear', response: 'Chat cleared.', access_level: 'admin', function_name: 'clearChat' },
    { command: 'ban', response: 'User banned.', access_level: 'admin', function_name: 'banUser' },
    { command: 'tagall', response: 'Tagging all members.', access_level: 'admin', function_name: 'tagAll' },
    { command: 'mute', response: 'Group muted.', access_level: 'admin', function_name: 'muteChat' },
    { command: 'unmute', response: 'Group unmuted.', access_level: 'admin', function_name: 'unmuteChat' },
    { command: 'announce', response: 'Announcement started.', access_level: 'admin', function_name: 'startAnnouncement' },
    { command: 'stopannounce', response: 'Announcement stopped.', access_level: 'admin', function_name: 'stopAnnouncement' },
    { command: 'schedule', response: 'Message scheduled.', access_level: 'admin', function_name: 'scheduleMessage' },
    { command: 'remind', response: 'Reminder set.', access_level: 'admin', function_name: 'remind' },
    { command: 'cancelschedule', response: 'Schedule canceled.', access_level: 'admin', function_name: 'cancelSchedule' },
    { command: 'cancelreminder', response: 'Reminder canceled.', access_level: 'admin', function_name: 'cancelReminder' },
    { command: 'poll', response: 'Poll created.', access_level: 'all', function_name: 'createPoll' },
    { command: 'vote', response: 'Vote recorded.', access_level: 'all', function_name: 'vote' },
    { command: 'endpoll', response: 'Poll ended.', access_level: 'all', function_name: 'endPoll' },
    { command: 'starttournament', response: 'Tournament started.', access_level: 'admin', function_name: 'startTournament' },
    { command: 'endtournament', response: 'Tournament ended.', access_level: 'admin', function_name: 'endTournament' },
    { command: 'tournamentstatus', response: 'Tournament status.', access_level: 'all', function_name: 'tournamentStatus' },
    { command: 'setgrouprules', response: 'Group rules set.', access_level: 'admin', function_name: 'setGroupRules' },
    { command: 'settournamentrules', response: 'Tournament rules set.', access_level: 'admin', function_name: 'setTournamentRules' },
    { command: 'setlanguage', response: 'Language set.', access_level: 'admin', function_name: 'setLanguage' },
    { command: 'showstats', response: 'Showing stats.', access_level: 'all', function_name: 'showAllGroupStats' },
    { command: 'delete', response: 'Message deleted.', access_level: 'admin', function_name: 'deleteMessage' },
    { command: 'enable', response: 'Bot enabled.', access_level: 'all', function_name: 'enableBot' },
    { command: 'disable', response: 'Bot disabled.', access_level: 'all', function_name: 'disableBot' },
    { command: 'startwelcome', response: 'Welcome messages started.', access_level: 'admin', function_name: 'startWelcome' },
    { command: 'stopwelcome', response: 'Welcome messages stopped.', access_level: 'admin', function_name: 'stopWelcome' },
    { command: 'promote', response: 'User promoted.', access_level: 'admin', function_name: 'promoteUser' },
    { command: 'demote', response: 'User demoted.', access_level: 'admin', function_name: 'demoteUser' },
    { command: 'warn', response: 'User warned.', access_level: 'admin', function_name: 'warnUser' },
    { command: 'listwarn', response: 'Listing warnings.', access_level: 'admin', function_name: 'listWarnings' },
    { command: 'resetwarn', response: 'Warnings reset.', access_level: 'admin', function_name: 'resetWarnings' },
    { command: 'addcommand', response: 'Command added.', access_level: 'admin', function_name: 'addCommand' },
    { command: 'deletecommand', response: 'Command deleted.', access_level: 'admin', function_name: 'deleteCommand' },
    { command: 'savelink', response: 'Link saved.', access_level: 'admin', function_name: 'saveLink' },
    { command: 'sharelink', response: 'Link shared.', access_level: 'all', function_name: 'handleShareLinkCommand' },
    { command: 'deletelink', response: 'Link deleted.', access_level: 'admin', function_name: 'deleteLink' },
    { command: 'listlinks', response: 'Listing links.', access_level: 'admin', function_name: 'listLinks' },
    { command: 'stoplink', response: 'Stopped reposting the link.', access_level: 'admin', function_name: 'handleStopLinkCommand' },
    { command: 'registeruser', response: 'User registered to team.', access_level: 'admin', function_name: 'registerUser' },
    { command: 'lockchat', response: 'Chat locked.', access_level: 'admin', function_name: 'lockChat' },
    { command: 'createchallongetournament', response: 'Challonge tournament created.', access_level: 'admin', function_name: 'createChallongeTournament' }
];

const insertCommands = async () => {
    for (const command of commands) {
        console.log('Inserting command:', command); // Log the command data

        const { data, error } = await supabase
            .from('commands')
            .upsert([{
                command_name: command.command,
                response: command.response,
                access_level: command.access_level,
                function_name: command.function_name
            }], { onConflict: ['command_name'] });

        if (error) {
            console.error('Insert error:', error);
        } else {
            console.log('Inserted successfully:', data);
        }
    }
};

insertCommands();