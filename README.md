# PSF-ServerCI
A continuous integration GitHub app to spawn PSForever servers on new commits.

## Feature List
* Monitoring pull requests (forked and internal) and pushes to build and start server instances
* Service instance management (stopping old servers, etc.)
* Lightweight SQLite3 DB for bookkeeping
* Dockerization for security and resource management
* Automatic port allocation and port reservations (for main branches)
* Job output via GitHub's action API (including link to server)

### Upcoming Features
* Register spawned servers with master LoginServer

## Installing
Before starting, you will need to create a GitHub app with the correct permissions to monitor checks, pull requests, and pushes. Then you need to redirect your application webhook URL to your running app instance. Using the app secrets, create a `config.json` like this:

```
{
  "listen_port" : 7777,
  "log_level" : "info",

  "build_directory" : "build/",
  "db_directory" : "build_db/",
  "log_directory" : "logs/",
  "artifact_directory" : "artifacts/",
  "ci_database" : "psfci.db",
  "app_id" : <app-id>,
  "private_key_path" : "<app>-private-key.pem",
  "webhook_secret" : "<secret>",
  "port_range" : [10005, 20000],
  "max_ports" : 2,
  "port_reservations": {
      "https://github.com/org/repo:master" : [10000, 10005]
  }
}
```

This requires a relatively modern version of Node that supports async/await and ES6 (v13.x+). Tested using v13.3.0. You may still get `(node:61412) ExperimentalWarning: The ESM module loader is experimental.`. Ignore this as ESM is essentially stable in recent versions.

```
git clone https://github.com/psforever/PSF-ServerCI
npm install
npm run dev
```

This only works on Linux. To run build jobs, you also need Docker installed and you need the `mozilla/sbt` image pulled.
Then you need to build the psfci specific Dockerfile:

```
docker pull mozilla/sbt
docker build -t psfci_db .
```
