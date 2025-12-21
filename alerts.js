const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const nodemailer = require('nodemailer');
require('dotenv').config();
const { marked } = require('marked');

const monitorsDir = path.join(__dirname, 'monitors');
const alertsFile = path.join(monitorsDir, 'alerts.txt');
const statusDir = path.join(monitorsDir, 'laststatus');
const logFile = path.join(__dirname, 'alerts.log');
const lastEmailSentFile = path.join(statusDir, 'last_email_sent.status');
const HEARTBEAT_DAYS = 15;

// Email configuration from .env file
const emailConfig = {
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT, 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
};

const mailOptions = {
    from: {
        name: 'Server Monitor',
        address: process.env.MAIL_FROM
    },
    to: process.env.MAIL_TO,
    subject: 'Server Alert',
    text: '',
    html: ''
};

function log(message) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`);
}

/**
 * Updates the timestamp of the last sent email.
 */
function updateLastEmailTimestamp() {
    try {
        fs.writeFileSync(lastEmailSentFile, new Date().toISOString());
    } catch (err) {
        log(`Error updating last email timestamp: ${err.message}`);
    }
}

async function sendEmail(subject, content, isTest = false) {
    try {
        const transporter = nodemailer.createTransport(emailConfig);
        mailOptions.subject = subject;
        mailOptions.text = content;
        mailOptions.html = marked(content, { breaks: true });

        log(`Attempting to send email via ${emailConfig.host}:${emailConfig.port} to ${mailOptions.to}`);
        const info = await transporter.sendMail(mailOptions);
        log(`Email sent: ${info.response}`);
        console.log('Email sent: ' + info.response);
        if (!isTest) {
            updateLastEmailTimestamp();
        }
        return true; // Indicate success
    } catch (error) {
        log(`Error sending email: ${error}`);
        console.error('Error sending email:', error);
        return false; // Indicate failure
    }
}

function checkAlertsAndSendEmail() {
    // 4. Check alerts.txt and send email
    if (fs.existsSync(alertsFile) && fs.readFileSync(alertsFile, 'utf8').trim().length > 0) {
        const alertContent = fs.readFileSync(alertsFile, 'utf8');
        log('Alerts found, sending email...');
        console.log('Alerts found, sending email...');
        sendEmail('Server Alert', alertContent);
    } else {
      log('No new alerts. Checking for heartbeat...');
      console.log('No new alerts. Checking for heartbeat...');
      checkHeartbeat();
    }
}

function checkHeartbeat() {
  if (!fs.existsSync(lastEmailSentFile)) {
      log('Last email timestamp not found. Creating it now.');
      updateLastEmailTimestamp();
      return;
  }

  const lastEmailTimestamp = fs.readFileSync(lastEmailSentFile, 'utf8');
  const lastEmailDate = new Date(lastEmailTimestamp);
  const currentDate = new Date();
  
  const daysSinceLastEmail = (currentDate - lastEmailDate) / (1000 * 60 * 60 * 24);

  if (daysSinceLastEmail > HEARTBEAT_DAYS) {
      log(`Over ${HEARTBEAT_DAYS} days since last alert. Sending heartbeat email.`);
      const heartbeatSubject = 'System Status: All Clear';
      const heartbeatMessage = `## System Status: All Clear\n\nThis is an automated message to confirm that the monitoring system is running correctly.\n\nNo new alerts have been detected in the last ${HEARTBEAT_DAYS} days.\n`;
      sendEmail(heartbeatSubject, heartbeatMessage);
  } else {
      log(`Last alert was within ${HEARTBEAT_DAYS} days. No heartbeat needed.`);
  }
}

function runMonitoring() {
    try {
      log('Starting alerts script...');

      // Ensure the status directory exists before running any monitors.
      fs.mkdirSync(statusDir, { recursive: true });
    
      // 1. Delete alerts.txt if it exists
      if (fs.existsSync(alertsFile)) {
        fs.unlinkSync(alertsFile);
      }
    
      // 2. Read all .js files from monitors directory
      fs.readdir(monitorsDir, (err, files) => {
        if (err) {
          log(`Error reading monitors directory: ${err}`);
          console.error('Error reading monitors directory:', err);
          return;
        }
    
        const monitorFiles = files.filter(file => file.endsWith('.js'));
    
        if (monitorFiles.length === 0) {
          checkAlertsAndSendEmail();
          return;
        }
    
        let completedProcesses = 0;
    
        // 3. Execute each monitor file
        monitorFiles.forEach(file => {
          log(`Executing monitor: ${file}`);
          const filePath = path.join(monitorsDir, file);
          exec(`node ${filePath}`, (error, stdout, stderr) => {
            let alertCount = parseInt(stdout.trim(), 10) || 0;
    
            if (error) {
              log(`Error executing ${file}: ${error}`);
              const errorMessage = `## Monitor Error: ${file}\n\nAn error occurred while executing the monitor:\n\
\
${error.message}\n\
\
`;
              fs.appendFileSync(alertsFile, errorMessage);
              alertCount++; // Count this error as an alert
            }
            if (stderr) {
              log(`Error output from ${file}: ${stderr}`);
              // Avoid duplicating the error message if the 'error' object already captured it.
              if (!error) {
                const errorMessage = `## Monitor Error: ${file}\n\n The monitor produced the following error output (stderr):\n\
\
${stderr}\n\
\
`;
                fs.appendFileSync(alertsFile, errorMessage);
                alertCount++; // Count this error as an alert
              }
            }
            
            log(`Monitor ${file} finished. Result: ${alertCount} alerts.`);
            
            completedProcesses++;
            if (completedProcesses === monitorFiles.length) {
              checkAlertsAndSendEmail();
            }
          });
        });
      });
    } catch (error) {
      log(`Unhandled error in alerts.js: ${error}`);
      console.error('Unhandled error in alerts.js:', error);
    }
}

// Check for the --test argument
const isTestRun = process.argv.includes('--test');

if (isTestRun) {
    console.log('Running email configuration test...');
    log('Starting email test...');
    const testSubject = 'Test Email from Server Monitor';
    const testContent = '## Success!\n\nIf you have received this email, your SMTP configuration in the `.env` file is correct.';
    (async () => {
        const success = await sendEmail(testSubject, testContent, true);
        if (success) {
            console.log('Test email sent successfully. Check your inbox!');
        } else {
            console.error('Failed to send test email. Check alerts.log for details and your .env configuration.');
        }
    })();
} else {
    runMonitoring();
}