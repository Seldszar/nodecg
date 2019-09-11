const session = require('express-session');
const {models} = require('../database');

class SessionStore extends session.Store {
	constructor(options = {}) {
		options = {
			checkExpirationInterval: options.checkExpirationInterval || 900000,
			expiration: options.expiration || 86400000
		};

		super(options);

		this.options = options;
		this.expirationInterval = setInterval(
			this.clearExpiredSessions.bind(this),
			this.options.checkExpirationInterval
		);

		this.clearExpiredSessions();
	}

	async get(sessionId, callback) {
		const {Session} = models;

		try {
			const session = await Session.findByPk(sessionId);

			callback(null, session ? JSON.parse(session.get('data')) : null);
		} catch (error) {
			callback(error, null);
		}
	}

	async set(sessionId, data, callback) {
		const {Session} = models;
		const expiresAt = this.getExpiresAt(data);

		try {
			const [session, created] = await Session.findCreateFind({
				where: {
					sessionId
				},
				defaults: {
					data: JSON.stringify(data),
					expiresAt
				}
			});

			if (!created) {
				await session.update({
					data: JSON.stringify(data),
					expiresAt
				});
			}

			callback(null, session.data);
		} catch (error) {
			callback(error, null);
		}
	}

	async destroy(sessionId, callback) {
		const {Session} = models;

		try {
			await Session.destroy({
				where: {
					sessionId
				}
			});

			callback(null, null);
		} catch (error) {
			callback(error, null);
		}
	}

	async touch(sessionId, data, callback) {
		const {Session} = models;
		const expiresAt = this.getExpiresAt(data);

		try {
			await Session.update(
				{
					expiresAt
				},
				{
					where: {
						sessionId
					}
				}
			);

			callback(null, null);
		} catch (error) {
			callback(error, null);
		}
	}

	async clearExpiredSessions() {
		const {Session} = models;

		await Session.destroy({
			where: {
				expiresAt: {
					lt: new Date()
				}
			}
		});
	}

	getExpiresAt(data) {
		if (data.cookie && data.cookie.expires) {
			return data.cookie.expires;
		}

		return new Date(Date.now() + this.options.expiration);
	}
}

module.exports = SessionStore;
