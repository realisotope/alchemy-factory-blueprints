/**
 * Centralized Error Handler
 */

export const ERROR_CODES = {
  INVALID_INPUT: { code: 4001, message: 'Invalid input provided' },
  INVALID_FILE: { code: 4002, message: 'Invalid file type or format' },
  FILE_TOO_LARGE: { code: 4003, message: 'File is too large' },
  INVALID_UUID: { code: 4004, message: 'Invalid blueprint ID' },
  MISSING_REQUIRED_FIELD: { code: 4005, message: 'Missing required field' },

  UNAUTHORIZED: { code: 4010, message: 'You must be logged in' },
  FORBIDDEN: { code: 4011, message: 'You do not have permission' },
  NOT_FOUND: { code: 4012, message: 'Resource not found' },

  RATE_LIMITED: { code: 4020, message: 'Too many requests. Please wait before trying again' },

  DATABASE_ERROR: { code: 5001, message: 'Database operation failed' },
  PARSER_ERROR: { code: 5002, message: 'Failed to parse blueprint' },
  STORAGE_ERROR: { code: 5003, message: 'Failed to store file' },
  UNKNOWN_ERROR: { code: 5000, message: 'An unexpected error occurred' },
};

export const ERROR_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

function categorizeError(error) {
  const message = error.message?.toLowerCase() || '';
  const name = error.name?.toLowerCase() || '';

  if (message.includes('network') || message.includes('fetch')) {
    return 'NETWORK_ERROR';
  }

  if (message.includes('unauthorized') || message.includes('auth')) {
    return 'UNAUTHORIZED';
  }

  if (message.includes('database') || message.includes('supabase')) {
    return 'DATABASE_ERROR';
  }

  if (message.includes('parse') || name.includes('syntaxerror')) {
    return 'PARSER_ERROR';
  }

  if (message.includes('invalid') || message.includes('validation')) {
    return 'INVALID_INPUT';
  }

  return 'UNKNOWN_ERROR';
}

function sanitizeErrorMessage(error, category) {
  for (const [key, value] of Object.entries(ERROR_CODES)) {
    if (category === key) {
      return value.message;
    }
  }

  return ERROR_CODES.UNKNOWN_ERROR.message;
}

function getSeverity(category) {
  const criticalErrors = ['DATABASE_ERROR', 'STORAGE_ERROR', 'UNKNOWN_ERROR'];
  const highErrors = ['PARSER_ERROR', 'NETWORK_ERROR'];
  const mediumErrors = ['INVALID_INPUT', 'FORBIDDEN', 'RATE_LIMITED'];

  if (criticalErrors.includes(category)) return ERROR_SEVERITY.CRITICAL;
  if (highErrors.includes(category)) return ERROR_SEVERITY.HIGH;
  if (mediumErrors.includes(category)) return ERROR_SEVERITY.MEDIUM;
  return ERROR_SEVERITY.LOW;
}

export function logError(error, context, meta = {}) {
  const timestamp = new Date().toISOString();
  const isDev = import.meta.env.DEV;

  const logEntry = {
    timestamp,
    context,
    message: error.message,
    stack: error.stack,
    category: categorizeError(error),
    meta,
  };

  if (isDev) {
    console.error(`[${context}]`, error);
    console.table(logEntry);
  } else {
    try {
      console.error(JSON.stringify(logEntry));
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
  }
}

// Main error handler
export function handleError(error, context, meta = {}) {
  const err = error instanceof Error ? error : new Error(String(error));
  const category = categorizeError(err);
  const severity = getSeverity(category);

  logError(err, context, meta);

  return {
    success: false,
    error: {
      code: ERROR_CODES[category]?.code || 5000,
      message: sanitizeErrorMessage(err, category),
      category,
      severity,
      timestamp: new Date().toISOString(),
      ...(import.meta.env?.DEV && { context, stack: err.stack }),
    },
  };
}

// Wraps async functions with error handling
export function withErrorHandling(fn, context) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      return handleError(error, context, { args: args[0]?.name || 'unknown' });
    }
  };
}

export function createError(code, meta = {}) {
  const errorDef = ERROR_CODES[code];
  if (!errorDef) {
    throw new Error(`Unknown error code: ${code}`);
  }

  const error = new Error(errorDef.message);
  error.code = errorDef.code;
  error.category = code;
  error.meta = meta;
  return error;
}

export function validate(value, rules, fieldName) {
  if (rules.required && (value === null || value === undefined || value === '')) {
    throw createError('MISSING_REQUIRED_FIELD', { field: fieldName });
  }

  if (rules.minLength && typeof value === 'string' && value.length < rules.minLength) {
    throw createError('INVALID_INPUT', {
      field: fieldName,
      min: rules.minLength,
    });
  }

  if (rules.maxLength && typeof value === 'string' && value.length > rules.maxLength) {
    throw createError('INVALID_INPUT', {
      field: fieldName,
      max: rules.maxLength,
    });
  }

  if (rules.pattern && !rules.pattern.test(value)) {
    throw createError('INVALID_INPUT', { field: fieldName });
  }

  if (rules.custom && !rules.custom(value)) {
    throw createError('INVALID_INPUT', { field: fieldName });
  }
}

export function handleSuccess(data, message = 'Success') {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  };
}
