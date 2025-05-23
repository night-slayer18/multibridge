import logger from "../utils/loggers";

export async function executeMongoQuery(connection: any, query: any): Promise<any> {
    const { collection, method, args } = query;
    if (!collection || !method) {
      throw new Error("Invalid MongoDB query structure. Expected { collection, method, args }.");
    }
    const dbCollection = connection.collection(collection);
    if (typeof dbCollection[method] !== "function") {
      throw new Error(`Method ${method} does not exist on MongoDB collection ${collection}`);
    }
    try {
      return await dbCollection[method](...args);
    }
    catch (error) {
      logger.error(`Error executing MongoDB query: ${(error as Error).message}`);
      throw error;
    }
  }