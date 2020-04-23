import logger from "./log.js"
import * as db from './db.js'
import app_config from "./app_config.js"
import * as util from "./util.js"
import fs from 'fs'
import path from "path"
import ini from 'ini'

const artifact_dir = app_config.artifact_directory

export async function delete_artifacts(log, job_ctx) {
	// job id should never repeat
	const job_artifact_dir = path.join(artifact_dir, ""+job_ctx.job_id);

	try {
		const files = db.get_artifacts_by_id(job_ctx.job_id);
	} catch (e) {
		log.error("Failed to get artifacts for job from db");
		return;
	}

	files.forEach((file) => {
		if (fs.existsSync(file.path)) {
			try {
				fs.unlinkSync(file.path);
			} catch (e) {
				log.error("Failed to remove %s from file system", file.path, e);
			}
		} else
			log.warn("Artifact %s missing from file system", file.path);
	});

	if (fs.existsSync(job_artifact_dir)) {
		log.info("Removing job artifact directory %s", job_artifact_dir);

		try {
			fs.rmdirSync(job_artifact_dir);
		} catch (e) {
			log.error("Failed to remove job artifact directory %s", e)
		}
	}

	try {
		await db.clear_artifacts(job_ctx.job_id);
	} catch (e) {
		log.error("Failed to clear artifacts from the database", e);
	}
}

export async function save_artifact(log, job_ctx, artifact) {
	if (!fs.existsSync(artifact)) {
		log.error("Artifact file '%s' does not exist", artifact);
		return;
	}

	if (!fs.existsSync(artifact_dir)) {
		log.info("Creating artifact directory %s", artifact_dir);
		fs.mkdirSync(artifact_dir);
	}

	// job id should never repeat
	const job_artifact_dir = path.join(artifact_dir, ""+job_ctx.job_id);

	if (!fs.existsSync(job_artifact_dir)) {
		log.info("Creating job artifact directory %s", job_artifact_dir);
		fs.mkdirSync(job_artifact_dir);
	}

	const job_artifact_path = path.join(job_artifact_dir, path.basename(artifact));

	log.info("Saving artifact %s -> %s", artifact, job_artifact_path);

	try {
		fs.copyFileSync(artifact, job_artifact_path);
	} catch (e) {
		log.error("Failed to copy file", e)
		return;
	}

	try {
		const artifact_id = await db.add_artifact(job_ctx.job_id, job_artifact_path);
		log.info("Artifact %d saved in database", artifact_id);
	} catch (e) {
		log.error("Failed to store artifact information in database", e);

		try {
			fs.unlinkSync(job_artifact_path);
		} catch (e) {
			log.error("Failed to clean up copied artifact file!", e);
		}
	}
}
