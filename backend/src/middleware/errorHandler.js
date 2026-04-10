import { env } from '../config/env.js';
import { ApiError } from '../utils/apiError.js';

export function notFoundHandler(req, res, next) {
  next(new ApiError(`Route ${req.originalUrl} not found`, 404));
}

export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || err.status || 500;
  const isOperational = err instanceof ApiError;

  if (statusCode >= 500 || !isOperational) {
    console.error(err);
  }

  const response = {
    error: statusCode >= 500 && !isOperational
      ? 'Internal server error'
      : err.message || 'Internal server error',
  };

  if (err.details) {
    response.errors = err.details;
  }

  if (env.nodeEnv === 'development' && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}
