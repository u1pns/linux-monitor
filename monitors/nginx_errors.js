/**
 * Monitor: Nginx Errors
 *
 * This monitor checks for a high number of error entries in the Nginx service logs within the last hour.
 *
 * Strategy:
 * It uses `journalctl` to count the number of lines containing "error" for the `nginx.service`.
 * If the count exceeds a predefined threshold (50), it captures the last 20 error lines to include in the alert.
 *
 * State Management:
 * The script saves the last 20 error lines to `laststatus/nginx_errors.status`.
 * An alert is sent only if the captured error log snippet is new or has changed since the last check.
 * If the error count is below the threshold, the state file is deleted, resetting the alert.
 */
/**
 * Scans Nginx service logs for new error entries. If the number of new, unique
 * errors exceeds a threshold (50), it generates an alert with a snippet of the errors.
 * It is stateful and will only report on new error patterns.
 */
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const alertsFile = path.join(__dirname, 'alerts.txt');
const stateFile = path.join(__dirname, 'laststatus', 'nginx_errors.status');
const errorThreshold = 50;

// Command to get all unique error lines from nginx
const command = `journalctl -u nginx.service | grep -i 'error' | sort -u`;

exec(command, (error, stdout, stderr) => {
    if (error && error.code > 1) { // Ignore grep exit code 1 (no match)
        console.log(0);
        return;
    }

    const currentErrors = stdout.trim().split('\n').filter(line => line);

    if (currentErrors.length === 0) {
        if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);
        console.log(0);
        return;
    }

    let lastErrors = [];
    if (fs.existsSync(stateFile)) {
        lastErrors = fs.readFileSync(stateFile, 'utf8').trim().split('\n').filter(line => line);
    }

    const newErrors = currentErrors.filter(line => !lastErrors.includes(line));

    if (newErrors.length > errorThreshold) {
        const recentErrorsSnippet = `echo "${newErrors.join('\n')}" | tail -n 20`;
        exec(recentErrorsSnippet, (err, out) => {
            let errorDetails = "Could not generate recent error snippet.";
            if (!err) {
                errorDetails = out.trim();
            }

            const alertMessage = `## Nginx Alert: ${newErrors.length} New Errors Detected\nRecent new errors:\n\`\`\`\n${errorDetails}\n\`\`\`\n\n`;
            fs.appendFileSync(alertsFile, alertMessage);
            fs.writeFileSync(stateFile, currentErrors.join('\n'));
            console.log(1);
        });
    } else {
        // If there are new errors but they are below the threshold, update the state to avoid re-alerting.
        if (newErrors.length > 0) {
            fs.writeFileSync(stateFile, currentErrors.join('\n'));
        }
        console.log(0);
    }
});