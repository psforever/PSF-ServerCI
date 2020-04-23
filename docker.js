import path from "path"
import assert from "assert"

export class DockerBuilder {
	constructor(container_name, image_name, command) {
		assert(container_name && image_name && command);

		this._container_name = container_name;
		this._image_name = image_name;
		this._command = command;
		this._ports = []
		this._volumes = []
		this._environment = {}
		this._container_uid = undefined
		this._container_gid = undefined
	}

	addVolume(src, dst) {
		assert(src && dst);
		this._volumes.push({"abs_source" : path.resolve(src),
							"source" : src,
							"destination" : dst});
	}

	setEnv(key, value) {
		assert(key && value);
		this._environment[key] = value;
	}

	setCreds(uid, gid) {
		assert(typeof(uid) == 'number' && typeof(gid) == 'number');

		this._container_uid = uid;
		this._container_gid = gid;
	}

	publishUDP(port) {
		assert(typeof(port) == 'number' && port > 0 && port < 65536);
		this._ports.push({"type" : "udp", "port" : port});
	}

	publishTCP(port) {
		assert(typeof(port) == 'number' && port > 0 && port < 65536);
		this._ports.push({"type" : "tcp", "port" : port});
	}

	generateRunCommand() {
		let commands = ["docker", "run", "--detach", "--rm"];
		commands.push("--name", this._container_name);

		this._ports.forEach(p => {
			commands.push("--publish", `${p["port"]}:${p["port"]}/${p["type"]}`);
		});

		if (this._container_uid)
			commands.push("--user", `${this._container_uid}:${this._container_gid}`);

		this._volumes.forEach(v => {
			commands.push("--volume", `${v["abs_source"]}:${v["destination"]}`);
		});

		for (const key in this._environment) {
			commands.push("--env", `${key}=${this._environment[key]}`);
		}

		commands.push(this._image_name);
		commands.push(this._command);

		return commands;
	}
}
