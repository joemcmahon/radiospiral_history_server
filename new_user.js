const bcrypt = require('bcryptjs');
const readlineSync = require('readline-sync');
const sqlite3 = require('sqlite3').verbose();

require('dotenv').config()
const db = new sqlite3.Database(process.env.DBFILE);
db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS auth (username TEXT PRIMARY KEY, PASSWORD TEXT)");
});

// Prompt the user to enter username
const username = readlineSync.question('Enter username: ');

// Check if the user already exists
db.get('SELECT * FROM auth WHERE username = ?', [username], (err, row) => {
    if (err) {
        console.error('Error checking user existence:', err);
        process.exit(1);
    }

    // Prompt the user to enter password (hidden)
    const password = readlineSync.question('Enter password (hidden): ', {
        hideEchoBack: true // Hide the password input
    });

    // Hash the password
    bcrypt.hash(password, 10, (err, hash) => {
        if (err) {
            console.error('Error hashing password:', err);
            process.exit(1);
        }

        // Insert or update username and hashed password in the database
        if (row) {
            // Update password for existing user
            db.run('UPDATE auth SET password = ? WHERE username = ?', [hash, username], function(err) {
                if (err) {
                    console.error('Error updating password in database:', err);
                    process.exit(1);
                }
                console.log('Password updated successfully!');
                process.exit(0);
            });
        } else {
            // Insert new user with hashed password
            db.run('INSERT INTO auth (username, password) VALUES (?, ?)', [username, hash], function(err) {
                if (err) {
                    console.error('Error inserting into database:', err);
                    process.exit(1);
                }
                console.log('User inserted successfully!');
                process.exit(0);
            });
        }
    });
});
