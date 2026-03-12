/**
 * Monitor: System Log Errors
 *
 * This monitor checks the system journal for critical-level errors.
 *
 * Strategy:
 * It uses `journalctl` to retrieve log entries from the last 24 hours with a priority
 * level from 0 (emerg) to 2 (crit).
 *
 * State Management:
 * The script stores the entire output of the `journalctl` command in `laststatus/system_log_errors.status`.
 * An alert is sent only if the content of the log output has changed since the last check.
 * If the errors are cleared from the log, the state file is deleted.
 */
/**
 * Scans the system journal for critical-level errors (priority 0-2).
 * It has special handling for a recurring SSH error, requiring 5 occurrences
 * before alerting, while reporting other critical errors immediately.
 * It is stateful and will only report on new error lines.
 */
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const alertsFile = path.join(__dirname, 'alerts.txt');
const stateFile = path.join(__dirname, 'laststatus', 'system_log_errors.status');

// Configuration for the specific SSH error
const SSH_ERROR_TO_MONITOR = 'fatal: userauth_pubkey: parse request failed: incomplete message';
const SSH_ERROR_THRESHOLD = 5;

const command = "journalctl -p 0..2 --no-pager";

exec(command, (error, stdout, stderr) => {
    if (error || stderr) {
        console.log(0);
        return; // Handle command failure
    }

    const output = stdout.trim();
    let currentLogLines = output.includes('-- No entries --') ? [] : output.split('\n').filter(line => !line.startsWith('--'));

    let lastReportedLines = [];
    if (fs.existsSync(stateFile)) {
        lastReportedLines = fs.readFileSync(stateFile, 'utf8').split('\n').filter(line => line);
    }

    // Find lines that are new since the last report
    const newUniqueLines = [...new Set(currentLogLines.filter(line => !lastReportedLines.includes(line)))];

    if (newUniqueLines.length === 0) {
        console.log(0);
        return; // No new errors to process
    }

    const sshErrors = [];
    const otherErrors = [];

    newUniqueLines.forEach(line => {
        if (line.includes(SSH_ERROR_TO_MONITOR)) {
            sshErrors.push(line);
        } else {
            otherErrors.push(line);
        }
    });

    const errorsToReport = [...otherErrors];

    // If the threshold for SSH errors is met, add them to the report
    if (sshErrors.length >= SSH_ERROR_THRESHOLD) {
        errorsToReport.push(...sshErrors);
    }

    if (errorsToReport.length > 0) {
        const sortedErrorsToReport = errorsToReport.sort();
        const alertMessage = `## System Log Alert: Critical Errors Detected\n\n${sortedErrorsToReport.join('\n')}\n\n`;
        fs.appendFileSync(alertsFile, alertMessage);

        // Update the state file with all unique errors found in this run to prevent re-alerting
        const allCurrentUniqueLines = [...new Set(currentLogLines)].sort();
        fs.writeFileSync(stateFile, allCurrentUniqueLines.join('\n'));
        console.log(1);
    } else {
        if (currentLogLines.length === 0 && fs.existsSync(stateFile)) {
            // If all errors are gone, clear the state file
            fs.unlinkSync(stateFile);
        }
        console.log(0);
    }
});
