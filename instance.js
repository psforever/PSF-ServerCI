import * as db from './db.js'
import process from "process"
import logger from "./log.js"
import find from 'find-process'
import * as build from './build.js'
 
export async function stop_all() {
	const instances = await db.get_instances();

	for (let i = 0; i < instances.length; i++) {
		await stop(instances[i]);
	}
}

export async function stop_all_job(job_id) {
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


export async function stop(instance) {
	await stop_docker(instance.container_name);

	try {
		await db.delete_instance(instance.id);
	} catch (e) {
		logger.error("Unable to remove instance from DB: ", e);
	}
}

export async function stop_docker(container_name) {
	try {
		const output = await build.run_repo_command(".", "docker", ["stop", "--time", "0", container_name]);
		logger.info("Stopped docker container " + container_name);
	} catch (e) {
		logger.warn("Failed to stop container: " + e.message);
	}

	return;
}
