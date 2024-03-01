# radiospiral_history_server
API to record tracks played, fetch tracks played during an interval, and clean up the history as needed.

This small Node app runs on the RadioSpiral servers and records the tracks played; it's updated by Spud
as he monitors the activity on the Icecast server.

This service is designed to provide a way for us to record plays for our artists so that they know that
their tracks are in rotation, and for us to have a rolling play history on the RadioSpiral site.

## Endpoints
Endpoints are all authenticated via JWT. This means that you must use the
`/login` endpoint to get a JWT before continuing, and pass it via the
`Authentication: bearer` header when requesting any other endpoint.

### /login
Obtains a JWT to allow access to other endpoints.

    POST https://localhost:443/login

The JWT is returned in JSON, with `token` containing the token value. Tokens
default to being valid for 2 hours. If used with a client, we recommend refreshing the token at startup and every hour or so thereafter.

Usernames and passwords are added with the `new_user.js` script. This needs
to be run on the server where the database is hosted and adds the new user to the `auth` table.

### /played (authenticated)
Allows a new track to be added to the DB.

    PUT https://localhost:443/played?artist=&track=&release=

Adds the play of the track to the database with a timestamp of the current time. Returns 200 if the
track was successfully added, 500 if not.

### /search (authenticated)
Search on `artist`, `track`, or `release`.

    GET https://localhost:443/search?field=&value=

Returns 200 and all entries matching the given field. This is a string `eq`, so the value must be exact.
Returns 200 and nothing if there were no matches. Returns 500 if there was an error.


### /cleanup (authenticated)
Move records from the main table to the "trash" table.

    PUT https://localhost:443/cleanup?daysOld=

Moves entries at least this many days old to the trash. `0` moves all records to the trash. Returns
200 and the number of entries trashed if this was successful, 500 if there was a failure.

### /trash (authenticated)
Empties the trash.

    DELETE https://localhost:443/trash

Drops the "trash" table and recreates it. Returns the number of entries deleted.

# Environment variables
The server uses `dotenv` to load the environment variables. These are:

 - `SECURE_PORT`: the port to use for the HTTPS endpoints.
 - `INSECURE_PORT`: the port to use for the HTTP endpoints. Should not be used in production, obviously.
 - `DBFILE`: the name of the file for the SQLite database.
 - `PASSPHRASE` - the passphrase for the private key.
 - `JWT_SECRET_KEY` - the secret key used to construct the JWT.

`INSECURE_PORT` exists to allow developers to more easily test the server
when running it locally.

# Other scripts
## check_passphrase.js
Lets you verify that you've properly set up the SSL certs and that the
passphrase can be fetched from the environment.

## new_user.js
Creates a `bcrypt` password hash for a user. Takes a username and password
and writes the username and hash into the `auth` table of the database. The
authentication still needs to be integrated, but this gets the username/password
in place.

# Future work
We might at some point want to be able to recover records from the trash; at the moment, anything like that will have to be done by hand.
