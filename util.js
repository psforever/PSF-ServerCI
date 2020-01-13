import * as build from "./build.js"
import logger from "./log.js"

export async function get_free_udp_ports(start, end, amount) {
	const portlist = await build.run_repo_command(".", "ss", ["--udp", "--listening", "--numeric", "--no-header"])

	if (portlist.code != 0) {
		logger.error("Failed to get free UDP ports: %s",
			portlist.stdout || portlist.stderr);
		return [];
	}

	const taken_ports = {};

	portlist.stdout.split("\n").forEach((line) => {
		if (!line) return;
		const tokens = line.split(/\s+/);
		const ip_port = tokens[3];
		const iptokens = ip_port.split(":");
		taken_ports[iptokens[iptokens.length-1]] = 1
	});

	for (let p = start; p <= end; p++) {
		let found = true;
		const ports = [];

		for (let i = p; i < p+amount && i <= end; i++) {
			ports.push(i);

			if (i in taken_ports) {
				found = false
				break;
			}
		}

		if (found)
			return ports;
	}

	return [];
}
