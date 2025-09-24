/**
 * 🎯 Global Error Handler Middleware
 * Captures all HTTP errors and sends alerts for 5xx responses
 */

import { Request, Response, NextFunction } from 'express';
import { errorAlerter } from '../observability/errorAlerter';
import { getClientIp } from '../utils/ip';

/**
 * Global error handling middleware - captures all uncaught errors
 */
export function globalErrorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  const statusCode = err.status || err.statusCode || 500;
  const clientIP = getClientIp(req);
  const userAgent = req.get('User-Agent');
  
  // Record error for alerting (5xx errors)
  if (statusCode >= 500) {
    errorAlerter.recordError(statusCode, req.path, userAgent, clientIP);
  }
  
  // Log error details
  console.error(`[${statusCode}] ${req.method} ${req.path} - ${err.message}`, {
    ip: clientIP,
    userAgent: userAgent,
    stack: err.stack,
    timestamp: new Date().toISOString()
  });
  
  // Send error response
  const errorResponse: any = {
    success: false,
    error: statusCode >= 500 ? 'Internal server error' : err.message,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  };
  
  // Add more details in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.details = err.message;
    errorResponse.stack = err.stack;
  }
  
  res.status(statusCode).json(errorResponse);
}

/**
 * Response interceptor to track successful responses and detect 5xx from route handlers
 */
export function responseErrorInterceptor(req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json;
  const originalStatus = res.status;
  const originalSend = res.send;
  
  let statusCode = 200;
  
  // Intercept status() calls
  res.status = function(code: number) {
    statusCode = code;
    return originalStatus.call(this, code);
  };
  
  // Intercept json() calls
  res.json = function(obj: any) {
    // Record error if status is 5xx
    if (statusCode >= 500) {
      const clientIP = getClientIp(req);
      const userAgent = req.get('User-Agent');
      errorAlerter.recordError(statusCode, req.path, userAgent, clientIP);
    }
    return originalJson.call(this, obj);
  };
  
  // Intercept send() calls
  res.send = function(body: any) {
    // Record error if status is 5xx
    if (statusCode >= 500) {
      const clientIP = getClientIp(req);
      const userAgent = req.get('User-Agent');
      errorAlerter.recordError(statusCode, req.path, userAgent, clientIP);
    }
    return originalSend.call(this, body);
  };
  
  next();
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `The requested resource ${req.method} ${req.path} was not found`,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  });
}