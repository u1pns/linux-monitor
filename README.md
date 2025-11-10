# Server Monitoring & Maintenance System

A lightweight, stateful, and extensible server monitoring system designed for unattended operation. It silently watches your server and only notifies you about *new* issues, while also performing automated maintenance to prevent common problems.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Core Philosophy

-   **Silent Until Needed**: Avoids alert fatigue by only reporting on changes. A persistent error is reported once and then ignored until the state changes.
-   **Automated & Unattended**: Designed to be set up once and run reliably in the background via a cron job.
-   **Self-Aware**: Includes a "heartbeat" feature. If 15 days pass with no alerts, it sends a positive "All Clear" email to confirm it's still running.
-   **Simple Extensibility**: Adding new checks or maintenance tasks is as easy as dropping a new JavaScript file into a directory.
-   **Secure & Portable**: All sensitive information (like email credentials) is stored in a `.env` file, not in the code.

---

## Quick Start

### 1. Installation

Clone the repository and install the dependencies:

```bash
git clone https://github.com/your-username/your-repo.git
cd your-repo
npm install
```

### 2. Configuration

Create a `.env` file by copying the example file. This is where you'll store your email credentials for receiving alerts.

```bash
cp .env.example .env
```

Now, edit the `.env` file with your SMTP server details:

```dotenv
# .env
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@example.com
SMTP_PASS=your-email-password
MAIL_FROM=server-monitor@example.com
MAIL_TO=your-personal-email@example.com
```

### 3. Verify Email Configuration

Run the `mailtest` command to send a test email and verify that your configuration is correct.

```bash
npm run mailtest
```

Check your inbox for the test email before proceeding.

### 4. Initial Setup

Run the provided setup script. This will configure a cron job to run the main monitoring script automatically every day.

```bash
chmod +x setup_cron.sh
./setup_cron.sh
```

**That's it!** The system is now live. It will run daily at 8 AM, with maintenance tasks performed on Sundays.

---

## How It Works

The system is orchestrated by `run_daily.js`, which is the single script executed by cron.

1.  **Daily Monitoring (`alerts.js`)**: Every day, the orchestrator runs the alerting system. It executes every monitor script in the `/monitors` directory. If any monitor detects a new issue or a monitor script itself fails, an email alert is sent.
2.  **Weekly Maintenance (`cleaners.js`)**: On Sundays, after the monitoring run, the orchestrator executes the maintenance system. It runs every cleaner script in the `/cleaners` directory to perform tasks like log file truncation.
3.  **Heartbeat**: If 15 days pass without any alert emails being sent, the system sends a special "All Clear" email to assure you that it's still operational.

---

## How to Extend the System

This system is designed to be incredibly easy to extend. You don't need to modify the core scripts.

### Adding a New Monitor

1.  **Create a file** in the `/monitors` directory (e.g., `check-database-connection.js`).
2.  **Write your check**. The script must follow three rules:
    -   **Be Stateful**: Save the last state to a file in `/monitors/laststatus/` and only alert on changes.
    -   **Use Markdown**: Write alerts to `monitors/alerts.txt` in Markdown format.
    -   **Output Alert Count**: The script must end by printing the number of new alerts to the console (e.g., `console.log(1)`).
3.  **Done**. The new monitor will be included in the next run automatically.

### Adding a New Cleaner

1.  **Create a file** in the `/cleaners` directory (e.g., `clear-tmp-directory.js`).
2.  **Write your maintenance logic** in Node.js. Use `console.log` to report on actions taken, as this will be captured in `cleaners.log`.
3.  **Done**. The new cleaner will be executed on the next scheduled Sunday.

---

## Project Structure

```
/
├── run_daily.js        # Main orchestrator script run by cron
├── setup_cron.sh       # Idempotent script to set up the cron job
│
├── alerts.js           # Orchestrates all monitor scripts
├── alerts.log          # Log file for the alerting system
│
├── cleaners.js         # Orchestrates all cleaner scripts
├── cleaners.log        # Log file for the maintenance system
│
├── monitors/           # Directory for all monitoring scripts
│   ├── disk_space.js
│   └── laststatus/     # Directory for monitor state files
│
├── cleaners/           # Directory for all maintenance scripts
│   └── journal_vacuum.js
│
├── package.json
├── .env                # (You create this) Holds all secrets
└── .env.example        # Example environment file
```

---

## Development Context & Requirements

### About GEMINI.md

This project was developed with significant assistance from the Gemini CLI. The `GEMINI.md` file is a log of the architectural decisions, diagnostic protocols, and core logic developed during the project's creation. It serves as a detailed technical reference for the project's internal workings.

### Environment

The system was developed and tested on an **Ubuntu** server with the following key services installed. While the monitors can be adapted, they are currently tailored for this environment:

-   **PM2**: For managing Node.js applications. The `pm2_status` and `pm2_errors` monitors depend on it.
-   **Nginx**: As a web server. The `nginx_errors` monitor depends on it.
-   **Fail2Ban**: For blocking malicious IPs. The `ip_blocks` monitor depends on it.

### Requirements

-   **Node.js**: Version `v22.20.0` or higher is recommended.
-   **npm**: Version `10.9.3` or higher is recommended.
-   **Cron**: A cron daemon must be running on the system to schedule the daily execution.