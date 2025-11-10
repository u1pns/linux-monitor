const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const cleanersDir = path.join(__dirname, 'cleaners');
const logFile = path.join(__dirname, 'cleaners.log');

function log(message) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`);
}

try {
  log('Starting cleaners script...');

  fs.readdir(cleanersDir, (err, files) => {
    if (err) {
      log(`Error reading cleaners directory: ${err}`);
      return;
    }

    const cleanerFiles = files.filter(file => file.endsWith('.js'));

    if (cleanerFiles.length === 0) {
      log('No cleaners found to execute.');
      return;
    }

    cleanerFiles.forEach(file => {
      log(`Executing cleaner: ${file}`);
      const filePath = path.join(cleanersDir, file);
      exec(`node ${filePath}`, (error, stdout, stderr) => {
        if (error) {
          log(`Error executing ${file}: ${error.message}`);
        }
        if (stderr) {
          log(`Error output from ${file}: ${stderr}`);
        }
        if (stdout) {
          log(`Output from ${file}: ${stdout.trim()}`);
        }
        log(`Cleaner ${file} finished.`);
      });
    });
  });
} catch (error) {
  log(`Unhandled error in cleaners.js: ${error}`);
}

