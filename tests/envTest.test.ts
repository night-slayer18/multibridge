import dotenv from "dotenv";
import path from "path";

// Directly specify the path to your .env file
const envPath = path.resolve(__dirname, "../.env");
dotenv.config({ path: envPath });

console.log("CENTRAL_DB_HOST:", process.env.CENTRAL_DB_HOST);
console.log("CENTRAL_DB_PORT:", process.env.CENTRAL_DB_PORT);
console.log("CENTRAL_DB_USER:", process.env.CENTRAL_DB_USER);
console.log("CENTRAL_DB_PASSWORD:", process.env.CENTRAL_DB_PASSWORD);
console.log("CENTRAL_DB_NAME:", process.env.CENTRAL_DB_NAME);
