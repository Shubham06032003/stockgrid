import { matchedData, validationResult } from 'express-validator';
import { ApiError } from '../utils/apiError.js';

export function validateRequest(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return next(new ApiError('Validation failed', 400, errors.array()));
  }

  req.validated = {
    body: matchedData(req, { locations: ['body'], includeOptionals: true }),
    params: matchedData(req, { locations: ['params'], includeOptionals: true }),
    query: matchedData(req, { locations: ['query'], includeOptionals: true }),
  };

  next();
}
