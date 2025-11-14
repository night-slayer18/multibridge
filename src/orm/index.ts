/**
 * ORM adapters for MultiBridge
 * Provides integration with popular ORMs while maintaining MultiBridge's connection management
 */

// Sequelize adapter
export {
  getSequelizeInstance,
  closeSequelizeInstance,
  closeAllSequelizeInstances,
} from "./sequelize";

// TypeORM adapter
export {
  getTypeORMDataSource,
  closeTypeORMDataSource,
  closeAllTypeORMDataSources,
} from "./typeorm";

// Mongoose adapter
export {
  getMongooseConnection,
  closeMongooseConnection,
  closeAllMongooseConnections,
} from "./mongoose";

// Cassandra adapter
export {
  getCassandraClient,
  executeCQL,
  createTable,
  insert,
  select,
  update,
  remove,
  closeCassandraClient,
  closeAllCassandraClients,
  type CassandraModelDefinition,
} from "./cassandra";

// Types
export type { ORMInstance, ORMAdapterConfig } from "./types";

