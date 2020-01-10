import fs from 'fs'
import http from 'http'
import OctokitApp from "@octokit/app"
import Octokit from "@octokit/rest"
import createHandler from 'github-webhook-handler'
import path from 'path'
import express from "express"

import * as db from './db.js'
import logger from "./log.js"
import * as handlers from './check.js'
import * as instance from "./instance.js"
import app_config from "./app_config.js"

process.on('unhandledRejection', (reason, p) => {
	console.log('Unhandled Promise rejection at: ', p);
	console.log('Reason:', reason);
	throw reason;
});

const PORT = app_config.listen_port;

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
		output += `<li>Instance ${i.id} - <a href="/psfci/${i.id}">${url}</a></li>`;
	});
	output += "</ul>\n";
	output += "</body></html>\n";

	res.status(200).send(output);
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
	logger.info("Webserver now listening on %s:%d", app_config.listen_address, PORT)
});

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
