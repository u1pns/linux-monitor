/**
 * Monitor: Basic Security Configuration Audit
 *
 * This monitor checks for fundamental security best practices.
 * It is designed to alert users who might be deploying this project on a raw, unsecured VPS.
 *
 * Checks:
 * 1. Firewall (UFW) status.
 * 2. Fail2Ban service status.
 * 3. SSH Configuration (Root login and Password Authentication).
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const alertsFile = path.join(__dirname, 'alerts.txt');
const stateFile = path.join(__dirname, 'laststatus', 'security_config.status');

let issues = [];

// 1. Check UFW (Firewall)
try {
    // Check if UFW is installed and active
    const ufwStatus = execSync('ufw status 2>/dev/null || echo "not found"', { encoding: 'utf8' }).trim();
    if (ufwStatus === 'not found') {
        issues.push('- **Firewall (UFW)**: Command not found. Is a firewall installed?');
    } else if (!ufwStatus.toLowerCase().includes('status: active')) {
        issues.push('- **Firewall (UFW)**: The firewall is NOT active. Your server ports may be exposed.');
    }
} catch (error) {
    issues.push('- **Firewall (UFW)**: Unable to check status.');
}

// 2. Check Fail2Ban
try {
    // Check if Fail2Ban is active via systemctl
    // stdio: pipe prevents output to console, catch handles the error if service is missing/dead
    execSync('systemctl is-active --quiet fail2ban');
} catch (error) {
    // Exit code 0 means active, non-zero means inactive or missing
    issues.push('- **Fail2Ban**: Service is NOT running. Brute-force protection is likely disabled.');
}

// 3. Check SSH Configuration
const sshConfigPath = '/etc/ssh/sshd_config';
try {
    if (fs.existsSync(sshConfigPath)) {
        const sshConfig = fs.readFileSync(sshConfigPath, 'utf8');

        // Check for Root Login (PermitRootLogin yes)
        // We look for the line, ensuring it's not commented out
        if (/^\s*PermitRootLogin\s+yes/m.test(sshConfig)) {
            issues.push('- **SSH Security**: Root login is explicitly enabled (`PermitRootLogin yes`). This is a high security risk.');
        }

        // Check for Password Authentication (PasswordAuthentication yes)
        // Note: Default is often 'yes' if not specified, but we look for explicit 'yes' or lack of 'no' implies 'yes' in some distros.
        // To be safe and reduce noise, we only alert if we explicitly find "yes".
        if (/^\s*PasswordAuthentication\s+yes/m.test(sshConfig)) {
            issues.push('- **SSH Security**: Password authentication is enabled. Using SSH Keys is strongly recommended.');
        }
    } else {
        issues.push('- **SSH Security**: Could not find sshd_config to audit.');
    }
} catch (error) {
    issues.push(`- **SSH Security**: Error reading configuration: ${error.message}`);
}

// --- Logic for alerting and state management ---

const currentIssueString = issues.sort().join('\n');
let alertCount = 0;

try {
    let lastIssueString = '';
    if (fs.existsSync(stateFile)) {
        lastIssueString = fs.readFileSync(stateFile, 'utf8').trim();
    }

    // Only alert if the LIST of issues has changed.
    // This allows the user to see the alert once. If they fix it, the list changes (shrinks) and updates state.
    // If they ignore it, the state matches, and we remain silent (no spam).
    if (currentIssueString !== lastIssueString && issues.length > 0) {
        
        // We calculate ONLY the new issues to highlight, or report all if it's a general state change?
        // For configuration audits, it's better to show the full current list of failures.
        
        const alertMessage = `## Security Configuration Warning\n\n` +
                           `The following potential security vulnerabilities were detected:\n\n` +
                           `${currentIssueString}\n\n` +
                           `*Note: This alert will not repeat unless the configuration changes.* \n\n`;
        
        fs.appendFileSync(alertsFile, alertMessage);
        alertCount = 1;
    }

    // Update state
    fs.writeFileSync(stateFile, currentIssueString);

} catch (error) {
    console.error(error); // Log to stderr for debug
} finally {
    console.log(alertCount);
}
