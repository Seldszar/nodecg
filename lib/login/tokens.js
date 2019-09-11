'use strict';

const extend = require('extend');
const UnauthorizedError = require('./UnauthorizedError');
const uuid = require('uuid').v4;

const {models} = require('../database');

function authorize(options) {
	const defaults = {
		success(data, accept) {
			if (data.request) {
				accept();
			} else {
				accept(null, true);
			}
		},
		fail(error, data, accept) {
			if (data.request) {
				accept(error);
			} else {
				accept(null, false);
			}
		}
	};

	const auth = extend(defaults, options);

	return async function (data, accept) {
		const req = data.request || data;
		const authorizationHeader = (req.headers || {}).authorization;

		let token;
		let error;

		if (authorizationHeader) {
			const parts = authorizationHeader.split(' ');
			if (parts.length === 2) {
				const scheme = parts[0];
				const credentials = parts[1];

				if (/^Bearer$/i.test(scheme)) {
					token = credentials;
				}
			} else {
				error = new UnauthorizedError('credentials_bad_format', {
					message: 'Format is Authorization: Bearer [token]'
				});

				return auth.fail(error, data, accept);
			}
		}

		// Get the token from query string.
		if (req._query && req._query.token) {
			token = req._query.token;
		} else if (req.query && req.query.token) {
			token = req.query.token;
		}

		if (!token) {
			error = new UnauthorizedError('credentials_required', {
				message: 'No authorization token was found'
			});

			return auth.fail(error, data, accept);
		}

		try {
			const result = await models.Token.findOne({
				where: {token}
			});

			if (result) {
				return auth.success({...data, token}, accept);
			}

			error = new UnauthorizedError('invalid_token', {
				message: 'Token could not be found'
			});

			return auth.fail(error, data, accept);
		} catch (err) {
			return auth.fail(new UnauthorizedError('internal_error', error), data, accept);
		}
	};
}

// Attempt to find an existing token for the provided search parmeters.
// If found, return that token.
// If not, make a new token (just a uuid string).
async function findOrCreate(where) {
	const [result] = await models.Token.findCreateFind({
		where,
		defaults: {
			token: uuid()
		}
	});

	return result.get('token');
}

async function find(where) {
	const result = await models.Token.findOne({
		where
	});

	return result && result.get('token');
}

async function regenerate(token) {
	const result = await models.Token.findOne({
		where: {token}
	});

	if (result) {
		await result.update({
			token: uuid()
		});

		return result.get('token');
	}

	throw new Error(`Could not find existing token ${token}`);
}

module.exports.findOrCreate = findOrCreate;
module.exports.find = find;
module.exports.authorize = authorize;
module.exports.regenerate = regenerate;
