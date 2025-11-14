# MultiBridge

[![npm version](https://img.shields.io/npm/v/multibridge)](https://www.npmjs.com/package/multibridge)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

MultiBridge is a powerful multi-tenant database connection framework that supports PostgreSQL, MySQL, MongoDB, and Cassandra. It provides a unified interface for managing tenant-specific database connections with automatic routing, connection pooling, caching, and ORM integration.

## ✨ Features

### Core Capabilities
- 🏢 **Multi-tenant database connection management** with automatic tenant routing
- 🗄️ **Multi-database support**: PostgreSQL, MySQL, MongoDB, and Cassandra
- 🔄 **Connection pooling** with configurable pool sizes
- 💾 **LRU connection caching** with TTL for optimal performance
- 🔒 **Tenant context management** using `AsyncLocalStorage`
- ⚡ **Eager connection establishment** for better performance
- 🔐 **SQL injection prevention** with automatic sanitization
- ⏱️ **Query timeouts** with configurable timeouts per database type
- 🔁 **Automatic retry logic** with exponential backoff
- 🚦 **Rate limiting** to prevent connection exhaustion

### ORM Integration
- 🔌 **Sequelize adapter** for PostgreSQL and MySQL
- 🔌 **TypeORM adapter** for PostgreSQL, MySQL, and MongoDB
- 🔌 **Mongoose adapter** for MongoDB
- 🔌 **Cassandra ORM-like adapter** with CRUD helpers

### Developer Experience
- 📝 **TypeScript support** with full type definitions
- 🎯 **Custom error classes** for better error handling
- 📊 **Connection statistics** API for monitoring
- 📚 **Comprehensive documentation** with examples
- 🛡️ **Input validation** for tenant identifiers
- 📋 **Structured logging** with Winston

## 📦 Installation

```bash
npm install multibridge
```

### Optional ORM Dependencies

Install ORM packages as needed (they are peer dependencies):

```bash
# For Sequelize
npm install sequelize pg mysql2

# For TypeORM
npm install typeorm pg mysql2 mongodb

# For Mongoose
npm install mongoose

# Cassandra driver is included as a dependency
```

## 🚀 Quick Start

### 1. Configuration

Create a `.env` file in your project root:

```env
# Central Database Configuration (PostgreSQL)
CENTRAL_DB_HOST=localhost
CENTRAL_DB_PORT=5432
CENTRAL_DB_USER=admin
CENTRAL_DB_PASSWORD=password
CENTRAL_DB_NAME=central_db
CENTRAL_DB_TABLE=connections_config

# Logging
LOG_LEVEL=info

# Optional: Performance Tuning
CONNECTION_CACHE_MAX_SIZE=100
CONNECTION_CACHE_TTL_MS=3600000
POSTGRES_POOL_MAX=20
POSTGRES_POOL_MIN=5
MYSQL_POOL_MAX=10
QUERY_TIMEOUT_MS=30000
```

### 2. Basic Usage

```typescript
import { runWithTenant, executeQuery, ConnectVo } from "multibridge";

const tenant: ConnectVo = {
  appid: "myApp",
  orgid: "org123",
  appdbname: "tenant_db",
};

// Execute queries in tenant context
await runWithTenant(tenant, async () => {
  // PostgreSQL/MySQL
  const users = await executeQuery("SELECT * FROM users WHERE id = ?", [userId]);
  
  // MongoDB
  const user = await executeQuery({
    collection: "users",
    method: "findOne",
    args: [{ email: "user@example.com" }],
  });
  
  // Cassandra
  const data = await executeQuery(
    "SELECT * FROM users WHERE user_id = ?",
    [userId]
  );
});
```

### 3. ORM Integration

#### Sequelize

```typescript
import { runWithTenant, getSequelizeInstance } from "multibridge";
import { Sequelize } from "sequelize";

await runWithTenant(tenant, async () => {
  const sequelize = await getSequelizeInstance();
  const User = sequelize.define("User", {
    username: Sequelize.STRING,
    email: Sequelize.STRING,
  });
  
  const users = await User.findAll();
});
```

#### TypeORM

```typescript
import { runWithTenant, getTypeORMDataSource } from "multibridge";
import { User } from "./entities/User";

await runWithTenant(tenant, async () => {
  const dataSource = await getTypeORMDataSource({
    entities: [User],
  });
  
  const userRepo = dataSource.getRepository(User);
  const users = await userRepo.find();
});
```

#### Mongoose

```typescript
import { runWithTenant, getMongooseConnection } from "multibridge";
import { Schema } from "mongoose";

await runWithTenant(tenant, async () => {
  const connection = await getMongooseConnection();
  const User = connection.model("User", new Schema({
    username: String,
    email: String,
  }));
  
  const users = await User.find();
});
```

#### Cassandra

```typescript
import { runWithTenant, getCassandraClient, insert, select } from "multibridge";

await runWithTenant(tenant, async () => {
  const client = await getCassandraClient();
  
  // Insert
  await insert(client, "users", {
    user_id: "123",
    username: "john",
    email: "john@example.com",
  });
  
  // Select
  const users = await select(client, "users", ["user_id", "username"], {
    user_id: "123",
  });
});
```

## 📖 Documentation

For comprehensive examples and detailed usage patterns, see:

- **[EXAMPLE.md](./EXAMPLE.md)** - Complete usage guide with controllers, services, ORM integration, and best practices
- **[CHANGELOG.md](./CHANGELOG.md)** - Version history and migration guides

## 🔧 API Reference

### Core Functions

#### `runWithTenant(tenant, callback, options?)`

Execute code within a tenant context.

```typescript
await runWithTenant(tenant, async () => {
  // Your code here
}, { lazyConnection: false }); // Default: false (eager connection)
```

#### `executeQuery(query, params?)`

Execute a query in the current tenant context.

```typescript
// SQL (PostgreSQL/MySQL)
await executeQuery("SELECT * FROM users WHERE id = ?", [userId]);

// MongoDB
await executeQuery({
  collection: "users",
  method: "findOne",
  args: [{ email: "user@example.com" }],
});

// Cassandra
await executeQuery("SELECT * FROM users WHERE user_id = ?", [userId]);
```

#### `getConnection()`

Get the current tenant's database connection.

```typescript
const { connection, dbType, config } = await getConnection();
```

#### `getConnectionStats()`

Get connection statistics for monitoring.

```typescript
const stats = getConnectionStats();
console.log(stats.activeConnections);
console.log(stats.cachedConnections);
```

### ORM Adapters

#### Sequelize

- `getSequelizeInstance(options?)` - Get Sequelize instance
- `closeSequelizeInstance(tenant?)` - Close instance for tenant
- `closeAllSequelizeInstances()` - Close all instances

#### TypeORM

- `getTypeORMDataSource(options?)` - Get TypeORM DataSource
- `closeTypeORMDataSource(tenant?)` - Close DataSource for tenant
- `closeAllTypeORMDataSources()` - Close all DataSources

#### Mongoose

- `getMongooseConnection(options?)` - Get Mongoose connection
- `closeMongooseConnection(tenant?)` - Close connection for tenant
- `closeAllMongooseConnections()` - Close all connections

#### Cassandra

- `getCassandraClient()` - Get Cassandra client
- `executeCQL(query, params?)` - Execute CQL query
- `createTable(client, model)` - Create table from model
- `insert(client, table, data)` - Insert data
- `select(client, table, columns, where?)` - Select data
- `update(client, table, data, where)` - Update data
- `remove(client, table, where)` - Delete data
- `closeCassandraClient(tenant?)` - Close client for tenant
- `closeAllCassandraClients()` - Close all clients

### Error Handling

MultiBridge provides custom error classes:

```typescript
import {
  MultiBridgeError,
  TenantContextError,
  ConnectionError,
  ConfigurationError,
  ValidationError,
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

## ⚙️ Configuration Options

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CENTRAL_DB_HOST` | Central database host | `localhost` |
| `CENTRAL_DB_PORT` | Central database port | `5432` |
| `CENTRAL_DB_USER` | Central database user | - |
| `CENTRAL_DB_PASSWORD` | Central database password | - |
| `CENTRAL_DB_NAME` | Central database name | - |
| `CENTRAL_DB_TABLE` | Configuration table name | `connections_config` |
| `LOG_LEVEL` | Logging level | `info` |
| `CONNECTION_CACHE_MAX_SIZE` | Max cached connections | `100` |
| `CONNECTION_CACHE_TTL_MS` | Connection cache TTL | `3600000` (1 hour) |
| `POSTGRES_POOL_MAX` | PostgreSQL max pool size | `20` |
| `POSTGRES_POOL_MIN` | PostgreSQL min pool size | `5` |
| `MYSQL_POOL_MAX` | MySQL max pool size | `10` |
| `QUERY_TIMEOUT_MS` | Default query timeout | `30000` (30s) |
| `CONNECTION_RETRY_ATTEMPTS` | Retry attempts | `3` |
| `CONNECTION_RETRY_DELAY_MS` | Retry delay | `1000` (1s) |
| `RATE_LIMIT_MAX_REQUESTS` | Rate limit max requests | `10` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `1000` (1s) |

See [EXAMPLE.md](./EXAMPLE.md) for complete configuration options.

## 🏗️ Architecture

### Project Structure

```
src/
├── config/          # Configuration management
│   ├── dbConfig.ts  # Central database configuration
│   └── envConfig.ts # Environment variable configuration
├── connections/     # Database connection management
│   ├── connectionManager.ts  # Core connection manager
│   ├── postgres.ts  # PostgreSQL connection
│   ├── mysql.ts     # MySQL connection
│   ├── mongodb.ts   # MongoDB connection
│   └── cassandra.ts # Cassandra connection
├── context/         # Tenant context management
│   └── tenantContext.ts
├── helpers/         # Database-specific helpers
│   ├── mongodbHelper.ts
│   └── cassandraHelper.ts
├── orm/             # ORM adapters
│   ├── sequelize.ts
│   ├── typeorm.ts
│   ├── mongoose.ts
│   └── cassandra.ts
├── utils/           # Utility functions
│   ├── executeQuery.ts
│   ├── errors.ts
│   ├── loggers.ts
│   ├── lruCache.ts
│   └── rateLimiter.ts
└── types/           # TypeScript type definitions
    └── dbTypes.ts
```

### How It Works

1. **Tenant Context**: `runWithTenant` establishes a tenant context using `AsyncLocalStorage`
2. **Configuration Lookup**: MultiBridge queries the central database to get tenant-specific connection details
3. **Connection Caching**: Connections are cached using LRU cache with TTL
4. **Query Execution**: `executeQuery` automatically routes queries to the correct tenant database
5. **ORM Integration**: ORM adapters use MultiBridge's connection management

## 🔒 Security

- ✅ **SQL Injection Prevention**: Automatic schema name sanitization
- ✅ **CQL Injection Prevention**: Identifier sanitization for Cassandra
- ✅ **Input Validation**: Tenant identifier validation
- ✅ **Password Sanitization**: Passwords are sanitized in logs
- ✅ **Type Safety**: Full TypeScript support for type safety

## ⚡ Performance

- 🚀 **Connection Caching**: LRU cache with configurable size and TTL
- 🚀 **Configuration Caching**: Central DB config caching
- 🚀 **Connection Pooling**: Configurable pool sizes
- 🚀 **Lazy Validation**: Connection validation only when needed
- 🚀 **Race Condition Prevention**: Promise-based locking
- 🚀 **Rate Limiting**: Prevents connection exhaustion

## 🧪 Example Project Structure

```
my-app/
├── src/
│   ├── controllers/
│   │   └── userController.ts
│   ├── services/
│   │   └── userService.ts
│   ├── models/
│   │   ├── sequelize/
│   │   │   └── User.ts
│   │   └── typeorm/
│   │       └── User.entity.ts
│   ├── routes/
│   │   └── userRoutes.ts
│   └── server.ts
├── .env
└── package.json
```

See [EXAMPLE.md](./EXAMPLE.md) for complete examples.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with TypeScript for type safety
- Uses Winston for structured logging
- Supports popular ORMs: Sequelize, TypeORM, Mongoose

## 📞 Support

- 📖 [Documentation](./EXAMPLE.md)
- 🐛 [Issue Tracker](https://github.com/night-slayer18/multibridge/issues)
- 💬 [GitHub Discussions](https://github.com/night-slayer18/multibridge/discussions)

---

Made with ❤️ by [Samanuai A](https://github.com/night-slayer18)
