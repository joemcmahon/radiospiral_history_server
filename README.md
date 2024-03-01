# radiospiral_history_server
API to record tracks played, fetch tracks played during an interval, and clean up the history as needed.

This small Node app runs on the RadioSpiral servers and records the tracks played; it's updated by Spud
as he monitors the activity on the Icecast server.

This service is designed to provide a way for us to record plays for our artists so that they know that
their tracks are in rotation, and for us to have a rolling play history on the RadioSpiral site.

## Endpoints
### /played
Allows a new track to be added to the DB.

    PUT https://localhost:443/played?artist=&track=&release=

Adds the play of the track to the database with a timestamp of the current time. Returns 200 if the
track was successfully added, 500 if not.

### /search
Search on `artist`, `track`, or `release`.

    GET https://localhost:443/search?field=&value=

Returns 200 and all entries matching the given field. This is a string `eq`, so the value must be exact.
Returns 200 and nothing if there were no matches. Returns 500 if there was an error.


### /cleanup
Move records from the main table to the "trash" table.

    PUT https://localhost:443/cleanup?daysOld=

Moves entries at least this many days old to the trash. `0` moves all records to the trash. Returns
200 and the number of entries trashed if this was successful, 500 if there was a failure.

### /trash
Empties the trash.

    DELETE https://localhost:443/trash

Drops the "trash" table and recreates it. Returns the number of entries deleted.

# Future work
We might at some point want to be able to recover records from the trash; at the moment, anything like
that will have to be done by hand.
