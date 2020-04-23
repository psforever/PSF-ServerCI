import assert from "assert";
import { DockerBuilder } from "../docker.js";

describe('Array', function() {
	describe('#indexOf()', function() {
		it('should return -1 when the value is not present', function() {
			assert.equal([1, 2, 3].indexOf(4), -1);
		});
	});
});

describe('DockerBuilder', function() {
	describe('generateRunCommand', function() {
		it('should return the right command', function() {
			const docker = new DockerBuilder("name", "image", "cmd")
			const cmd = docker.generateRunCommand()
			const good_cmd = [ 'docker', 'run', '--detach', '--rm', '--name', 'name',
				  'image', 'cmd'];

			assert.deepEqual(cmd, good_cmd)
		});

		it('should return the right command with extras', function() {
			const docker = new DockerBuilder("name", "image", "cmd")
			docker.addVolume("/../../tmp", "/app");
			docker.setEnv("PATH", "/bin:/usr/bin");
			docker.setCreds(1000, 1001);
			docker.publishUDP(12345);
			docker.publishTCP(23456);

			const cmd = docker.generateRunCommand()

			const good_cmd = [ 'docker', 'run', '--detach', '--rm', '--name', 'name',
				'--publish', '12345:12345/udp', '--publish', '23456:23456/tcp',
				'--user', '1000:1001',
				'--volume', '/tmp:/app',
				'--env', 'PATH=/bin:/usr/bin',
				'image', 'cmd'
			];

			assert.deepEqual(cmd, good_cmd)
		});
	});
});

