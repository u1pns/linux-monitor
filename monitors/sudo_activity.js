/**
 * Monitor: Sudo Activity
 *
 * This monitor detects and reports commands executed with `sudo` privileges.
 *
 * Strategy:
 * It uses `journalctl` to find log entries from the `sudo` command since the last run.
 * It specifically filters for lines containing "COMMAND=" to identify executed commands.
 *
 * State Management:
 * - `sudo_activity.timestamp`: Stores the Unix timestamp of the last run to limit the
 *   journal query to only new entries, preventing a flood of alerts on the first run.
 * - `sudo_activity.status`: Stores the sudo command lines from the last run to deduplicate
 *   entries that may appear multiple times within the same time window.
 * An alert is sent only when new and previously unreported sudo command lines are found.
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
const timeStateFile = path.join(__dirname, 'laststatus', 'sudo_activity.timestamp');

// Determine the time window: use stored timestamp or default to 24 hours ago on first run.
let sinceArg = '--since "24 hours ago"';
if (fs.existsSync(timeStateFile)) {
    const lastRunTimestamp = fs.readFileSync(timeStateFile, 'utf8').trim();
    sinceArg = `--since @${lastRunTimestamp}`;
}

// Record the current time before the query so any commands during this run are caught next time.
const newTimestamp = Math.floor(Date.now() / 1000);

// Command to get sudo commands from the journal since the last run.
const command = `journalctl _COMM=sudo --no-pager -o cat ${sinceArg}`;

exec(command, (error, stdout, stderr) => {
    if (error) {
        // Do not update the timestamp on error so the next run retries this window.
        console.log(0);
        return; // Command error.
    }

    // Update the timestamp only after a successful query so the next run starts from here.
    fs.writeFileSync(timeStateFile, newTimestamp.toString());

    if (!stdout.trim()) {
        console.log(0);
        return; // No sudo activity.
    }

    const currentSudoLines = stdout.trim().split('\n').filter(line => line.includes('COMMAND='));

    if (currentSudoLines.length === 0) {
        console.log(0);
        return;
    }

    let lastSudoLines = [];
    if (fs.existsSync(stateFile)) {
        lastSudoLines = fs.readFileSync(stateFile, 'utf8').trim().split('\n');
    }

    const newSudoLines = currentSudoLines.filter(line => !lastSudoLines.includes(line));

    if (newSudoLines.length > 0) {
        const alertMessage = `## Security Alert: New Sudo Activity Detected\n\nThe following commands were recently executed with sudo privileges:\n${newSudoLines.join('\n')}\n\n`;
        fs.appendFileSync(alertsFile, alertMessage);

        // Update the state file with all recent lines to prevent re-alerting.
        fs.writeFileSync(stateFile, currentSudoLines.join('\n'));
        console.log(1);
    } else {
        console.log(0);
    }
});
