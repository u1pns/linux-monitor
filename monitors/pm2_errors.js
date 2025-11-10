/**
 * Monitor: PM2 Errors
 *
 * This monitor checks for new error entries in the log files of all applications managed by PM2.
 *
 * Strategy:
 * It scans the PM2 log directory (`/root/.pm2/logs/`) for any file ending in "-error.log".
 * For each error log file found, it reads the last 5 lines.
 *
 * State Management:
 * The script creates a separate state file for each PM2 process (e.g., `laststatus/app-error.status`).
 * This state file stores the last 5 error lines that were reported. An alert is sent only if the
 * content of the last 5 lines is different from what is stored in the state file.
 * If an error log is empty or deleted, the corresponding state file is removed.
 */
/**
 * Checks for new error entries in the log files of all applications managed by PM2.
 * It is stateful and reports separately for each PM2 process log.
 */
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const alertsFile = path.join(__dirname, 'alerts.txt');
const pm2LogDir = '/root/.pm2/logs/';

fs.readdir(pm2LogDir, (err, files) => {
    if (err) {
        fs.appendFileSync(alertsFile, `## PM2 Monitor Error\nCould not read PM2 log directory: ${err.message}\n`);
        console.log(1); // Report the error itself as one alert
        return;
    }

    const errorLogs = files.filter(file => file.endsWith('-error.log'));
    let alertsGenerated = 0;
    let processedLogs = 0;

    if (errorLogs.length === 0) {
        console.log(0);
        return;
    }

    errorLogs.forEach(logFile => {
        const logPath = path.join(pm2LogDir, logFile);
        const stateFile = path.join(__dirname, 'laststatus', `${path.basename(logFile, '.log')}.status`);

        fs.stat(logPath, (statErr, stats) => {
            if (statErr || stats.size === 0) {
                if (fs.existsSync(stateFile)) {
                    fs.unlinkSync(stateFile);
                }
            } else {
                exec(`tail -n 5 ${logPath}`, (execErr, stdout) => {
                    if (!execErr) {
                        const currentErrors = stdout.trim();
                        let lastErrors = "";
                        if (fs.existsSync(stateFile)) {
                            lastErrors = fs.readFileSync(stateFile, 'utf8');
                        }

                        if (currentErrors && currentErrors !== lastErrors) {
                            const alertMessage = `## PM2 Alert: New Errors in ${logFile}\n\`\`\`\n${currentErrors}\n\`\`\`\n\n`;
                            fs.appendFileSync(alertsFile, alertMessage);
                            fs.writeFileSync(stateFile, currentErrors);
                            alertsGenerated++;
                        }
                    }
                    
                    processedLogs++;
                    if (processedLogs === errorLogs.length) {
                        console.log(alertsGenerated);
                    }
                });
                return; // Prevent fall-through
            }
            
            processedLogs++;
            if (processedLogs === errorLogs.length) {
                console.log(alertsGenerated);
            }
        });
    });
});