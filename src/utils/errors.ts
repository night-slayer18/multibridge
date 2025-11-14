/**
 * Custom error classes for MultiBridge
 * Provides consistent error handling throughout the codebase
 */

export class MultiBridgeError extends Error {
  constructor(message: string, public readonly code: string, public readonly context?: Record<string, any>) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class TenantContextError extends MultiBridgeError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, "TENANT_CONTEXT_ERROR", context);
  }
}

export class ConnectionError extends MultiBridgeError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, "CONNECTION_ERROR", context);
  }
}

export class ConfigurationError extends MultiBridgeError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, "CONFIGURATION_ERROR", context);
  }
}

export class ValidationError extends MultiBridgeError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, "VALIDATION_ERROR", context);
  }
}

export class QueryError extends MultiBridgeError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, "QUERY_ERROR", context);
  }
}

export class TimeoutError extends MultiBridgeError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, "TIMEOUT_ERROR", context);
  }
}

