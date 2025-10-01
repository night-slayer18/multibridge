import { Db } from "mongodb";
import logger from "../utils/loggers";

export async function executeMongoQuery(connection: Db, query: any): Promise<any> {
    const { collection, method, args } = query;
    if (!collection || !method) {
      throw new Error("Invalid MongoDB query structure. Expected { collection, method, args }.");
    }
    const dbCollection = connection.collection(collection);
    const fn = (dbCollection as any)[method];
    if (typeof fn !== "function") {
      throw new Error(`Method ${method} does not exist on MongoDB collection ${collection}`);
    }
    try {
      // call the function with the collection as `this` to maintain context
      return await fn.apply(dbCollection, args);
    } catch (error) {
      logger.error(`Error executing MongoDB query: ${(error as Error).message}`);
      throw error;
    }
  }