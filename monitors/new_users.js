/**
 * Monitor: New Users
 *
 * This monitor detects if new user accounts have been created on the system.
 *
 * Strategy:
 * It gets a list of all usernames from the `/etc/passwd` file.
 * This list is then compared against the list of users from the last check.
 *
 * State Management:
 * The script stores a complete, sorted list of all usernames in `laststatus/new_users.status`.
 * On the first run, it just saves the current user list. On subsequent runs, it alerts if any
 * new users are found. The state file is then updated with the new, complete list.
 */
/**
 * Detects if new user accounts have been created on the system by comparing
 * the current /etc/passwd file with a stored snapshot.
 * It is stateful and will only report on new user additions.
 */
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const alertsFile = path.join(__dirname, 'alerts.txt');
const stateFile = path.join(__dirname, 'laststatus', 'new_users.status');

// Command to get a sorted list of all usernames.
const command = "cut -d: -f1 /etc/passwd | sort";

exec(command, (error, stdout, stderr) => {
    if (error || stderr) {
        return; // Cannot get user list.
    }

    const currentUserList = stdout.trim().split('\n');

    if (!fs.existsSync(stateFile)) {
        // If this is the first run, just save the current state and exit.
        fs.writeFileSync(stateFile, currentUserList.join('\n'));
        return;
    }

    const lastUserList = fs.readFileSync(stateFile, 'utf8').trim().split('\n');
    const newUsers = currentUserList.filter(user => !lastUserList.includes(user));

    if (newUsers.length > 0) {
        const alertMessage = `## Security Alert: New User(s) Detected\n\nThe following new user accounts were detected on the system:\n\
${newUsers.join('\n')}\
\n`;
        fs.appendFileSync(alertsFile, alertMessage);

        // Update the state file with the new complete list.
        fs.writeFileSync(stateFile, currentUserList.join('\n'));
    }

    console.log(newUsers.length);
});
