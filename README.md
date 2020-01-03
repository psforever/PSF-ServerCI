# PSF-ServerCI
A continuous integration GitHub app to spawn PSForever servers on new commits.

## Feature List
* Monitoring pull requests (forked and internal) and pushes to build and start server instances
* Service instance management (stopping old servers, etc.)
* Lightweight SQLite3 DB

### Upcoming Features
* Dockerization for security and resource management
* Register spawned servers with master LoginServer and port allocation
* Post job output to GitHub action API (including link to server)

## Installing
Before starting, you will need to create a GitHub app with the correct permissions to monitor checks, pull requests, and pushes. Then you need to redirect your application webhook URL to your running app instance. Using the app secrets, create a `config.json` like this:

```
{
  "listen_port" : 7777,
  "log_level" : "info",

  "build_directory" : "build/",
  "log_directory" : "logs/",
  "ci_database" : "psfci.db",
  "app_id" : <app-id>,
  "private_key_path" : "<app>-private-key.pem",
  "webhook_secret" : "<secret>"
}
```

This requires a relatively modern version of Node that supports async/await and ES6 (v13.x+). Tested using v13.3.0. You may still get `(node:61412) ExperimentalWarning: The ESM module loader is experimental.`. Ignore this as ESM is essentially stable in recent versions.

```
git clone https://github.com/psforever/PSF-ServerCI
npm install
node index.js
```

## Build Containers
https://github.com/hseeberger/scala-sbt
* docker pull hseeberger/scala-sbt
