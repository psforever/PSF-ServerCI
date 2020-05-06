import fs from 'fs'
import OctokitApp from "@octokit/app"
import Octokit from "@octokit/rest"
import createHandler from 'github-webhook-handler'
import path from 'path'
import express from "express"

import * as db from './db.js'
import logger from "./log.js"
import * as handlers from './check.js'
import app_config from "./app_config.js"

const MODE = process.env.NODE_ENV || 'development';
const PORT = app_config.listen_port;

process.on('unhandledRejection', (reason, p) => {
	console.log('Unhandled Promise rejection at: ', p);
	console.log('Reason:', reason);
	if (MODE == "development") {
		throw reason;
	} else {
		console.log("This error will lead to the server exiting in a dev environment");
	}
});


const server = express();
const app = new OctokitApp.App({
 id: app_config.app_id,
 privateKey: fs.readFileSync(app_config.private_key_path)
});

// https://docs.travis-ci.com/user/environment-variables/#default-environment-variables
process.env.CI = "true"
process.env.CONTINUOUS_INTEGRATION = "true"
process.env.DEBIAN_FRONTEND = "noninteractive"

var handler = createHandler({
	path: '/psfci',
	secret: app_config.webhook_secret
});

server.use(handler);

server.get("/psfci/", async (req, res, next) => {
	const instances = await db.get_instances_detailed();
	let output = "<!doctype html>\n";
	output += "<html><head><title>PSFCI Instances</title></head>\n";
	output += "<body>\n";
	output += "<ul>\n";
	instances.forEach((i) => {
		const url = i.head_url + "/commit/" + i.head_sha;
		output += `<li><a href="${url}">${i.head_branch}</a> [Instance ${i.id}] [<a href="/psfci/${i.id}">View Logs</a>]</li>\n`;
	});
	output += "</ul>\n";
	output += "</body></html>\n";

	res.status(200).send(output);
});

server.get("/psfci/api/artifact", async (req, res, next) => {
	const artifacts = await db.get_artifacts();
	res.status(200).send(artifacts);
});

server.get("/psfci/api/job", async (req, res, next) => {
	const jobs = await db.get_jobs();
	res.status(200).send(jobs);
});

server.get("/psfci/api/instance", async (req, res, next) => {
	const instances = await db.get_instances_detailed();
	res.status(200).send(instances);
});


server.param("instance", async (req, res, next, id) => {
	const id_parsed = parseInt(id);

	if (isNaN(id_parsed)) {
		res.status(404).send("Instance not found");
		return;
	}

	try {
		const instance = await db.get_instance_by_id(id_parsed);
		if (instance.length == 0) {
			res.status(404).send("Instance not found");
			return;
		} else {
			req.instance = instance;
			next();
		}
	} catch(e) {
		res.status(404).send("Instance not found");
		return;
	}
});

server.param("artifact_id", async (req, res, next, id) => {
	const id_parsed = parseInt(id);

	if (isNaN(id_parsed)) {
		res.status(404).send("Artifact not found");
		return;
	}

	try {
		const artifact = await db.get_artifact(id_parsed);
		if (artifact.length == 0) {
			res.status(404).send("Artifact not found");
			return;
		} else {
			req.artifact = artifact[0];
			next();
		}
	} catch(e) {
		res.status(404).send("Artifact not found");
		return;
	}
});

server.get("/psfci/artifact/:artifact_id", async (req, res, next) => {
	const artifact = req.artifact;
	const path = artifact.path;

	res.download(path);
});

server.get("/psfci/:instance", async (req, res, next) => {
	const instance = req.instance;
	const log_path = instance.log_path;

	if (req.query.file) {
		const file = req.query.file;
		const safeSuffix = path.normalize(file).replace(/^(\.\.(\/|\\|$))+/, '');
		const safeJoin = path.join(log_path, safeSuffix);

		const stream = fs.createReadStream(safeJoin);
		stream.on('open', function () {
			stream.pipe(res);
		});

		stream.on('error', function(err) {
			logger.error("File stream error " + err.message);
			res.status(200).send("File not found");
		});
	} else {
		let output = "<!doctype html>\n";
		output += "<html><head><title>PSFCI Instance</title></head>\n";
		output += "<body>\n";
		output += "<ol>\n";

		fs.readdir(log_path, function(err, items) {
			if (err) {
				res.status(200).send('No logs yet or instance failed to run.');
				return;
			}

			for (let i=0; i<items.length; i++) {
				const basename = items[i];
				const file = path + '/' + items[i];
				output += `<li><a href="/psfci/${instance.id}?file=${basename}">${basename}</li>`;
			}
			output += "</ol>\n";
			output += "</body></html>\n";

			res.status(200).send(output);
		});
	}

});

server.listen(PORT, app_config.listen_address, function() {
	logger.info("[MODE %s] Webserver now listening on %s:%d",
		MODE, app_config.listen_address, PORT)
})

//////////////

handler.on('error', function (err) {
	console.error('Error:', err.message)
});

handler.on('push', function (event) {
	logger.info('Received a push event for %s to %s',
		event.payload.repository.name,
		event.payload.ref)
})

handler.on('pull_request', async function (event) {
	const installationAccessToken = await app.getInstallationAccessToken({
		installationId: event.payload.installation.id
	});

	const octokit = new Octokit({
		previews : ['antiope'],
		auth: `token ${installationAccessToken}`
	});

	handlers.handle_pull_request(octokit,
		event.payload.action, event.payload.pull_request, event.payload.repository)
})

// TODO: optionally handle these
/*handler.on('integration_installation', function (event) {
	console.log("INTEGRATION_INST", event);
})

handler.on('installation', function (event) {
	console.log("INSTALL", event);
})*/

handler.on('check_suite', async function (event) {
	const installationAccessToken = await app.getInstallationAccessToken({
		installationId: event.payload.installation.id
	});

	const octokit = new Octokit({
		previews : ['antiope'],
		auth: `token ${installationAccessToken}`
	});

	const check_suite = event.payload.check_suite

	const github_ctx_head = {
		owner : event.payload.repository.owner.login,
		repo : event.payload.repository.name,
		branch : check_suite.head_branch,
		head_sha : check_suite.head_sha,
	};

	github_ctx_head.url =  "https://github.com/" + github_ctx_head.owner + "/" + github_ctx_head.repo

	const github_ctx_base = Object.assign({}, github_ctx_head)
	github_ctx_base.head_sha = check_suite.before;

	handlers.handle_check_suite(octokit, event.payload.action,
		github_ctx_base, github_ctx_head, check_suite)
})

handler.on('check_run', async function (event) {
	const installationAccessToken = await app.getInstallationAccessToken({
		installationId: event.payload.installation.id
	});

	const octokit = new Octokit({
		previews : ['antiope'],
		auth: `token ${installationAccessToken}`
	});

	const check_suite = event.payload.check_run.check_suite

	const github_ctx_head = {
		owner : event.payload.repository.owner.login,
		repo : event.payload.repository.name,
		branch : check_suite.head_branch,
		head_sha : check_suite.head_sha,
	};

	github_ctx_head.url =  "https://github.com/" + github_ctx_head.owner + "/" + github_ctx_head.repo

	const github_ctx_base = Object.assign({}, github_ctx_head)
	github_ctx_base.head_sha = check_suite.before;

	// decorate the check_run object with the requested_action, if present
	if (event.payload.requested_action) {
		event.payload.check_run.requested_action = event.payload.requested_action;
	}

	handlers.handle_check_run(octokit, event.payload.action,
		github_ctx_base, github_ctx_head, check_suite,
		event.payload.check_run
	)
})

let event_handlers = ['push', 'pull_request',
'integration_installation', 'installation', 'check_suite', 'check_run'];

handler.on('*', function (event) {
	if (event_handlers.indexOf(event.event) == -1) {
		logger.error("UNHANDLED EVENT: %s", event.event);
		// TODO: log full packet for debugging
	}
})
