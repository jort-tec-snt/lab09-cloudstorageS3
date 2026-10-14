'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const { validateUploadRequest, validateKey } = require('../validation');

function createImagesRouter({ service, config }) {
  const router = express.Router();

  const uploadLimiter = rateLimit({
    windowMs: config.uploadRateLimit.windowMs,
    limit: config.uploadRateLimit.limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiadas solicitudes, intenta más tarde' },
  });

  router.post('/upload-url', uploadLimiter, async (req, res, next) => {
    try {
      const data = validateUploadRequest(req.body);
      res.json(await service.createUploadUrl(data));
    } catch (err) {
      next(err);
    }
  });

  router.get('/images', async (req, res, next) => {
    try {
      res.json(await service.listImages());
    } catch (err) {
      next(err);
    }
  });

  // Express 5: req.params.key es un array de segmentos.
  router.delete('/images/*key', async (req, res, next) => {
    try {
      const raw = req.params.key;
      const key = validateKey(Array.isArray(raw) ? raw.join('/') : String(raw));
      await service.deleteImage(key);
      res.json({ deleted: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createImagesRouter };
