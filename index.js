const express = require('express');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const https = require('https');
const http = require('http');
const fs = require('fs');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');

require('dotenv').config()

const app = express();
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

const INSECURE_PORT = process.env.INSECURE_PORT;
const SECURE_PORT = process.env.SECURE_PORT;
const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY;

// Create a new SQLite database
const db = new sqlite3.Database(process.env.DBFILE);

// Read the private key file asynchronously
fs.readFile('key.pem', 'utf8', (err, privateKey) => {
    if (err) {
        console.error('Error reading private key file:', err);
        process.exit(1);
    }
    const passphrase = process.env.PASSPHRASE

    // Start HTTPS server with correct passphrase
    const options = {
        key: privateKey,
        passphrase: passphrase,
        cert: fs.readFileSync('cert.pem') // Path to your certificate
    };

  var undef
  var no_server = true
  // Start HTTPS server
  logToJson("Checking secure server")
  if (SECURE_PORT !== undef) {
    https.createServer(options, app).listen(SECURE_PORT, () => {
        console.log(`Server is running on port ${SECURE_PORT}`);
    });
    no_server = false
  } else {
    logToJson("secure server not running")
  }
  // Start HTTP server
  logToJson("Checking insecure server")
  if (INSECURE_PORT !== undef) {
    http.createServer(options, app).listen(INSECURE_PORT, () => {
        console.log(`Server is running on port ${INSECURE_PORT}`);
    });
    no_server = false
  } else {
    logToJson("no insecure server running")
  }
  if (no_server) {
    logToJson("NO SERVERS STARTED!")
    return(1);
  }
});

// JSON logging
function logToJson(message) {
    const log = {
        timestamp: new Date().toISOString(),
        message: message
    };
    console.log(JSON.stringify(log));
}

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Extract token from Authorization header

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        req.user = user;
        next(); // Proceed to the next middleware or route handler
    });
}

// Create a table to store records
db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS records (id INTEGER PRIMARY KEY, artist TEXT, track TEXT, release TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)");
    db.run("CREATE TABLE IF NOT EXISTS trash_records (id INTEGER PRIMARY KEY, artist TEXT, track TEXT, release TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)");
});
logToJson("starting")

// Login endpoint
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Retrieve user from the database
    db.get('SELECT * FROM auth WHERE username = ?', [username], (err, user) => {
        if (err) {
            console.error('Error retrieving user:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
        if (!user) {
            //return res.status(401).json({ error: 'Invalid username or password' });
            return res.status(401).json({ error: 'Invalid username' });
        }
        // Verify password
        bcrypt.compare(password, user.PASSWORD, (err, isMatch) => {
            if (err || !isMatch) {
                return res.status(401).json({ error: 'Invalid username or password' });
            }

            // Generate JWT token
            const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET_KEY, { expiresIn: '2h' });
            res.json({ token: token });
        });
    });
});

// Endpoint to save a record
app.put('/played', authenticateToken, (req, res) => {
    const { artist, track, release } = req.query;

    db.run("INSERT INTO records (artist, track, release) VALUES (?, ?, ?)", [artist, track, release], (err) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.sendStatus(200);
    });
    logToJson("added " + artist + "--" + track + "--" + release)
});

// Endpoint to retrieve records between two timestamps
app.get('/played', authenticateToken, (req, res) => {
    const { start, end } = req.query;

    let query = "SELECT * FROM records WHERE timestamp >= ? AND timestamp <= ?";
    let params = [start, end || new Date().toISOString()];

    db.all(query, params, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
    logToJson("retrieved " + start + " to " + end)
});

// Endpoint to search records by field
app.get('/search', authenticateToken, (req, res) => {
    const { field, value } = req.query;

    let query = `SELECT * FROM records WHERE ${field} = ?`;

    db.all(query, [value], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
    logToJson("searched for" + field + "=" + value)
});

// Endpoint to move records to trash before a specified number of days
app.put('/cleanup', authenticateToken, (req, res) => {
    const { daysOld } = req.query;

    // Calculate the date that is the specified number of days ago from the current date
    const date = new Date();
    date.setDate(date.getDate() - parseInt(daysOld));

    let copyQuery = "INSERT INTO trash_records (artist, track, release, timestamp) SELECT artist, track, release, timestamp FROM records WHERE timestamp < ?";
    let deleteQuery = "DELETE FROM records WHERE timestamp < ?";

    db.serialize(() => {
        db.run(copyQuery, [date.toISOString()], function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            const recordsMoved = this.changes;

            db.run(deleteQuery, [date.toISOString()], function(err) {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                const recordsDeleted = this.changes;

                res.json({ recordsMoved: recordsMoved, recordsDeleted: recordsDeleted });
            });
        });
    });
});

// Endpoint to drop the trash table and return the count of records before deletion
app.delete('/trash', authenticateToken, (req, res) => {
    let countQuery = "SELECT COUNT(*) AS count FROM trash_records";
    let dropQuery = "DROP TABLE IF EXISTS trash_records";
    let recreateQuery = "CREATE TABLE IF NOT EXISTS trash_records (id INTEGER PRIMARY KEY, artist TEXT, track TEXT, release TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)";

    db.serialize(() => {
        db.get(countQuery, function(err, row) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            const recordsCount = row.count;

            db.run(dropQuery, function(err) {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }

                db.run(recreateQuery, function(err) {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }
                    res.json({ recordsCount: recordsCount });
                });
            });
        });
    });
});
