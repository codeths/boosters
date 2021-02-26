/* eslint-disable no-unused-vars */
// TODO: fix that ^
const keys = require('./keys.json');
const {
	PORT,
	MAILGUN_API_KEY,
	MAILGUN_DOMAIN
} = keys;

const crypto = require('crypto');
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const querystring = require('querystring');
const hbs = require('hbs');
const path = require('path');
const morgan = require('morgan');

const {sendEmail} = require('./email');
const {generateImage} = require('./svg');

const app = express();
app.use(bodyParser.urlencoded({
	extended: false
}));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(morgan('tiny'));

// Handlebars setup
app.set('view engine', 'hbs');
app.engine('html', hbs.__express);

const server = app.listen(PORT, () => {
	const host = server.address().address;
	const port = server.address().port;

	console.log('LISTEN %s %s', host, port);
});

const EMAIL_REGEX = /^[\w.!#$%&’*+/=?^`{|}~-]+@[a-zA-Z\d-]+(?:\.[a-zA-Z\d-]+)*$/;

// Handle form submit to generate a new card

app.get('/generate', async (request, response) => {
	const {
		query
	} = request;
	const {
		ok,
		status
	} = query;
	let data = {};
	if (ok && status) {
		data = {
			ok,
			status
		};
	}

	response.render('pages/generate', data);
});

async function handleForm(email, name) {
	console.log(email, name);
	const image = await generateImage(email, name);
	sendEmail('...');
}

app.post('/generate', async (request, response) => {
	if (process.env.B_SECRET) {
		const secret = request.cookies.SECRET;
		if (secret !== process.env.B_SECRET) {
			response.redirect('/authenticate.html');
			return;
		}
	}

	const {
		body
	} = request;
	const {
		email,
		name
	} = body;
	if (!email || !name) {
		console.log('BAD FORM');
		return response.status(400).redirect('/generate?' + querystring.stringify({
			ok: false,
			status: 'Invalid form content.'
		}));
	}

	if (!EMAIL_REGEX.test(email)) {
		console.log('BAD EMAIL ADDRESS');
		return response.redirect('/generate?' + querystring.stringify({
			ok: false,
			status: 'Invalid email.'
		}));
	}

	// PASS TO EMAIL HANDLER
	handleForm(email, name);

	response.redirect('/generate?' + querystring.stringify({
		ok: true,
		status: 'Sent email.'
	}));
});

if ((!process.env.B_SECRET) && (!process.env.B_SUPPRESS_SECRET_WARNING)) {
	console.error('In production, B_SECRET should be set to require user authentication.');
	console.error('Set B_SUPPRESS_SECRET_WARNING to hide this message in development.');
}

app.post('/authenticate.html', (request, response) => {
	if (!process.env.B_SECRET) {
		response.writeHead(200);
		response.write('No authentication required. (If this is a production environment, please let someone know!)');
		response.end();
		return;
	}

	if (request.body.secret === process.env.B_SECRET) {
		response.cookie('SECRET', request.body.secret, {
			maxAge: 24 * 60 * 60 * 2,
			httpOnly: true,
			secure: process.env.B_USING_HTTPS !== undefined
		});
		response.writeHead(200);
		response.write('That looks right, have a nice day!<br><a href="/">Back to start</a>');
		response.end();
		return;
	}

	console.error(`Spooky! Someone at ${request.socket.remoteAddress} tried to authenticate with an invalid secret (${request.body.secret}).`);
	response.writeHead(401);
	response.write('That doesn\'t look quite right, sorry.<br><a href="/authenticate.html">Try again</a>');
	response.end();
});

app.use('/', express.static(path.join(__dirname, 'static')));
