'use strict';

const fs = require('fs');
const path = require('path');

process.title = 'NodeCG';
global.exitOnUncaught = true;

function checkIfEmbedInstance() {
	const packagePath = path.resolve('package.json');

	if (fs.existsSync(packagePath)) {
		const {nodecg} = require(path.resolve('package.json'));

		if (typeof nodecg === 'object') {
			return true;
		}
	}

	return false;
}

const cwd = process.cwd();
const isEmbedInstance = checkIfEmbedInstance();

global.isZeitPkg = __dirname.startsWith('/snapshot/') || __dirname.toLowerCase().startsWith('c:\\snapshot\\');
if (global.isZeitPkg) {
	console.info('[nodecg] Detected that NodeCG is running inside a ZEIT pkg (https://github.com/zeit/pkg)');
} else if (cwd !== __dirname) {
	if (isEmbedInstance) {
		console.info('[nodecg] Detected that NodeCG is an embed instance');
	} else {
		console.warn('[nodecg] process.cwd is %s, expected %s', cwd, __dirname);
		process.chdir(__dirname);
		console.info('[nodecg] Changed process.cwd to %s', __dirname);
	}
}

if (!process.env.NODECG_ROOT) {
	process.env.NODECG_ROOT = process.cwd();
}

const semver = require('semver');
const {engines} = require('./package.json');
const nodeVersion = process.versions.node;

if (!semver.satisfies(nodeVersion, engines.node)) {
	console.error(`ERROR: NodeCG requires Node.js ${engines.node}`);
	console.error(`       Your Node.js version: v${nodeVersion}`);
	process.exit(1);
}

process.on('uncaughtException', err => {
	if (!global.sentryEnabled) {
		if (global.exitOnUncaught) {
			console.error('UNCAUGHT EXCEPTION! NodeCG will now exit.');
		} else {
			console.error('UNCAUGHT EXCEPTION!');
		}

		console.error(err);

		if (global.exitOnUncaught) {
			process.exit(1);
		}
	}
});

process.on('unhandledRejection', err => {
	if (!global.sentryEnabled) {
		console.error('UNHANDLED PROMISE REJECTION!');
		console.error(err);
	}
});

const server = require('./lib/server')
	.on('error', () => process.exit(1))
	.on('stopped', () => process.exit(0));

server.start({isEmbedInstance});
