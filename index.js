const stream = require('stream');
const https = require('https');
const url = require('url');

function setupStream(inputURL, outputStream, reconnectInfo = { trys: 5, downloaded: 0, total: 0 }) {
	if(outputStream._destroyed) return;
	if(reconnectInfo.trys === 0) {
		outputStream.emit('error', new Error('too many reconnects'));
		return;
	}

	outputStream.destroy = () => {
		outputStream._destroyed = true;
		if(inputStream) {
			inputStream.unpipe();
			inputStream.destroy();
		}
	};

	let inputStream;
	https.get(inputURL, res => {
		if(outputStream._destroyed) return;
		inputStream = res;

		if(reconnectInfo.downloaded === 0) {
			reconnectInfo.total = parseInt(inputStream.headers['content-length']);
		}

		inputStream.on('data', chunk => {
			reconnectInfo.downloaded += chunk.length;
		});

		inputStream.on('end', () => {
			if(reconnectInfo.downloaded < reconnectInfo.total) {
				inputStream.unpipe();
				reconnectInfo.trys -= 1;

				inputURL.headers = { Range: `bytes=${reconnectInfo.downloaded}-` };

				setupStream(inputURL, outputStream, reconnectInfo);
			} else {
				outputStream.end();
			}
		});

		inputStream.on('error', err => {
			if(!error) return;
			if(error.message === "read ECONNRESET") return;

			outputStream.emit('error', err);
		})

		inputStream.pipe(outputStream, { end : false });
	});
}

module.exports = inputURL => {
	let outputStream = new stream.PassThrough();
	setupStream(url.parse(inputURL), outputStream);

	return outputStream;
};
