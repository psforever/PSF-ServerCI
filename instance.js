import * as db from './db.js'
import process from "process"
import logger from "./log.js"
import find from 'find-process'
import * as build from './build.js'
 
export async function stop_all() {
	const instances = await db.get_instances();

	for (let i = 0; i < instances.length; i++) {
		await stop(instances[i].id);
	}
}

export async function stop_all_job(job_id) {
	const instances = await db.get_instances_by_job(job_id);

	for (let i = 0; i < instances.length; i++) {
		logger.info("Stopping instance id:", instances[i].id);
		await stop(instances[i].id);
	}

	if (instances.length === 0) {
		logger.warn("No instances found for job id:", job_id);
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


export async function stop(instance_id) {
	let instance;

	try {
		instance = await db.get_instance_by_id(instance_id);

		if (!instance)
			throw new Error("Instance ID missing")
	} catch (e) {
		logger.error("Tried to get non-existant instance id %d: %s",
			instance_id, e);
		return;
	}

	await stop_docker(instance.container_name);

	try {
		await db.delete_instance(instance_id);
	} catch (e) {
		logger.error("Unable to remove instance from DB: ", e);
	}
}

export async function stop_docker(container_name) {
	const output = await build.run_repo_command(".", "docker", ["stop", "--time", "0", container_name]);

	if (output.code != 0) {
		logger.warn("Failed to stop container %s: %s",
			container_name, output.stdout || output.stderr);
	} else {
		logger.info("Stopped docker container " + container_name);
	}

	return;
}
