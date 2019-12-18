const util = require('util');
const child_process = require('child_process')
const execFile = util.promisify(child_process.execFile);
const fs = require('fs')

// 1. Clone repository at the correct branch and SHA head
// 2. Build package
// 3. Extract package

async function run_repo_command(repo_path, command, args) {
	//console.log(`RUN[cwd:${repo_path}] - ${command} ${args}`)

	try {
		const {stdout, stderr} = await execFile(command, args, { cwd : repo_path });
		return stdout;
	} catch(e) {
		console.log(e);
		return null;
	}
}

function run_repo_command_background(repo_path, command, args) {
	const out = fs.openSync(repo_path + '/out.log', 'a');
	const err = fs.openSync(repo_path + '/out.log', 'a');

	const subprocess = child_process.spawn(command, args, {
	  detached: true,
	  stdio: [ 'ignore', out, err ],
	  cwd : repo_path,
	});

	subprocess.unref();
	return subprocess;
}

module.exports = {
	run_repo_command_background : run_repo_command_background,
	run_repo_command : run_repo_command,
}
