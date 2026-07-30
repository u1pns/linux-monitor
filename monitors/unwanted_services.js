/**
 * Monitor: Unwanted Services
 *
 * This monitor checks for services that are often unnecessary or pose a security risk 
 * on a standard web server (e.g., Samba, ModemManager, RPC, etc.).
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const alertsFile = path.join(__dirname, 'alerts.txt');
const stateFile = path.join(__dirname, 'laststatus', 'unwanted_services.status');

// List of services we don't want to see running
const blacklist = [
    'ModemManager.service',
    'smbd.service',      // Samba
    'nmbd.service',      // Samba
    'rpcbind.service',   // RPC (often used in attacks)
    'cups.service',      // Printing service
    'avahi-daemon.service', // Network discovery
    'bluetooth.service'
];

try {
    const runningServicesStdout = execSync('systemctl list-units --type=service --state=running --no-pager --no-legend', { encoding: 'utf8' });
    
    const activeBlacklisted = blacklist.filter(service => runningServicesStdout.includes(service));

    let alertCount = 0;
    const currentState = activeBlacklisted.sort().join('\n');

    let lastState = '';
    if (fs.existsSync(stateFile)) {
        lastState = fs.readFileSync(stateFile, 'utf8').trim();
    }

    if (currentState !== lastState && activeBlacklisted.length > 0) {
        const list = activeBlacklisted.map(s => '- `' + s + '`').join('\n');
        const alertMessage = '## Security Alert: Unwanted Services Active\n\n' +
                           'The following services are running but are generally considered unnecessary or risky for this server profile:\n\n' +
                           list + '\n\n' +
                           'If you don\'t need them, stop and disable them using:\n' +
                           '`systemctl stop <service> && systemctl disable <service>`\n\n';
        
        fs.appendFileSync(alertsFile, alertMessage);
        alertCount = 1;
    }

    fs.writeFileSync(stateFile, currentState);
    console.log(alertCount);

} catch (error) {
    console.error(error);
    console.log(0);
}
