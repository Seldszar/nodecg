const path = require('path');
const Sequelize = require('sequelize');
const Umzug = require('umzug');

let sequelize;

class Replicant extends Sequelize.Model { }
class Session extends Sequelize.Model { }
class Token extends Sequelize.Model { }

async function setup(options) {
	sequelize = process.env.NODECG_TEST ?
		new Sequelize({logging: false, dialect: 'sqlite'}) :
		new Sequelize({logging: false, ...options});

	const umzug = new Umzug({
		storage: 'sequelize',
		storageOptions: {
			sequelize
		},
		migrations: {
			path: path.resolve(__dirname, 'migrations'),
			params: [sequelize, Sequelize]
		}
	});

	Replicant.init(
		{
			name: {
				type: Sequelize.STRING,
				primaryKey: true
			},
			value: Sequelize.TEXT
		},
		{
			timestamps: false,
			sequelize
		}
	);

	Session.init(
		{
			sessionId: {
				type: Sequelize.STRING,
				primaryKey: true
			},
			expiresAt: Sequelize.DATE,
			data: Sequelize.TEXT
		},
		{
			timestamps: false,
			sequelize
		}
	);

	Token.init(
		{
			provider: Sequelize.STRING,
			userId: Sequelize.STRING,
			token: Sequelize.STRING
		},
		{
			timestamps: false,
			sequelize
		}
	);

	await sequelize.sync();
	await umzug.up();
}

module.exports = {
	get sequelize() {
		return sequelize;
	},
	setup,
	models: {
		Replicant,
		Session,
		Token
	}
};
