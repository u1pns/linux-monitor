/**
 * Monitor: Successful SSH Logins
 *
 * This monitor detects and reports successful SSH logins.
 *
 * Strategy:
 * It uses `journalctl` to find log entries for "Accepted publickey" or "Accepted password"
 * for the `sshd` service since the last run.
 *
 * State Management:
 * - `successful_logins.timestamp`: Stores the Unix timestamp of the last run to limit the
 *   journal query to only new entries, preventing a flood of alerts on the first run.
 * - `successful_logins.status`: Stores the login lines from the last run to deduplicate
 *   entries that may appear multiple times within the same time window.
 * An alert is sent only when new and previously unreported login lines are found.
 */
/**
 * Detects and reports new successful SSH logins by scanning the system journal.
 * It is stateful and will only report logins that have not been seen before.
 */
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const alertsFile = path.join(__dirname, 'alerts.txt');
const stateFile = path.join(__dirname, 'laststatus', 'successful_logins.status');
const timeStateFile = path.join(__dirname, 'laststatus', 'successful_logins.timestamp');

// Determine the time window: use stored timestamp or default to 24 hours ago on first run.
let sinceArg = '--since "24 hours ago"';
if (fs.existsSync(timeStateFile)) {
    const lastRunTimestamp = fs.readFileSync(timeStateFile, 'utf8').trim();
    sinceArg = `--since @${lastRunTimestamp}`;
}

// Record the current time before the query so any logins during this run are caught next time.
const newTimestamp = Math.floor(Date.now() / 1000);

const command = `journalctl -u ssh.service --no-pager ${sinceArg} | grep -E 'Accepted (publickey|password)'`;

exec(command, (error, stdout, stderr) => {
    // Grep exit code 1 means no matches, which is not an error in this case.
    if (error && error.code > 1) {
        // Do not update the timestamp on a real error so the next run retries this window.
        console.log(0);
        return;
    }

    // Update the timestamp only after a successful query so the next run starts from here.
    fs.writeFileSync(timeStateFile, newTimestamp.toString());

    const currentLoginLines = stdout.trim().split('\n').filter(line => line);

    if (currentLoginLines.length === 0) {
        // No recent successful logins, clear the state file if it exists.
        if (fs.existsSync(stateFile)) {
            fs.unlinkSync(stateFile);
        }
        console.log(0);
        return;
    }

    let lastLoginLines = [];
    if (fs.existsSync(stateFile)) {
        lastLoginLines = fs.readFileSync(stateFile, 'utf8').trim().split('\n').filter(line => line);
    }

    const newLoginLines = currentLoginLines.filter(line => !lastLoginLines.includes(line));

    if (newLoginLines.length > 0) {
        const alertMessage = `## Security Alert: Successful SSH Login(s) Detected\n\nThe following successful logins were detected on the system:\n${newLoginLines.join('\n')}\n\n`;
        fs.appendFileSync(alertsFile, alertMessage);

        // Update the state file with all recent lines to prevent re-alerting.
        fs.writeFileSync(stateFile, currentLoginLines.join('\n'));
    }

    console.log(newLoginLines.length);
});
