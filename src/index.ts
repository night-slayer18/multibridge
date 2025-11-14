import { runWithTenant, ConnectVo } from "./context/tenantContext";
import { getConnection, closeConnection, closeAllConnections, getConnectionStats } from "./connections/connectionManager";
import { executeQuery } from "./utils/executeQuery";
import { closeCentralDB, invalidateConfigCache, clearConfigCache } from "./config/dbConfig";

// Export the public API
export {
  runWithTenant,
  ConnectVo,
  getConnection,
  closeConnection,
  closeAllConnections,
  getConnectionStats,
  executeQuery,
  closeCentralDB,
  invalidateConfigCache,
  clearConfigCache,
};

// Export error classes for error handling
export {
  MultiBridgeError,
  TenantContextError,
  ConnectionError,
  ConfigurationError,
  ValidationError,
  QueryError,
  TimeoutError,
} from "./utils/errors";

// Export ORM adapters
export {
  // Sequelize
  getSequelizeInstance,
  closeSequelizeInstance,
  closeAllSequelizeInstances,
  // TypeORM
  getTypeORMDataSource,
  closeTypeORMDataSource,
  closeAllTypeORMDataSources,
  // Mongoose
  getMongooseConnection,
  closeMongooseConnection,
  closeAllMongooseConnections,
  // Cassandra
  getCassandraClient,
  executeCQL,
  createTable,
  insert,
  select,
  update,
  remove,
  closeCassandraClient,
  closeAllCassandraClients,
  // Types
  type ORMInstance,
  type ORMAdapterConfig,
  type CassandraModelDefinition,
} from "./orm";