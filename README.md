# MultiBridge

MultiBridge is a multi-tenant database connection manager that supports PostgreSQL, MySQL, MongoDB, and Cassandra. It provides utilities for managing tenant-specific database connections and executing queries in a tenant-aware context.

## Features

- Multi-tenant database connection management
- Supports PostgreSQL, MySQL, MongoDB, and Cassandra
- Connection pooling for efficient resource usage
- Tenant context management using `AsyncLocalStorage`
- Utility functions for executing queries in a tenant-aware context

## Installation

Install the package via npm:

```bash
npm install multibrige
```

## Usage

### Configuration

Create a `.env` file in your project's root directory with the following environment variables:

```env
CENTRAL_DB_HOST=localhost
CENTRAL_DB_PORT=5432
CENTRAL_DB_USER=admin
CENTRAL_DB_PASSWORD=password
CENTRAL_DB_NAME=central_db
LOG_LEVEL=info
```

### Tenant Context Management

Use the `runWithTenant` function to execute code in a tenant-aware context:

```typescript
import { runWithTenant, ConnectVo } from "multibrige";

const tenant: ConnectVo = {
  appid: "appB",
  orgid: "org123",
  appdbname: "schema2",
};

await runWithTenant(tenant, async () => {
  // Your tenant-aware code here
});
```

### Executing Queries

Use the `executeQuery` function to execute queries in a tenant-aware context:

```typescript
import { executeQuery } from "multibrige";

const result = await executeQuery("SELECT * FROM users WHERE id = $1", [userId]);
console.log(result);
```

### Closing Connections

Use the `closeConnection` and `closeAllConnections` functions to close database connections:

```typescript
import { closeConnection, closeAllConnections } from "multibrige";

// Close connection for the current tenant
await closeConnection();

// Close all connections
await closeAllConnections();
```

## Project Structure

- `src/config`: Configuration files for environment variables and database connections
- `src/connections`: Database connection management for PostgreSQL, MySQL, MongoDB, and Cassandra
- `src/context`: Tenant context management using `AsyncLocalStorage`
- `src/helpers`: Helper functions for executing queries on MongoDB and Cassandra
- `src/utils`: Utility functions, including query execution and logging

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.