import { Db } from "mongodb";
import logger from "../utils/loggers";
import { QueryError, ValidationError } from "../utils/errors";

// Whitelist of allowed MongoDB collection methods for security
const ALLOWED_MONGODB_METHODS = new Set([
  "find",
  "findOne",
  "findOneAndUpdate",
  "findOneAndReplace",
  "findOneAndDelete",
  "insertOne",
  "insertMany",
  "updateOne",
  "updateMany",
  "deleteOne",
  "deleteMany",
  "countDocuments",
  "estimatedDocumentCount",
  "distinct",
  "aggregate",
  "bulkWrite",
  "createIndex",
  "createIndexes",
  "dropIndex",
  "dropIndexes",
  "listIndexes",
  "indexExists",
  "indexInformation",
]);

export async function executeMongoQuery(connection: Db, query: any): Promise<any> {
  const { collection, method, args } = query;
  
  if (!collection || !method) {
    throw new ValidationError("Invalid MongoDB query structure. Expected { collection, method, args }.", {
      query,
    });
  }

  // Validate method is in whitelist
  if (!ALLOWED_MONGODB_METHODS.has(method)) {
    throw new ValidationError(
      `Method '${method}' is not allowed. Allowed methods: ${Array.from(ALLOWED_MONGODB_METHODS).join(", ")}`,
      { collection, method }
    );
  }

  const dbCollection = connection.collection(collection);
  const fn = (dbCollection as any)[method];
  
  if (typeof fn !== "function") {
    throw new QueryError(`Method ${method} does not exist on MongoDB collection ${collection}`, {
      collection,
      method,
    });
  }

  try {
    // call the function with the collection as `this` to maintain context
    return await fn.apply(dbCollection, args);
  } catch (error) {
    logger.error(`Error executing MongoDB query: ${(error as Error).message}`, {
      collection,
      method,
      error: (error as Error).stack,
    });
    throw new QueryError(`MongoDB query execution failed: ${(error as Error).message}`, {
      collection,
      method,
      originalError: error,
    });
  }
}