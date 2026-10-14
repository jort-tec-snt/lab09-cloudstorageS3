'use strict';

require('dotenv').config();
const { loadConfig } = require('./config');
const { createApp } = require('./app');
const { createS3Client } = require('./services/s3');

let config;
try {
  config = loadConfig(process.env);
} catch (err) {
  console.error(`[config] ${err.message}`);
  process.exit(1);
}

const app = createApp({ s3: createS3Client(config.region), config });
app.listen(config.port, () => {
  console.log(`API escuchando en el puerto ${config.port}`);
});
