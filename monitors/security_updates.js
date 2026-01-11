/**
 * Monitor: Security Updates Check
 *
 * This monitor checks for pending security updates using Ubuntu's native `apt-check` tool.
 * It alerts if there are updates available that should be installed immediately.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const alertsFile = path.join(__dirname, 'alerts.txt');
const stateFile = path.join(__dirname, 'laststatus', 'security_updates.status');

try {
    // /usr/lib/update-notifier/apt-check outputs "X;Y" to stderr
    // X = all updates
    // Y = security updates
    // We redirect stderr to stdout to capture it easily
    const output = execSync('/usr/lib/update-notifier/apt-check 2>&1', { encoding: 'utf8' }).trim();
    
    const parts = output.split(';');
    if (parts.length !== 2) {
        throw new Error('Unexpected output format from apt-check: ' + output);
    }

    const securityUpdates = parseInt(parts[1], 10);
    const totalUpdates = parseInt(parts[0], 10);

    let alertCount = 0;
    
    // Read previous state
    let lastSecurityUpdates = 0;
    if (fs.existsSync(stateFile)) {
        lastSecurityUpdates = parseInt(fs.readFileSync(stateFile, 'utf8').trim(), 10);
    }

    // Alert if there are security updates AND the count has changed (or is basically > 0 and we want to remind)
    // To reduce spam, we alert if the count INCREASES or if it's > 0 and we haven't alerted in a while?
    // For simplicity: Alert if securityUpdates > 0 and (securityUpdates !== lastSecurityUpdates)
    // Actually, for security, persistent nagging is okay, but let's stick to "change" to avoid daily spam if user ignores it.
    
    if (securityUpdates > 0 && securityUpdates !== lastSecurityUpdates) {
        const alertMessage = '## Security Alert: Pending Updates\n\n' +
                           'The system has detected pending software updates:\n\n' +
                           '- **Security Updates: ' + securityUpdates + '** (Action Required)\n' +
                           '- Other Updates: ' + totalUpdates + '\n\n' +
                           '**Action Required:** Log in and update your system immediately:\n' +
                           '`sudo apt-get update && sudo apt-get upgrade`\n\n';
        
        fs.appendFileSync(alertsFile, alertMessage);
        alertCount = 1;
    }

    // Update state
    fs.writeFileSync(stateFile, securityUpdates.toString());
    console.log(alertCount);

} catch (error) {
    const errorMessage = '## Monitor Error: security_updates.js\n\n```\n' + error.message + '\n```\n';
    fs.appendFileSync(alertsFile, errorMessage);
    console.log(1);
}
