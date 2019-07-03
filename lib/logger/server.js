/* eslint-disable capitalized-comments */

'use strict';

const colors = require('colors/safe');
const fs = require('fs.extra');
const indentString = require('indent-string');
const mapObject = require('map-obj');
const objectPath = require('object-path');
const path = require('path');
const util = require('util');
const winston = require('winston');

/**
 * Logger level configuration.
 * @enum {String}
 */
const LoggerLevel = {
	/* The highest level of logging, logs everything */
	trace: {
		color: 'magenta',
		level: 4
	},

	/* Less spammy than trace, includes most info relevant for debugging */
	debug: {
		color: 'cyan',
		level: 3
	},

	/* The default logging level. Logs useful info, warnings, and errors */
	info: {
		color: 'green',
		level: 2
	},

	/* Only logs warnings and errors */
	warn: {
		color: 'yellow',
		level: 1
	},

	/* Only logs errors */
	error: {
		color: 'red',
		level: 0
	}
};

/**
 * @typedef {LoggerOptions}
 *
 * @property {LoggerConsoleOptions} [console] Configuration for the console logging.
 * @property {LoggerFileOptions} [file] Configuration for file logging.
 * @property {Boolean} [replicants=false] Whether to enable logging specifically for the Replicants system.
 */

/**
 * @typedef {LoggerConsoleOptions}
 *
 * @property {Boolean} [enabled=false] Whether to enable console logging.
 * @property {LoggerLevel} [level="info"] The level of logging to output to the console.
 */

/**
 * @typedef {LoggerFileOptions}
 *
 * @property {String} path Where the log file should be saved.
 * @property {Boolean} [enabled=false] Whether to enable console logging.
 * @property {LoggerLevel} [level="info"] The level of logging to output to the console.
 */

/**
 * A factory that configures and returns a Logger constructor.
 *
 * @param {LoggerOptions} [initialOpts] Configuration for the logger.
 * @param {Object} [Raven] A pre-configured server-side Raven npm package instance, for reporting errors to Sentry.io
 * @returns {Function} A constructor used to create discrete logger instances.
 */
module.exports = function (initialOpts, Raven) {
	initialOpts = initialOpts || {};
	initialOpts.console = initialOpts.console || {};
	initialOpts.file = initialOpts.file || {};

	const loggerColors = mapObject(LoggerLevel, (key, value) => [key, value.color]);
	const loggerLevels = mapObject(LoggerLevel, (key, value) => [key, value.level]);

	const replacer = (key, value) => {
		if (typeof value === 'bigint') {
			return value.toString();
		}

		if (value instanceof Buffer) {
			return value.toString('base64');
		}

		if (value instanceof Error) {
			return {
				name: value.name,
				message: value.message,
				stack: value.stack
			};
		}

		return value;
	};

	const createFormat = colorize => {
		const h = (input, color) => colorize ? color(input) : input;

		const formats = [
			winston.format.timestamp({format: 'mediumTime'}),
			winston.format.errors({stack: true}),
			winston.format.splat(),
			winston.format.printf(
				({label, level, message, stack, timestamp, ...rest}) => {
					let result = `[${timestamp}] `;

					if (label) {
						result += `${h(label, colors.bold)} `;
					}

					result += `${level}: ${message}`;

					if (stack) {
						result += `\n${indentString(h(stack, colors.gray), 4)}`;
					}

					if (Object.keys(rest).length > 0) {
						result += `\n${indentString(h(JSON.stringify(rest, replacer, 4), colors.gray), 4)}`;
					}

					return result;
				}
			)
		];

		if (colorize) {
			formats.unshift(winston.format.colorize());
		}

		return winston.format.combine(...formats);
	};

	const consoleTransport = new winston.transports.Console({
		level: objectPath.get(initialOpts, 'console.level', 'info'),
		silent: !initialOpts.console.enabled,
		stderrLevels: ['warn', 'error'],
		format: createFormat(true)
	});

	const fileTransport = new winston.transports.File({
		filename: objectPath.get(initialOpts, 'file.path', 'logs/nodecg.log'),
		level: objectPath.get(initialOpts, 'file.level', 'info'),
		silent: !initialOpts.file.enabled,
		format: createFormat(false)
	});

	const mainLogger = winston.createLogger({
		transports: [consoleTransport, fileTransport],
		handleExceptions: true,
		levels: loggerLevels
	});

	winston.addColors(loggerColors);

	class Logger {
		/**
		 * Constructs a new Logger instance that prefixes all output with the given name.
		 *
		 * @param {String} name The label to prefix all output of this logger with.
		 */
		constructor(name) {
			this.name = name;

			this.childLogger = mainLogger.child({
				label: this.name
			});
		}

		trace(...args) {
			this.childLogger.trace(...args);
		}

		debug(...args) {
			this.childLogger.debug(...args);
		}

		info(...args) {
			this.childLogger.info(...args);
		}

		warn(...args) {
			this.childLogger.warn(...args);
		}

		error(...args) {
			this.childLogger.error(...args);

			if (Raven) {
				const formattedArgs = args.map(
					argument => typeof argument === 'object' ?
						util.inspect(argument, {depth: null, showProxy: true}) :
						argument
				);

				Raven.captureException(new Error(`[${this.name}] ${util.format(...formattedArgs)}`), {
					logger: 'server @nodecg/logger'
				});
			}
		}

		replicants(...args) {
			if (!Logger._shouldLogReplicants) {
				return;
			}

			this.childLogger.info(...args);
		}

		static globalReconfigure(opts) {
			configure(opts);
		}
	}

	function configure(opts = {}) {
		opts.console = opts.console || {};
		opts.file = opts.file || {};

		if (typeof opts.console.enabled !== 'undefined') {
			consoleTransport.silent = !opts.console.enabled;
		}

		if (typeof opts.console.level !== 'undefined') {
			consoleTransport.level = opts.console.level;
		}

		if (typeof opts.file.enabled !== 'undefined') {
			fileTransport.silent = !opts.file.enabled;
		}

		if (typeof opts.file.level !== 'undefined') {
			fileTransport.level = opts.file.level;
		}

		if (typeof opts.file.path !== 'undefined') {
			fileTransport.filename = opts.file.path;

			// Make logs folder if it does not exist.
			if (!fs.existsSync(path.dirname(opts.file.path))) {
				fs.mkdirpSync(path.dirname(opts.file.path));
			}
		}

		if (typeof opts.replicants !== 'undefined') {
			Logger._shouldLogReplicants = opts.replicants;
		}
	}

	Logger._winston = mainLogger;
	Logger._shouldLogReplicants = Boolean(initialOpts.replicants);

	configure(initialOpts);

	process.on('unhandledRejection', error => {
		mainLogger.error(error);
	});

	return Logger;
};
