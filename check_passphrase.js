const https = require('https');
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const readline = require('readline');

const app = express();
const PORT = 443; // Default HTTPS port
require('dotenv').config()

app.use(bodyParser.json());

const db = new sqlite3.Database('auth.db');

// Read the private key file asynchronously
fs.readFile('key.pem', 'utf8', (err, privateKey) => {
    if (err) {
        console.error('Error reading private key file:', err);
        process.exit(1);
    }
        const passphrase = process.env.PASSPHRASE

        // Start HTTPS server with incorrect passphrase
        const options = {
            key: privateKey,
            passphrase: passphrase,
            cert: fs.readFileSync('cert.pem') // Path to your certificate
        };

        // Start HTTPS server
        https.createServer(options, app).listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
    });
});

