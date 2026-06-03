import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import { ErrorHandler, asyncHandler } from './error.middleware.js';

/**
 * Protect routes — verifies JWT from Authorization header.
 * Attaches the authenticated user to req.user.
 */
export const protect = asyncHandler(async (req, res, next) => {
  let token;

  // Check for Bearer token in Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new ErrorHandler('Not authorized. No token provided.', 401));
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach user to request (exclude password)
    req.user = await User.findById(decoded.id);

    if (!req.user) {
      return next(new ErrorHandler('User not found with this token.', 401));
    }

    next();
  } catch (error) {
    return next(new ErrorHandler('Not authorized. Token is invalid.', 401));
  }
});

/**
 * Authorize specific roles.
 * Must be used after the protect middleware.
 * @param  {...string} roles - Allowed roles (e.g., 'admin', 'customer')
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new ErrorHandler(`Role '${req.user.role}' is not authorized to access this resource`, 403)
      );
    }
    next();
  };
};
