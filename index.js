const express = require('express');
const sqlite3 = require('sqlite3').verbose();

require('dotenv').config()

const app = express();
const PORT = process.env.PORT; // Choose the port you want to run the server on

// Create a new SQLite database
const db = new sqlite3.Database(process.env.DBFILE);

// JSON logging
function logToJson(message) {
    const log = {
        timestamp: new Date().toISOString(),
        message: message
    };
    console.log(JSON.stringify(log));
}

// Create a table to store records
db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS records (id INTEGER PRIMARY KEY, artist TEXT, track TEXT, release TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)");
    db.run("CREATE TABLE IF NOT EXISTS trash_records (id INTEGER PRIMARY KEY, artist TEXT, track TEXT, release TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)");
});
logToJson("starting")

// Endpoint to save a record
app.put('/played', (req, res) => {
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
app.get('/played', (req, res) => {
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
app.get('/search', (req, res) => {
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
app.put('/cleanup', (req, res) => {
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
app.delete('/trash', (req, res) => {
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

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
