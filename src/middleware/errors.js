const mongoose = require('mongoose');

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// Permet d'utiliser des handlers async sans try/catch partout
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function notFound(req, res) {
  res.status(404).json({ erreur: `Route introuvable : ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ erreur: err.message, ...(err.details && { details: err.details }) });
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.fromEntries(Object.entries(err.errors).map(([champ, e]) => [champ, e.message]));
    return res.status(400).json({ erreur: 'Données invalides', details });
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ erreur: `Valeur invalide pour "${err.path}" : ${JSON.stringify(err.value)}` });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ erreur: 'JSON mal formé' });
  }
  console.error(err);
  res.status(500).json({ erreur: 'Erreur interne du serveur' });
}

module.exports = { HttpError, asyncHandler, notFound, errorHandler };
