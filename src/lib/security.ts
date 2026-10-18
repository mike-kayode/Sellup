/**
 * Security utilities for Sell Up
 * CSRF, XSS, SQL Injection protection, and security headers
 */

import crypto from 'crypto';

/**
 * Generate CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Verify CSRF token
 */
export function verifyCsrfToken(token: string, stored: string): boolean {
  return crypto.timingSafeEqual(
    Buffer.from(token),
    Buffer.from(stored)
  );
}

/**
 * Sanitize input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[!@#$%^&*]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*)');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Hash password with bcrypt (use crypto.subtle in production)
 */
export async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import('bcrypt');
  return bcrypt.hash(password, 10);
}

/**
 * Compare password with hash
 */
export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  const bcrypt = await import('bcrypt');
  return bcrypt.compare(password, hash);
}

/**
 * Generate secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Validate phone number format
 */
export function isValidPhoneNumber(phone: string): boolean {
  const phoneRegex = /^[\d\s\-\+\(\)]{10,20}$/;
  return phoneRegex.test(phone);
}

/**
 * Sanitize phone number
 */
export function sanitizePhoneNumber(phone: string): string {
  return phone
    .replace(/\D/g, '') // Remove non-digits
    .slice(-10); // Take last 10 digits
}

/**
 * Check for SQL injection patterns
 */
export function hasSqlInjectionPattern(input: string): boolean {
  const sqlPatterns = [
    /(\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi,
    /--/,
    /\/\*/,
    /\*\//,
    /;/,
    /\x00/,
  ];

  return sqlPatterns.some((pattern) => pattern.test(input));
}

/**
 * Generate API key
 */
export function generateApiKey(): { key: string; hash: string } {
  const key = `nbjz_${crypto.randomBytes(32).toString('hex')}`;
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  return { key, hash };
}

/**
 * Verify API key
 */
export function verifyApiKey(
  provided: string,
  stored: string
): boolean {
  const hash = crypto.createHash('sha256').update(provided).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(stored));
}

/**
 * Security headers for responses
 */
export function getSecurityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;",
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  };
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  timestamp: string;
  action: string;
  userId?: string;
  storeId?: string;
  target: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  status: 'success' | 'failure';
}

/**
 * Log security event
 */
export async function logAuditEvent(
  entry: AuditLogEntry
): Promise<void> {
  // In production, save to database
  console.log('[AUDIT LOG]', {
    ...entry,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Detect suspicious activity
 */
export function isSuspiciousActivity(
  failedAttempts: number,
  timeWindow: number
): boolean {
  // Flag as suspicious if more than 5 failed attempts in 15 minutes
  return failedAttempts > 5 && timeWindow < 15 * 60 * 1000;
}

/**
 * Rate limit key from request
 */
export function getRateLimitKey(
  req: any,
  type: 'ip' | 'user' | 'email' = 'ip'
): string {
  if (type === 'user' && req.userId) {
    return `${type}:${req.userId}`;
  } else if (type === 'email' && req.email) {
    return `${type}:${req.email}`;
  }

  const ip =
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.headers['x-real-ip'] ||
    req.ip ||
    'unknown';

  return `${type}:${ip}`;
}

/**
 * Encrypt sensitive data using AES-256-CBC with a key-derived IV.
 * The key is passed as a string; a 32-byte key and 16-byte IV are derived
 * deterministically from it via SHA-256 (constant IV for the same key).
 * Output format: <iv_hex>:<cipher_hex>
 */
export function encryptSensitiveData(
  data: string,
  key: string
): string {
  const keyBuf = crypto.createHash('sha256').update(key).digest();
  const iv = keyBuf.subarray(0, 16);
  const cipher = crypto.createCipheriv('aes-256-cbc', keyBuf, iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt sensitive data encrypted by encryptSensitiveData.
 */
export function decryptSensitiveData(
  encrypted: string,
  key: string
): string {
  const [ivHex, cipherHex] = encrypted.split(':');
  const keyBuf = crypto.createHash('sha256').update(key).digest();
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuf, iv);
  let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
