// 4. Edit server worldconfig.ini for port allocation
// 5. Run server
// 6. Expose server port(s)
// 7. Expose server logs
const app_config = require("./app_config")
const sqlite3 = require('sqlite3').verbose();
let db = null;

async function open_database() {
	return new Promise((resolve, reject) => {
		db = new sqlite3.Database(app_config.ci_database, sqlite3.OPEN_READWRITE, async (error) => {
			if (!error) {
				resolve()
				return;
			}

			console.log("No job database yet. Creating new one")

			db = new sqlite3.Database(app_config.ci_database, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (error) => {
				if (error) {
					reject(error);
					return;
				}
			});

			await create_database();
			resolve();
		});
	});
}

async function create_database() {
	db.serialize(function() {
		db.run("CREATE TABLE job (id INTEGER PRIMARY KEY, check_suite_id INTEGER, check_id INTEGER, base_url TEXT, base_branch TEXT, base_sha TEXT, head_url TEXT, head_branch TEXT, head_sha TEXT)")
		db.run("CREATE TABLE instance (id INTEGER PRIMARY KEY, " +
			"job_id INTEGER, working_directory TEXT, pid INTEGER, log_path TEXT," +
			"FOREIGN KEY(job_id) REFERENCES job(id))")
	});
}

function make_param(dict) {
	const out_dict = {};
	for(const k in dict) {
		out_dict["$" + k] = dict[k]
	}

	return out_dict;
}

function create_job(github_ctx_base, github_ctx_head, job_ctx) {
	const job = {
		check_suite_id : job_ctx.check_suite_id,
		check_id : job_ctx.check_run_id,
		base_url : github_ctx_base.url,
		base_branch : github_ctx_base.branch,
		base_sha : github_ctx_base.head_sha,
		head_url : github_ctx_head.url,
		head_branch : github_ctx_head.branch,
		head_sha : github_ctx_head.head_sha,
	};

	return new Promise((resolve, reject) => {
		var stmt = db.prepare("INSERT INTO job VALUES(null, $check_suite_id, $check_id, $base_url, $base_branch, $base_sha, $head_url, $head_branch, $head_sha)");
		stmt.run(make_param(job), (err) => {
				if (err) {
					reject(err)
					return;
				}

				resolve(stmt.lastID);
		});
	});
}

function create_instance(job_id, working_dir, pid, log_path) {
	return new Promise((resolve, reject) => {
		var stmt = db.prepare("INSERT INTO instance VALUES(null, ?, ?, ?, ?)");
		stmt.run([job_id, working_dir, pid, log_path], (err) => {
				if (err) {
					reject(err)
					return;
				}

				resolve(stmt.lastID);
		});
	});
}

function get_jobs() {
	return new Promise((resolve, reject) => {
		db.all("SELECT * FROM job", function(err, rows) {
			if (err) {
				reject(err);
				return;
			}

			resolve(rows)
		});
	});
}

function get_jobs_by_suite(check_suite_id) {
	return new Promise((resolve, reject) => {
		db.all("SELECT * FROM job WHERE check_suite_id = ?", [check_suite_id], function(err, rows) {
			if (err) {
				reject(err);
				return;
			}

			resolve(rows)
		});
	});
}

function get_instances_by_job(job_id) {
	return new Promise((resolve, reject) => {
		db.all("SELECT * FROM instance WHERE job_id = ?", [job_id], function(err, rows) {
			if (err) {
				reject(err);
				return;
			}

			resolve(rows)
		});
	});
}

function get_instances() {
	return new Promise((resolve, reject) => {
		db.all("SELECT * FROM instance", function(err, rows) {
			if (err) {
				reject(err);
				return;
			}

			resolve(rows)
		});
	});
}

function delete_instance(id) {
	return new Promise((resolve, reject) => {
		db.all("DELETE FROM instance WHERE id = ?", [id], function(err, rows) {
			if (err) {
				reject(err);
				return;
			}

			resolve(rows)
		});
	});
}

function get_instances_by_gref(gref) {
	return new Promise((resolve, reject) => {
		db.all("SELECT instance.* FROM " +
			"instance INNER JOIN job ON job.id=instance.job_id WHERE " +
			"(job.head_url||':'||job.head_branch)=?", gref, function(err, rows) {
			if (err) {
				reject(err);
				return;
			}

			resolve(rows)
		});
	});
}

(async function() {
	await open_database();
})();

module.exports = {
	get_jobs : get_jobs,
	get_jobs_by_suite : get_jobs_by_suite,
	create_job : create_job,
	get_instances_by_gref : get_instances_by_gref,
	get_instances_by_job : get_instances_by_job,
	get_instances : get_instances,
	delete_instance : delete_instance,
	create_instance : create_instance,
}
