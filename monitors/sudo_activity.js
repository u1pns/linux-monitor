/**
 * Monitor: Sudo Activity
 *
 * This monitor detects and reports commands executed with `sudo` privileges.
 *
 * Strategy:
 * It uses `journalctl` to find all log entries from the `sudo` command in the last 10 minutes.
 * It specifically filters for lines containing "COMMAND=" to identify executed commands.
 *
 * State Management:
 * The script stores the full log lines of the detected sudo commands in `laststatus/sudo_activity.status`.
 * An alert is sent only when new and previously unreported sudo command lines are found.
 * The state file is then updated with the list of all commands from the last 10 minutes.
 */
/**
 * Detects and reports commands executed with `sudo` privileges by scanning the
 * system journal for new `COMMAND=` entries.
 * It is stateful and will only report new sudo commands.
 */
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const alertsFile = path.join(__dirname, 'alerts.txt');
const stateFile = path.join(__dirname, 'laststatus', 'sudo_activity.status');

// Command to get sudo commands from the journal in the last 10 minutes.
const command = `journalctl _COMM=sudo --no-pager -o cat`;

exec(command, (error, stdout, stderr) => {
    if (error || !stdout.trim()) {
        return; // No sudo activity or an error.
    }

    const currentSudoLines = stdout.trim().split('\n').filter(line => line.includes('COMMAND='));

    if (currentSudoLines.length === 0) {
        return;
    }

    let lastSudoLines = [];
    if (fs.existsSync(stateFile)) {
        lastSudoLines = fs.readFileSync(stateFile, 'utf8').trim().split('\n');
    }

    const newSudoLines = currentSudoLines.filter(line => !lastSudoLines.includes(line));

    if (newSudoLines.length > 0) {
        const alertMessage = `## Security Alert: New Sudo Activity Detected\n\nThe following commands were recently executed with sudo privileges:\n\
${newSudoLines.join('\n')}
\

`;
        fs.appendFileSync(alertsFile, alertMessage);

        // Update the state file with all recent lines to prevent re-alerting.
        fs.writeFileSync(stateFile, currentSudoLines.join('\n'));
        console.log(1);
    } else {
        console.log(0);
    }
});

