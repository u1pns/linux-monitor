/**
 * Monitor: New SUID Files
 *
 * This monitor scans the file system for files with the SUID (Set User ID) bit set.
 * SUID files allow users to execute the file with the permissions of the file owner (usually root).
 * Sudden appearance of new SUID files is a huge security red flag (backdoors).
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const alertsFile = path.join(__dirname, 'alerts.txt');
const stateFile = path.join(__dirname, 'laststatus', 'suid_files.status');

// Directories to exclude to prevent hanging on network mounts or virtual filesystems
const excludedDirs = ['/proc', '/sys', '/dev', '/run', '/snap', '/var/lib/docker', '/var/lib/containerd'];

try {
    const excludeStr = excludedDirs.map(d => '-path ' + d + ' -prune').join(' -o ');
    const command = 'find / ' + excludeStr + ' -o -type f -perm -4000 -print 2>/dev/null';

    const stdout = execSync(command, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 5 }); // 5MB buffer
    const currentSuidFiles = stdout.trim().split('\n').filter(line => line).sort();

    if (currentSuidFiles.length === 0) {
        console.log(0);
        process.exit(0);
    }

    let alertCount = 0;

    if (fs.existsSync(stateFile)) {
        const lastSuidFiles = fs.readFileSync(stateFile, 'utf8').trim().split('\n');
        
        // Find new files
        const newFiles = currentSuidFiles.filter(file => !lastSuidFiles.includes(file));

        if (newFiles.length > 0) {
            const list = newFiles.map(f => '- `' + f + '`').join('\n');
            const alertMessage = '## Security Alert: New SUID Binaries Detected\n\n' +
                               'The following files have appeared with the SUID bit set (executes as root):\n' +
                               list + '\n\n' +
                               '**Verify these immediately.** If you did not install them, this is likely a compromise.\n\n';
            
            fs.appendFileSync(alertsFile, alertMessage);
            alertCount = 1;
        }
    }

    fs.writeFileSync(stateFile, currentSuidFiles.join('\n'));
    console.log(alertCount);

} catch (error) {
    const errorMessage = '## Monitor Error: suid_check.js\n\n```\n' + error.message + '\n```\n';
    fs.appendFileSync(alertsFile, errorMessage);
    console.log(1);
}