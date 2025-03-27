# Example Usage of MultiBridge

This example demonstrates how to use the `multibridge` package in a Node.js backend project to perform CRUD operations using multiple databases. We will use MongoDB for authentication (login/signup) and MySQL for CRUD operations related to a TODO app.

## Prerequisites

1. Ensure you have a central database with the required configuration to identify which database to connect to.
2. Create a `.env` file in your project's root directory with the following environment variables:

```env
CENTRAL_DB_HOST=localhost
CENTRAL_DB_PORT=5432
CENTRAL_DB_USER=admin
CENTRAL_DB_PASSWORD=password
CENTRAL_DB_NAME=central_db
CENTRAL_DB_TABLE=connections_config
LOG_LEVEL=info
```

## Project Structure

```
.
├── src
│   ├── controllers
│   │   ├── authController.ts
│   │   └── todoController.ts
│   ├── routes
│   │   ├── authRoutes.ts
│   │   └── todoRoutes.ts
│   ├── server.ts
│   └── config
│       └── dbConfig.ts
├── .env
└── package.json
```

## Example Code

### Authentication (Login/Signup) using MongoDB

#### authController.ts

```typescript
import { Request, Response } from "express";
import { runWithTenant, ConnectVo } from "multibridge";
import { executeQuery } from "multibridge";

const tenant: ConnectVo = {
  appid: "authApp",
  orgid: "org123",
  appdbname: "authDB",
};

export const signup = async (req: Request, res: Response) => {
  const { username, password } = req.body;

  await runWithTenant(tenant, async () => {
    const query = {
      collection: "users",
      method: "insertOne",
      args: [{ username, password }],
    };
    await executeQuery(query);
    res.status(201).send("User signed up successfully");
  });
};

export const login = async (req: Request, res: Response) => {
  const { username, password } = req.body;

  await runWithTenant(tenant, async () => {
    const query = {
      collection: "users",
      method: "findOne",
      args: [{ username, password }],
    };
    const user = await executeQuery(query);
    if (user) {
      res.status(200).send("Login successful");
    } else {
      res.status(401).send("Invalid credentials");
    }
  });
};
```

#### authRoutes.ts

```typescript
import { Router } from "express";
import { signup, login } from "../controllers/authController";

const router = Router();

router.post("/signup", signup);
router.post("/login", login);

export default router;
```

### CRUD Operations for TODO App using MySQL

#### todoController.ts

```typescript
import { Request, Response } from "express";
import { runWithTenant, ConnectVo } from "multibridge";
import { executeQuery } from "multibridge";

const tenant: ConnectVo = {
  appid: "todoApp",
  orgid: "org123",
  appdbname: "todoDB",
};

export const createTodo = async (req: Request, res: Response) => {
  const { title, description } = req.body;

  await runWithTenant(tenant, async () => {
    const query = "INSERT INTO todos (title, description) VALUES (?, ?)";
    await executeQuery(query, [title, description]);
    res.status(201).send("TODO created successfully");
  });
};

export const getTodos = async (req: Request, res: Response) => {
  await runWithTenant(tenant, async () => {
    const query = "SELECT * FROM todos";
    const todos = await executeQuery(query);
    res.status(200).json(todos);
  });
};

export const updateTodo = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, description } = req.body;

  await runWithTenant(tenant, async () => {
    const query = "UPDATE todos SET title = ?, description = ? WHERE id = ?";
    await executeQuery(query, [title, description, id]);
    res.status(200).send("TODO updated successfully");
  });
};

export const deleteTodo = async (req: Request, res: Response) => {
  const { id } = req.params;

  await runWithTenant(tenant, async () => {
    const query = "DELETE FROM todos WHERE id = ?";
    await executeQuery(query, [id]);
    res.status(200).send("TODO deleted successfully");
  });
};
```

#### todoRoutes.ts

```typescript
import { Router } from "express";
import { createTodo, getTodos, updateTodo, deleteTodo } from "../controllers/todoController";

const router = Router();

router.post("/todos", createTodo);
router.get("/todos", getTodos);
router.put("/todos/:id", updateTodo);
router.delete("/todos/:id", deleteTodo);

export default router;
```

### Server Setup

#### server.ts

```typescript
import express from "express";
import authRoutes from "./routes/authRoutes";
import todoRoutes from "./routes/todoRoutes";

const app = express();

app.use(express.json());
app.use("/auth", authRoutes);
app.use("/api", todoRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
```

## Running the Project

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the server:

   ```bash
   npm start
   ```

This example demonstrates how to use the `multibridge` package to manage multiple databases without writing separate code for each database connection or query execution. The central database contains the required configuration to identify which database to connect to, allowing you to focus on your application logic.