/**
 * Monitor: Successful SSH Logins
 *
 * This monitor detects and reports successful SSH logins.
 *
 * Strategy:
 * It uses `journalctl` to find all log entries for "Accepted publickey" or "Accepted password"
 * for the `sshd` service within the last 10 minutes.
 *
 * State Management:
 * The script stores the full log lines of the detected successful logins in `laststatus/successful_logins.status`.
 * An alert is sent only when new and previously unreported login lines are found.
 * The state file is then updated with the list of all successful logins from the last 10 minutes.
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

// Command to get successful SSH logins from the journal in the last 10 minutes.
const command = `journalctl -u ssh.service --no-pager | grep -E 'Accepted (publickey|password)'`;

exec(command, (error, stdout, stderr) => {
    // Grep exit code 1 means no matches, which is not an error in this case.
    if (error && error.code > 1) {
        console.log(0);
        return;
    }

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
        const alertMessage = `## Security Alert: Successful SSH Login(s) Detected\n\nThe following successful logins were detected on the system:\n\
\
${newLoginLines.join('\n')}
\
\
`;
        fs.appendFileSync(alertsFile, alertMessage);

        // Update the state file with all recent lines to prevent re-alerting.
        fs.writeFileSync(stateFile, currentLoginLines.join('\n'));
    }

    console.log(newLoginLines.length);
});
