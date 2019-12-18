const db = require("./db")
const process = require("process")
const logger = require("./log");
const find = require('find-process');
 
async function stop_all() {
	const instances = await db.get_instances();

	for (let i = 0; i < instances.length; i++) {
		await stop(instances[i]);
	}
}

async function stop_all_job(job_id) {
	const instances = await db.get_instances_by_job(job_id);

	for (let i = 0; i < instances.length; i++) {
		await stop(instances[i]);
	}
}

const timeout = ms => new Promise(res => setTimeout(res, ms))

// TODO: double check that the instance has the same CMDLINE as expected to
// avoid killing innocent programs
async function process_exists(pid) {
	try {
		const list = await find('pid', pid);
		return list.length > 0;
	} catch (e) {
		logger.error("Failed to enumerate pid=%d: ", pid, e);
		return false;
	}
}

function process_kill(pid, sig) {
	try {
		process.kill(pid, sig)
		return true;
	} catch (e) {
		console.log(e)
		return false;
	}
}

async function stop(instance) {
	const pid = instance.pid;

	if (!await process_exists(pid)) {
		logger.warn("Tried to stop non-existant process pid=%d", pid)

		try {
			await db.delete_instance(instance.id);
		} catch (e) {
			logger.error("Unable to remove instance from DB: ", e);
		}
		return;
	}

	const MAX_TRIES = 5;

	let i;

	// try to kill it gracefully at first
	for (i = 0 ; i < MAX_TRIES; i++) {
		if (!process_kill(pid, 'SIGTERM')) {
			logger.warn("Failed to send kill signal to pid=%d", pid)
		}

		if (!await process_exists(pid))
			break

		await timeout(1000);
	}

	if (i == MAX_TRIES) {
		logger.warn("Process not responding to SIGTERM, sending SIGKILL")
		process_kill(pid, 'SIGKILL')
	}

	// final check to see if the process still exists
	if (!await process_exists(pid)) {
		logger.info("Succesfully killed pid=%d", pid);
	} else {
		logger.error("UNABLE to kill pid=%d! Resource leaked: ", pid, e);
	}

	try {
		await db.delete_instance(instance.id);
	} catch (e) {
		logger.error("Unable to remove instance from DB: ", e);
	}
}

module.exports = {
	stop_all_job : stop_all_job,
	stop_all : stop_all,
	stop : stop,
}
