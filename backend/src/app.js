'use strict';

const express = require('express');
const cors = require('cors');
const { createS3Service } = require('./services/s3');
const { createImagesRouter } = require('./routes/images');

/**
 * @param {{ s3: object, config: object }} deps  s3 = S3Client (real o falso).
 */
function createApp({ s3, config }) {
  const app = express();
  app.disable('x-powered-by');

  app.use(cors({ origin: config.corsOrigins, methods: ['GET', 'POST', 'DELETE'] }));
  app.use(express.json({ limit: '10kb' }));

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  const service = createS3Service({
    client: s3,
    bucket: config.bucket,
    keyPrefix: config.keyPrefix,
    uploadExpiresSeconds: config.uploadExpiresSeconds,
    viewExpiresSeconds: config.viewExpiresSeconds,
  });
  app.use('/api', createImagesRouter({ service, config }));

  app.use((req, res) => res.status(404).json({ error: 'No encontrado' }));

  // Manejador central: sin stack ni detalles de AWS.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
    if (status >= 500) console.error(`[error] ${err.name || 'Error'}`);
    const message =
      status === 500 ? 'Error interno' : err.name === 'ValidationError' ? err.message : status === 400 ? 'Solicitud inválida' : 'Error';
    res.status(status).json({ error: message });
  });

  return app;
}

module.exports = { createApp };
