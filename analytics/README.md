This is the analytics/reporting backend for the ponyplace client.

The python script that runs the service is intended to be hosted under uwsgi in emperor mode and reverse proxy'd behind nginx at the `/analytics` URI
A requirements.txt is included with the critical dependencies of the service.

If you're hosting this yourself, the browser client (and any python bots) will need to be updated to the new URI of the analytics server.

I do not apologize for the quality of this thing; I literally threw the entire thing together over the course of about four caffeine-addled hours.

The service expects to be able to write to a postgres instance. The databases, users and tables can be prepared with the dbsetup.sql script.
Change all the passwords and customize the usernames as per your preference, then correct the db server's hostname.

For metrics and reporting display, consider grafana. You'll need to figure out how to connect that yourself, but you want the TimescaleDB features enabled in both the db engine and grafana.
Two dashboards are included for reporting completion, pixel rate and error rate as well as an attempt at a heatmap of pixel placements. Again, thrown together in four hours.