import fs from 'fs'
import http from 'http'
import OctokitApp from "@octokit/app"
import Octokit from "@octokit/rest"
import createHandler from 'github-webhook-handler'

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

const app = new OctokitApp.App({
 id: app_config.app_id,
 privateKey: fs.readFileSync(app_config.private_key_path)
});

var handler = createHandler({
	path: '/',
	secret: app_config.webhook_secret
});

http.createServer(function (req, res) {
	handler(req, res, function (err) {
		res.statusCode = 404
		res.end('no such location')
	});
}).listen(PORT, function() {
	logger.info("Webserver now listening on port %d", PORT)
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
		logger.error("UNHANDLED EVENT: ", event.event);
		// TODO: log full packet for debugging
	}
})
