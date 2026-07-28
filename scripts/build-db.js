const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dbDir, 'students.db');

if (fs.existsSync(dbPath)) {
    console.log('Database already exists at:', dbPath);
    process.exit(0);
}

console.log('Database file not found at:', dbPath);
console.log('Please make sure students.db is placed in the /data directory or generated using the raw dataset.');
