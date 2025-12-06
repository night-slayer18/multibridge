# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-12-06

### Added

#### Core Features
- **Multi-tenant database connection management** with support for PostgreSQL, MySQL, MongoDB, and Cassandra
- **Tenant context management** using `AsyncLocalStorage` for automatic connection routing
- **Centralized configuration** via PostgreSQL central database
- **Connection pooling** for efficient resource usage across all supported databases
- **Connection caching** with LRU (Least Recently Used) eviction policy
- **Configurable cache TTL** for connection and configuration caching

#### ORM Integration
- **Sequelize adapter** for PostgreSQL and MySQL with automatic schema/database routing
- **TypeORM adapter** for PostgreSQL, MySQL, and MongoDB with entity support
- **Mongoose adapter** for MongoDB with connection management
- **Cassandra ORM-like adapter** with CRUD helpers and model definitions
- ORM instance caching per tenant for optimal performance

#### Performance & Reliability
- **Connection retry logic** with exponential backoff for transient failures
- **Rate limiting** to prevent excessive connection creation attempts
- **Query timeouts** with configurable timeouts per database type
- **Lazy connection validation** to reduce overhead
- **Race condition prevention** using promise-based locking for connection creation
- **Connection statistics** API for monitoring and debugging

#### Security
- **SQL injection prevention** with schema name sanitization for PostgreSQL
- **CQL injection prevention** with identifier sanitization for Cassandra
- **Input validation** for tenant identifiers (appid, orgid, appdbname)
- **Password sanitization** in logs for MongoDB connection strings

#### Error Handling
- **Custom error classes** for better error handling:
  - `MultiBridgeError` - Base error class
  - `TenantContextError` - Tenant context related errors
  - `ConnectionError` - Connection related errors
  - `ConfigurationError` - Configuration related errors
  - `ValidationError` - Validation related errors
  - `QueryError` - Query execution errors
  - `TimeoutError` - Timeout related errors
- **Enhanced error logging** with context, stack traces, and tenant information

#### Utilities
- **Enhanced logging** with Winston, including structured logging with context
- **Configuration cache management** with invalidation and clearing utilities
- **Graceful shutdown** functions for all connection types
- **Connection lifecycle management** with automatic cleanup

#### Documentation
- **Comprehensive EXAMPLE.md** with:
  - Controller and service layer patterns
  - ORM integration examples for all supported ORMs
  - Model organization best practices
  - Error handling patterns
  - Complete server setup examples

### Changed

#### Connection Management
- **Eager connection establishment** by default in `runWithTenant` (connections are established when tenant context is set)
- **Connection lifecycle** - connections remain in cache after `runWithTenant` completes (not closed, just removed from thread context)
- **Connection validation** now uses lazy validation with TTL to reduce overhead
- **Connection cache** migrated from simple Map to LRU cache with configurable size and TTL

#### Configuration
- **Environment variable support** for:
  - Connection pool sizes (PostgreSQL, MySQL)
  - Query timeouts (per database type)
  - Cache configuration (max size, TTL)
  - Retry configuration (attempts, delay)
  - Rate limiting configuration

#### Type Safety
- **Improved type definitions** for query parameters and results
- **Discriminated unions** for better type safety in `executeQuery`
- **ORM type exports** for better IDE support

### Fixed

#### Critical Bugs
- **Race conditions** during connection creation - fixed with promise-based locking
- **Memory leaks** from unbounded connection cache - fixed with LRU cache implementation
- **SQL injection vulnerabilities** in PostgreSQL schema names - fixed with sanitization
- **CQL injection vulnerabilities** in Cassandra identifiers - fixed with sanitization
- **Connection validation overhead** - fixed with lazy validation and TTL
- **Error masking** in query execution - fixed with proper error context preservation

#### ORM Adapters
- **Sequelize type error** - fixed `SequelizeOptions` import to use `Options` type (Sequelize v6 compatibility)
- **TypeORM MongoDB options** - removed invalid `useUnifiedTopology` property
- **Mongoose connection timeout** - added timeout handling to prevent indefinite hangs
- **Cassandra identifier validation** - improved sanitization and reserved word checking

#### Query Execution
- **PostgreSQL/MySQL result format handling** - improved handling of different database result formats
- **Query timeout cleanup** - fixed timeout cleanup in error scenarios
- **Error context in catch blocks** - fixed potential cascading errors when retrieving connection during error handling

### Security

- **SQL Injection Prevention**: Added schema name sanitization for PostgreSQL
- **CQL Injection Prevention**: Added identifier sanitization for Cassandra (keyspace, table, column names)
- **Input Validation**: Added validation for tenant identifiers with length and pattern checks
- **Password Sanitization**: Passwords are now sanitized in log messages

### Performance

- **Connection Caching**: Implemented LRU cache with configurable size and TTL
- **Configuration Caching**: Added caching for central database configuration lookups
- **Lazy Validation**: Connection validation only occurs when needed (based on TTL)
- **Connection Pooling**: Configurable pool sizes for PostgreSQL and MySQL
- **Rate Limiting**: Prevents excessive connection creation attempts
- **Retry Logic**: Exponential backoff for transient connection failures

### Documentation

- **EXAMPLE.md**: Comprehensive usage guide with:
  - Complete project structure examples
  - Controller and service layer patterns
  - ORM integration examples (Sequelize, TypeORM, Mongoose, Cassandra)
  - Model organization patterns
  - Error handling best practices
  - Server setup and graceful shutdown examples

## [1.0.0] - Initial Release

### Added

- Initial release of MultiBridge
- Basic multi-tenant database connection management
- Support for PostgreSQL, MySQL, MongoDB, and Cassandra
- Tenant context management with `runWithTenant`
- Basic query execution with `executeQuery`
- Central database configuration lookup
- Basic connection pooling

---

## Types of Changes

- **Added** for new features
- **Changed** for changes in existing functionality
- **Deprecated** for soon-to-be removed features
- **Removed** for now removed features
- **Fixed** for any bug fixes
- **Security** for vulnerability fixes
- **Performance** for performance improvements

---

## Migration Guide

### From 1.0.0 to 1.0.1

#### Connection Lifecycle Changes

In version 1.0.1, connections are now cached and reused across `runWithTenant` calls. Connections are no longer closed when `runWithTenant` completes - they remain in the cache for reuse.

**Before (1.0.0):**
```typescript
await runWithTenant(tenant, async () => {
  // Connection created
  await executeQuery("SELECT * FROM users");
  // Connection closed after this block
});
```

**After (1.0.1):**
```typescript
await runWithTenant(tenant, async () => {
  // Connection created and cached
  await executeQuery("SELECT * FROM users");
  // Connection remains in cache, removed from thread context
});

// Next call with same tenant reuses cached connection
await runWithTenant(tenant, async () => {
  // Reuses cached connection
  await executeQuery("SELECT * FROM todos");
});
```

#### Eager Connection Establishment

Connections are now established eagerly by default when `runWithTenant` is called. If you need lazy connection establishment, you can use the `lazyConnection` option:

```typescript
await runWithTenant(tenant, async () => {
  // Connection established eagerly
}, { lazyConnection: false }); // Default

await runWithTenant(tenant, async () => {
  // Connection established only when first query is executed
}, { lazyConnection: true });
```

#### New Environment Variables

Version 1.0.1 introduces new optional environment variables for fine-tuning:

```env
# Connection Caching
CONNECTION_CACHE_MAX_SIZE=100
CONNECTION_CACHE_TTL_MS=3600000
CONFIG_CACHE_TTL_MS=300000

# Connection Pooling
POSTGRES_POOL_MAX=20
POSTGRES_POOL_MIN=5
MYSQL_POOL_MAX=10
MYSQL_QUEUE_LIMIT=0

# Query Timeouts
QUERY_TIMEOUT_MS=30000
POSTGRES_QUERY_TIMEOUT_MS=30000
MYSQL_QUERY_TIMEOUT_MS=30000
MONGODB_QUERY_TIMEOUT_MS=30000
CASSANDRA_QUERY_TIMEOUT_MS=30000

# Connection Validation
CONNECTION_VALIDATION_TTL_MS=300000

# Retry Configuration
CONNECTION_RETRY_ATTEMPTS=3
CONNECTION_RETRY_DELAY_MS=1000

# Rate Limiting
RATE_LIMIT_MAX_REQUESTS=10
RATE_LIMIT_WINDOW_MS=1000
```

#### Error Handling

Version 1.0.1 introduces custom error classes. Update your error handling:

```typescript
import {
  MultiBridgeError,
  TenantContextError,
  ConnectionError,
  QueryError,
  TimeoutError,
} from "multibridge";

try {
  await runWithTenant(tenant, async () => {
    await executeQuery("SELECT * FROM users");
  });
} catch (error) {
  if (error instanceof TenantContextError) {
    // Handle tenant context errors
  } else if (error instanceof ConnectionError) {
    // Handle connection errors
  } else if (error instanceof QueryError) {
    // Handle query errors
  } else if (error instanceof TimeoutError) {
    // Handle timeout errors
  }
}
```

#### ORM Integration

Version 1.0.1 adds ORM adapter support. To use ORMs, install the corresponding peer dependencies:

```bash
# For Sequelize
npm install sequelize pg mysql2

# For TypeORM
npm install typeorm pg mysql2 mongodb

# For Mongoose
npm install mongoose

# Cassandra driver is already included
```

Then use the ORM adapters:

```typescript
import { getSequelizeInstance } from "multibridge";

await runWithTenant(tenant, async () => {
  const sequelize = await getSequelizeInstance();
  // Use Sequelize as normal
});
```

---

## Contributing

When contributing to this project, please update the CHANGELOG.md file with your changes under the appropriate section (Added, Changed, Fixed, etc.) in the [Unreleased] section. When releasing a new version, move the changes to the appropriate version section.

---

## Links

- [GitHub Repository](https://github.com/night-slayer18/multibridge)
- [Issue Tracker](https://github.com/night-slayer18/multibridge/issues)
- [Documentation](https://github.com/night-slayer18/multibridge#readme)

