/**
 * Monitor: Intrusion Attempts
 *
 * This monitor checks for a high number of failed SSH login attempts within the last hour.
 *
 * Strategy:
 * It uses `journalctl` to count the number of "Failed password" entries for the `ssh.service`.
 * If the count exceeds a predefined threshold (20), it identifies the top 5 offending IP addresses.
 *
 * State Management:
 * The script saves the list of top offending IPs to `laststatus/intrusion_attempts.status`.
 * An alert is sent only if the list of offenders is new or has changed since the last check.
 * If the number of failed attempts is below the threshold, the state file is deleted, resetting the alert.
 */
/**
 * Scans system logs for failed SSH login attempts, which could indicate
 * a brute-force attack. It groups attempts by IP address.
 * It is stateful and will only report on new intrusion patterns.
 */
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const alertsFile = path.join(__dirname, 'alerts.txt');
const stateFile = path.join(__dirname, 'laststatus', 'intrusion_attempts.status');
const failureThreshold = 20;

// Command to get all failed password lines, uniquely sorted
const command = `journalctl -u ssh.service | grep 'Failed password' | sort -u`;

exec(command, (error, stdout, stderr) => {
    if (error && error.code > 1) { // Ignore grep exit code 1 (no match)
        console.log(0);
        return;
    }

    const currentFailures = stdout.trim().split('\n').filter(line => line);

    if (currentFailures.length === 0) {
        if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);
        console.log(0);
        return;
    }

    let lastFailures = [];
    if (fs.existsSync(stateFile)) {
        lastFailures = fs.readFileSync(stateFile, 'utf8').trim().split('\n').filter(line => line);
    }

    const newFailures = currentFailures.filter(line => !lastFailures.includes(line));

    if (newFailures.length > failureThreshold) {
        const tempFile = path.join(__dirname, 'laststatus', 'intrusion_attempts.tmp');
        fs.writeFileSync(tempFile, newFailures.join('\n'));

        const topIpCommand = `cat ${tempFile} | grep -oP 'from \K[0-9.]+' | sort | uniq -c | sort -nr | head -n 5`;
        
        exec(topIpCommand, (err, out) => {
            try {
                if (err) {
                    // Still update state, just don't include top IPs
                    const alertMessage = `## Security Alert: ${newFailures.length} New Failed Logins\nCould not generate list of top offending IPs.\n\n`;
                    fs.appendFileSync(alertsFile, alertMessage);
                    console.log(1);
                    return;
                }

                const topOffenders = out.trim();
                const alertMessage = `## Security Alert: ${newFailures.length} New Failed Logins\nTop new offending IPs:\n\`\`\`\n${topOffenders}\n\`\`\`\n\n`;
                fs.appendFileSync(alertsFile, alertMessage);
                console.log(1);
            } finally {
                // ALWAYS update the main state file and clean up the temp file
                fs.writeFileSync(stateFile, currentFailures.join('\n'));
                fs.unlinkSync(tempFile);
            }
        });
    } else {
        // If there are new failures but they are below the threshold, we still update the state to avoid re-alerting for them.
        if (newFailures.length > 0) {
            fs.writeFileSync(stateFile, currentFailures.join('\n'));
        }
        console.log(0);
    }
});