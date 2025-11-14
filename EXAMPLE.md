# MultiBridge - Comprehensive Usage Guide

This guide demonstrates how to use the `multibridge` package in a Node.js backend project for multi-tenant database operations. It covers controllers, services, custom queries, ORM integration, and model organization.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Project Structure](#project-structure)
3. [Basic Setup](#basic-setup)
4. [Controller Layer](#controller-layer)
5. [Service Layer](#service-layer)
6. [Custom Queries with executeQuery](#custom-queries-with-executequery)
7. [ORM Integration](#orm-integration)
   - [Sequelize](#sequelize)
   - [TypeORM](#typeorm)
   - [Mongoose](#mongoose)
   - [Cassandra](#cassandra)
8. [Model Organization](#model-organization)
9. [Error Handling](#error-handling)
10. [Best Practices](#best-practices)

---

## Prerequisites

1. **Central Database**: A PostgreSQL database that stores tenant configuration mapping `appid`, `orgid`, and `appdbname` to actual database connection details.

2. **Environment Variables**: Create a `.env` file in your project root:

```env
# Central Database Configuration
CENTRAL_DB_HOST=localhost
CENTRAL_DB_PORT=5432
CENTRAL_DB_USER=admin
CENTRAL_DB_PASSWORD=password
CENTRAL_DB_NAME=central_db
CENTRAL_DB_TABLE=connections_config

# Logging
LOG_LEVEL=info

# Optional: Connection Pooling & Performance
CONNECTION_CACHE_MAX_SIZE=100
CONNECTION_CACHE_TTL_MS=3600000
POSTGRES_POOL_MAX=20
POSTGRES_POOL_MIN=5
MYSQL_POOL_MAX=10
QUERY_TIMEOUT_MS=30000
```

3. **Install Dependencies**:

```bash
npm install multibridge
# For ORM support (optional, install as needed)
npm install sequelize pg mysql2  # For Sequelize
npm install typeorm pg mysql2 mongodb  # For TypeORM
npm install mongoose  # For Mongoose
npm install cassandra-driver  # For Cassandra
```

---

## Project Structure

```
.
├── src
│   ├── controllers
│   │   ├── authController.ts
│   │   ├── todoController.ts
│   │   └── userController.ts
│   ├── services
│   │   ├── authService.ts
│   │   ├── todoService.ts
│   │   └── userService.ts
│   ├── models
│   │   ├── sequelize
│   │   │   ├── User.ts
│   │   │   └── Todo.ts
│   │   ├── typeorm
│   │   │   ├── User.entity.ts
│   │   │   └── Todo.entity.ts
│   │   ├── mongoose
│   │   │   ├── userSchema.ts
│   │   │   └── todoSchema.ts
│   │   └── cassandra
│   │       ├── userModel.ts
│   │       └── todoModel.ts
│   ├── types
│   │   └── tenant.ts
│   ├── middleware
│   │   └── tenantMiddleware.ts
│   ├── routes
│   │   ├── authRoutes.ts
│   │   ├── todoRoutes.ts
│   │   └── userRoutes.ts
│   └── server.ts
├── .env
└── package.json
```

---

## Basic Setup

### Type Definitions

**`src/types/tenant.ts`**

```typescript
import { ConnectVo } from "multibridge";

export interface TenantInfo extends ConnectVo {
  appid: string;
  orgid: string;
  appdbname: string;
}

// Helper to extract tenant from request (e.g., from headers, JWT, etc.)
export function getTenantFromRequest(req: any): TenantInfo {
  // Example: Extract from headers
  return {
    appid: req.headers["x-app-id"] || req.body.appid,
    orgid: req.headers["x-org-id"] || req.body.orgid,
    appdbname: req.headers["x-app-db-name"] || req.body.appdbname,
  };
}
```

### Tenant Middleware

**`src/middleware/tenantMiddleware.ts`**

```typescript
import { Request, Response, NextFunction } from "express";
import { getTenantFromRequest, TenantInfo } from "../types/tenant";

// Middleware to extract and validate tenant information
export function tenantMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = getTenantFromRequest(req);
    
    if (!tenant.appid || !tenant.orgid || !tenant.appdbname) {
      return res.status(400).json({
        error: "Missing tenant information. Required: appid, orgid, appdbname",
      });
    }
    
    // Attach tenant to request object for use in controllers
    (req as any).tenant = tenant;
    next();
  } catch (error) {
    res.status(500).json({ error: "Failed to extract tenant information" });
  }
}
```

---

## Controller Layer

Controllers handle HTTP requests and delegate business logic to services. They use `runWithTenant` to establish the tenant context.

### Example: Authentication Controller

**`src/controllers/authController.ts`**

```typescript
import { Request, Response } from "express";
import { runWithTenant } from "multibridge";
import { authService } from "../services/authService";
import { TenantInfo } from "../types/tenant";

export class AuthController {
  /**
   * User Signup
   * POST /auth/signup
   */
  static async signup(req: Request, res: Response): Promise<void> {
    const tenant: TenantInfo = (req as any).tenant;
    const { username, email, password } = req.body;

    try {
      await runWithTenant(tenant, async () => {
        const user = await authService.createUser({ username, email, password });
        res.status(201).json({
          success: true,
          data: { userId: user.id, username: user.username },
        });
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || "Signup failed",
      });
    }
  }

  /**
   * User Login
   * POST /auth/login
   */
  static async login(req: Request, res: Response): Promise<void> {
    const tenant: TenantInfo = (req as any).tenant;
  const { username, password } = req.body;

    try {
  await runWithTenant(tenant, async () => {
        const user = await authService.authenticateUser(username, password);
        if (user) {
          res.status(200).json({
            success: true,
            data: { userId: user.id, username: user.username },
          });
        } else {
          res.status(401).json({
            success: false,
            error: "Invalid credentials",
          });
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || "Login failed",
      });
    }
  }
}
```

### Example: Todo Controller

**`src/controllers/todoController.ts`**

```typescript
import { Request, Response } from "express";
import { runWithTenant } from "multibridge";
import { todoService } from "../services/todoService";
import { TenantInfo } from "../types/tenant";

export class TodoController {
  /**
   * Create Todo
   * POST /api/todos
   */
  static async createTodo(req: Request, res: Response): Promise<void> {
    const tenant: TenantInfo = (req as any).tenant;
    const { title, description, priority } = req.body;

    try {
      await runWithTenant(tenant, async () => {
        const todo = await todoService.createTodo({ title, description, priority });
        res.status(201).json({ success: true, data: todo });
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || "Failed to create todo",
      });
    }
  }

  /**
   * Get All Todos
   * GET /api/todos
   */
  static async getTodos(req: Request, res: Response): Promise<void> {
    const tenant: TenantInfo = (req as any).tenant;
    const { status, priority } = req.query;

    try {
      await runWithTenant(tenant, async () => {
        const todos = await todoService.getTodos({
          status: status as string,
          priority: priority as string,
        });
        res.status(200).json({ success: true, data: todos });
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch todos",
      });
    }
  }

  /**
   * Get Todo by ID
   * GET /api/todos/:id
   */
  static async getTodoById(req: Request, res: Response): Promise<void> {
    const tenant: TenantInfo = (req as any).tenant;
    const { id } = req.params;

    try {
      await runWithTenant(tenant, async () => {
        const todo = await todoService.getTodoById(id);
        if (todo) {
          res.status(200).json({ success: true, data: todo });
        } else {
          res.status(404).json({ success: false, error: "Todo not found" });
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch todo",
      });
    }
  }

  /**
   * Update Todo
   * PUT /api/todos/:id
   */
  static async updateTodo(req: Request, res: Response): Promise<void> {
    const tenant: TenantInfo = (req as any).tenant;
    const { id } = req.params;
    const updates = req.body;

    try {
      await runWithTenant(tenant, async () => {
        const todo = await todoService.updateTodo(id, updates);
        res.status(200).json({ success: true, data: todo });
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || "Failed to update todo",
      });
    }
  }

  /**
   * Delete Todo
   * DELETE /api/todos/:id
   */
  static async deleteTodo(req: Request, res: Response): Promise<void> {
    const tenant: TenantInfo = (req as any).tenant;
    const { id } = req.params;

    try {
      await runWithTenant(tenant, async () => {
        await todoService.deleteTodo(id);
        res.status(200).json({ success: true, message: "Todo deleted successfully" });
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || "Failed to delete todo",
      });
    }
  }
}
```

### Routes Setup

**`src/routes/authRoutes.ts`**

```typescript
import { Router } from "express";
import { AuthController } from "../controllers/authController";
import { tenantMiddleware } from "../middleware/tenantMiddleware";

const router = Router();

router.post("/signup", tenantMiddleware, AuthController.signup);
router.post("/login", tenantMiddleware, AuthController.login);

export default router;
```

**`src/routes/todoRoutes.ts`**

```typescript
import { Router } from "express";
import { TodoController } from "../controllers/todoController";
import { tenantMiddleware } from "../middleware/tenantMiddleware";

const router = Router();

router.post("/todos", tenantMiddleware, TodoController.createTodo);
router.get("/todos", tenantMiddleware, TodoController.getTodos);
router.get("/todos/:id", tenantMiddleware, TodoController.getTodoById);
router.put("/todos/:id", tenantMiddleware, TodoController.updateTodo);
router.delete("/todos/:id", tenantMiddleware, TodoController.deleteTodo);

export default router;
```

---

## Service Layer

Services contain business logic and interact with the database. They are called within `runWithTenant` context, so they can use `executeQuery` or ORM adapters directly.

### Example: Auth Service (Using Custom Queries)

**`src/services/authService.ts`**

```typescript
import { executeQuery } from "multibridge";
import bcrypt from "bcrypt";

export const authService = {
  /**
   * Create a new user
   */
  async createUser(data: { username: string; email: string; password: string }) {
    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Insert user using custom SQL query
    const query = "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?) RETURNING id, username, email";
    const result = await executeQuery(query, [data.username, data.email, hashedPassword]);

    // PostgreSQL returns rows array
    if (Array.isArray(result) && result.length > 0) {
      return result[0];
    }
    // MySQL returns [rows, fields]
    if (Array.isArray(result) && result[0] && Array.isArray(result[0]) && result[0].length > 0) {
      return result[0][0];
    }

    throw new Error("Failed to create user");
  },

  /**
   * Authenticate user
   */
  async authenticateUser(username: string, password: string) {
    // Find user by username
    const query = "SELECT id, username, email, password_hash FROM users WHERE username = ? LIMIT 1";
    const result = await executeQuery(query, [username]);

    let user: any;
    // Handle different database result formats
    if (Array.isArray(result) && result.length > 0) {
      user = result[0];
    } else if (Array.isArray(result) && result[0] && Array.isArray(result[0]) && result[0].length > 0) {
      user = result[0][0];
    }

    if (!user) {
      return null;
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return null;
    }

    // Return user without password
    delete user.password_hash;
    return user;
  },
};
```

### Example: Todo Service (Using Custom Queries)

**`src/services/todoService.ts`**

```typescript
import { executeQuery } from "multibridge";

export const todoService = {
  /**
   * Create a new todo
   */
  async createTodo(data: { title: string; description?: string; priority?: string }) {
    const query = `
      INSERT INTO todos (title, description, priority, status, created_at)
      VALUES (?, ?, ?, 'pending', NOW())
      RETURNING id, title, description, priority, status, created_at
    `;
    const result = await executeQuery(query, [
      data.title,
      data.description || null,
      data.priority || "medium",
    ]);

    if (Array.isArray(result) && result.length > 0) {
      return result[0];
    }
    if (Array.isArray(result) && result[0] && Array.isArray(result[0]) && result[0].length > 0) {
      return result[0][0];
    }

    throw new Error("Failed to create todo");
  },

  /**
   * Get all todos with optional filters
   */
  async getTodos(filters: { status?: string; priority?: string }) {
    let query = "SELECT * FROM todos WHERE 1=1";
    const params: any[] = [];

    if (filters.status) {
      query += " AND status = ?";
      params.push(filters.status);
    }

    if (filters.priority) {
      query += " AND priority = ?";
      params.push(filters.priority);
    }

    query += " ORDER BY created_at DESC";

    const result = await executeQuery(query, params);

    // Handle different database result formats
    if (Array.isArray(result) && result.length > 0 && !Array.isArray(result[0])) {
      return result;
    }
    if (Array.isArray(result) && result[0] && Array.isArray(result[0])) {
      return result[0];
    }

    return [];
  },

  /**
   * Get todo by ID
   */
  async getTodoById(id: string) {
    const query = "SELECT * FROM todos WHERE id = ? LIMIT 1";
    const result = await executeQuery(query, [id]);

    if (Array.isArray(result) && result.length > 0) {
      return result[0];
    }
    if (Array.isArray(result) && result[0] && Array.isArray(result[0]) && result[0].length > 0) {
      return result[0][0];
    }

    return null;
  },

  /**
   * Update todo
   */
  async updateTodo(id: string, updates: Partial<{ title: string; description: string; status: string; priority: string }>) {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.title !== undefined) {
      fields.push("title = ?");
      values.push(updates.title);
    }
    if (updates.description !== undefined) {
      fields.push("description = ?");
      values.push(updates.description);
    }
    if (updates.status !== undefined) {
      fields.push("status = ?");
      values.push(updates.status);
    }
    if (updates.priority !== undefined) {
      fields.push("priority = ?");
      values.push(updates.priority);
    }

    if (fields.length === 0) {
      throw new Error("No fields to update");
    }

    fields.push("updated_at = NOW()");
    values.push(id);

    const query = `UPDATE todos SET ${fields.join(", ")} WHERE id = ? RETURNING *`;
    const result = await executeQuery(query, values);

    if (Array.isArray(result) && result.length > 0) {
      return result[0];
    }
    if (Array.isArray(result) && result[0] && Array.isArray(result[0]) && result[0].length > 0) {
      return result[0][0];
    }

    throw new Error("Failed to update todo");
  },

  /**
   * Delete todo
   */
  async deleteTodo(id: string) {
    const query = "DELETE FROM todos WHERE id = ?";
    await executeQuery(query, [id]);
  },
};
```

### Example: MongoDB Service (Using executeQuery)

**`src/services/userService.ts`** (MongoDB example)

```typescript
import { executeQuery } from "multibridge";

export const userService = {
  /**
   * Create user in MongoDB
   */
  async createUser(data: { username: string; email: string; profile: any }) {
    const query = {
      collection: "users",
      method: "insertOne",
      args: [{
        username: data.username,
        email: data.email,
        profile: data.profile,
        createdAt: new Date(),
      }],
    };

    const result = await executeQuery(query);
    return result;
  },

  /**
   * Find user by email
   */
  async findUserByEmail(email: string) {
    const query = {
      collection: "users",
      method: "findOne",
      args: [{ email }],
    };

    const result = await executeQuery(query);
    return result;
  },

  /**
   * Update user profile
   */
  async updateUserProfile(userId: string, profile: any) {
    const query = {
      collection: "users",
      method: "updateOne",
      args: [
        { _id: userId },
        { $set: { profile, updatedAt: new Date() } },
      ],
    };

    const result = await executeQuery(query);
    return result;
  },

  /**
   * Get all users with pagination
   */
  async getUsers(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    const query = {
      collection: "users",
      method: "find",
      args: [
        {},
        { limit, skip, sort: { createdAt: -1 } },
      ],
    };

    const result = await executeQuery(query);
    return Array.isArray(result) ? result : [];
  },
};
```

---

## Custom Queries with executeQuery

The `executeQuery` function supports multiple query formats for different database types.

### PostgreSQL/MySQL Queries

```typescript
import { executeQuery } from "multibridge";

// Simple string query
const result = await executeQuery("SELECT * FROM users WHERE id = ?", [userId]);

// SQLQuery object format
const result = await executeQuery({
  type: "sql",
  query: "SELECT * FROM users WHERE email = ?",
  params: [email],
});
```

### MongoDB Queries

```typescript
import { executeQuery } from "multibridge";

// Insert document
await executeQuery({
  collection: "users",
  method: "insertOne",
  args: [{ name: "John", email: "john@example.com" }],
});

// Find documents
const users = await executeQuery({
  collection: "users",
  method: "find",
  args: [{ status: "active" }, { limit: 10 }],
});

// Update document
await executeQuery({
  collection: "users",
  method: "updateOne",
  args: [
    { _id: userId },
    { $set: { status: "inactive" } },
  ],
});

// Aggregation pipeline
const stats = await executeQuery({
  collection: "orders",
  method: "aggregate",
  args: [[
    { $match: { status: "completed" } },
    { $group: { _id: "$userId", total: { $sum: "$amount" } } },
  ]],
});
```

### Cassandra Queries

```typescript
import { executeQuery } from "multibridge";

// Simple CQL query
const result = await executeQuery(
  "SELECT * FROM users WHERE user_id = ?",
  [userId]
);

// CassandraQuery object format
const result = await executeQuery({
  type: "cassandra",
  query: "SELECT * FROM users WHERE email = ? ALLOW FILTERING",
  params: [email],
});
```

---

## ORM Integration

### Sequelize

#### Model Definition

**`src/models/sequelize/User.ts`**

```typescript
import { DataTypes, Model, Optional } from "sequelize";

export interface UserAttributes {
  id: number;
  username: string;
  email: string;
  passwordHash: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserCreationAttributes extends Optional<UserAttributes, "id" | "createdAt" | "updatedAt"> {}

export class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: number;
  public username!: string;
  public email!: string;
  public passwordHash!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static initialize(sequelize: any) {
    User.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        username: {
          type: DataTypes.STRING(100),
          allowNull: false,
          unique: true,
        },
        email: {
          type: DataTypes.STRING(255),
          allowNull: false,
          unique: true,
        },
        passwordHash: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
      },
      {
        sequelize,
        tableName: "users",
        timestamps: true,
      }
    );
  }
}
```

**`src/models/sequelize/Todo.ts`**

```typescript
import { DataTypes, Model, Optional } from "sequelize";

export interface TodoAttributes {
  id: number;
  title: string;
  description?: string;
  status: "pending" | "in_progress" | "completed";
  priority: "low" | "medium" | "high";
  userId?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TodoCreationAttributes extends Optional<TodoAttributes, "id" | "description" | "userId" | "createdAt" | "updatedAt"> {}

export class Todo extends Model<TodoAttributes, TodoCreationAttributes> implements TodoAttributes {
  public id!: number;
  public title!: string;
  public description?: string;
  public status!: "pending" | "in_progress" | "completed";
  public priority!: "low" | "medium" | "high";
  public userId?: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static initialize(sequelize: any) {
    Todo.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        title: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        status: {
          type: DataTypes.ENUM("pending", "in_progress", "completed"),
          defaultValue: "pending",
        },
        priority: {
          type: DataTypes.ENUM("low", "medium", "high"),
          defaultValue: "medium",
        },
        userId: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: "todos",
        timestamps: true,
      }
    );
  }
}
```

#### Service Using Sequelize

**`src/services/sequelizeAuthService.ts`**

```typescript
import { runWithTenant } from "multibridge";
import { getSequelizeInstance } from "multibridge";
import { User } from "../models/sequelize/User";
import { Todo } from "../models/sequelize/Todo";

export const sequelizeAuthService = {
  /**
   * Initialize models (call this once per tenant context)
   */
  async initializeModels() {
    const sequelize = await getSequelizeInstance();
    User.initialize(sequelize);
    Todo.initialize(sequelize);
    
    // Define associations
    User.hasMany(Todo, { foreignKey: "userId", as: "todos" });
    Todo.belongsTo(User, { foreignKey: "userId", as: "user" });
  },

  /**
   * Create user
   */
  async createUser(data: { username: string; email: string; passwordHash: string }) {
    await this.initializeModels();
    const user = await User.create({
      username: data.username,
      email: data.email,
      passwordHash: data.passwordHash,
    });
    return user.toJSON();
  },

  /**
   * Find user by email
   */
  async findUserByEmail(email: string) {
    await this.initializeModels();
    const user = await User.findOne({ where: { email } });
    return user ? user.toJSON() : null;
  },

  /**
   * Get user with todos
   */
  async getUserWithTodos(userId: number) {
    await this.initializeModels();
    const user = await User.findByPk(userId, {
      include: [{ model: Todo, as: "todos" }],
    });
    return user ? user.toJSON() : null;
  },
};

export const sequelizeTodoService = {
  async initializeModels() {
    const sequelize = await getSequelizeInstance();
    Todo.initialize(sequelize);
  },

  /**
   * Create todo
   */
  async createTodo(data: { title: string; description?: string; priority?: string; userId?: number }) {
    await this.initializeModels();
    const todo = await Todo.create({
      title: data.title,
      description: data.description,
      priority: (data.priority || "medium") as any,
      userId: data.userId,
    });
    return todo.toJSON();
  },

  /**
   * Get all todos
   */
  async getTodos(filters: { status?: string; priority?: string; userId?: number }) {
    await this.initializeModels();
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.priority) where.priority = filters.priority;
    if (filters.userId) where.userId = filters.userId;

    const todos = await Todo.findAll({ where, order: [["createdAt", "DESC"]] });
    return todos.map((todo) => todo.toJSON());
  },

  /**
   * Update todo
   */
  async updateTodo(id: number, updates: Partial<{ title: string; description: string; status: string; priority: string }>) {
    await this.initializeModels();
    const todo = await Todo.findByPk(id);
    if (!todo) {
      throw new Error("Todo not found");
    }

    await todo.update(updates);
    return todo.toJSON();
  },

  /**
   * Delete todo
   */
  async deleteTodo(id: number) {
    await this.initializeModels();
    const todo = await Todo.findByPk(id);
    if (!todo) {
      throw new Error("Todo not found");
    }
    await todo.destroy();
  },
};
```

### TypeORM

#### Entity Definitions

**`src/models/typeorm/User.entity.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from "typeorm";
import { Todo } from "./Todo.entity";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 100, unique: true })
  username!: string;

  @Column({ length: 255, unique: true })
  email!: string;

  @Column({ name: "password_hash", length: 255 })
  passwordHash!: string;

  @OneToMany(() => Todo, (todo) => todo.user)
  todos!: Todo[];

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
```

**`src/models/typeorm/Todo.entity.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { User } from "./User.entity";

@Entity("todos")
export class Todo {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 255 })
  title!: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({
    type: "enum",
    enum: ["pending", "in_progress", "completed"],
    default: "pending",
  })
  status!: "pending" | "in_progress" | "completed";

  @Column({
    type: "enum",
    enum: ["low", "medium", "high"],
    default: "medium",
  })
  priority!: "low" | "medium" | "high";

  @Column({ name: "user_id", nullable: true })
  userId?: number;

  @ManyToOne(() => User, (user) => user.todos)
  @JoinColumn({ name: "user_id" })
  user?: User;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
```

#### Service Using TypeORM

**`src/services/typeormAuthService.ts`**

```typescript
import { getTypeORMDataSource } from "multibridge";
import { User } from "../models/typeorm/User.entity";
import { Todo } from "../models/typeorm/Todo.entity";

export const typeormAuthService = {
  /**
   * Create user
   */
  async createUser(data: { username: string; email: string; passwordHash: string }) {
    const dataSource = await getTypeORMDataSource({
      entities: [User, Todo],
    });

    const userRepo = dataSource.getRepository(User);
    const user = userRepo.create({
      username: data.username,
      email: data.email,
      passwordHash: data.passwordHash,
    });

    const savedUser = await userRepo.save(user);
    return savedUser;
  },

  /**
   * Find user by email
   */
  async findUserByEmail(email: string) {
    const dataSource = await getTypeORMDataSource({
      entities: [User, Todo],
    });

    const userRepo = dataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { email } });
    return user;
  },

  /**
   * Get user with todos
   */
  async getUserWithTodos(userId: number) {
    const dataSource = await getTypeORMDataSource({
      entities: [User, Todo],
    });

    const userRepo = dataSource.getRepository(User);
    const user = await userRepo.findOne({
      where: { id: userId },
      relations: ["todos"],
    });
    return user;
  },
};

export const typeormTodoService = {
  /**
   * Create todo
   */
  async createTodo(data: { title: string; description?: string; priority?: string; userId?: number }) {
    const dataSource = await getTypeORMDataSource({
      entities: [User, Todo],
    });

    const todoRepo = dataSource.getRepository(Todo);
    const todo = todoRepo.create({
      title: data.title,
      description: data.description,
      priority: (data.priority || "medium") as any,
      userId: data.userId,
    });

    const savedTodo = await todoRepo.save(todo);
    return savedTodo;
  },

  /**
   * Get all todos
   */
  async getTodos(filters: { status?: string; priority?: string; userId?: number }) {
    const dataSource = await getTypeORMDataSource({
      entities: [User, Todo],
    });

    const todoRepo = dataSource.getRepository(Todo);
    const queryBuilder = todoRepo.createQueryBuilder("todo");

    if (filters.status) {
      queryBuilder.where("todo.status = :status", { status: filters.status });
    }
    if (filters.priority) {
      queryBuilder.andWhere("todo.priority = :priority", { priority: filters.priority });
    }
    if (filters.userId) {
      queryBuilder.andWhere("todo.userId = :userId", { userId: filters.userId });
    }

    queryBuilder.orderBy("todo.createdAt", "DESC");
    const todos = await queryBuilder.getMany();
    return todos;
  },

  /**
   * Update todo
   */
  async updateTodo(id: number, updates: Partial<{ title: string; description: string; status: string; priority: string }>) {
    const dataSource = await getTypeORMDataSource({
      entities: [User, Todo],
    });

    const todoRepo = dataSource.getRepository(Todo);
    const todo = await todoRepo.findOne({ where: { id } });
    if (!todo) {
      throw new Error("Todo not found");
    }

    Object.assign(todo, updates);
    const updatedTodo = await todoRepo.save(todo);
    return updatedTodo;
  },

  /**
   * Delete todo
   */
  async deleteTodo(id: number) {
    const dataSource = await getTypeORMDataSource({
      entities: [User, Todo],
    });

    const todoRepo = dataSource.getRepository(Todo);
    const todo = await todoRepo.findOne({ where: { id } });
    if (!todo) {
      throw new Error("Todo not found");
    }

    await todoRepo.remove(todo);
  },
};
```

### Mongoose

#### Schema Definitions

**`src/models/mongoose/userSchema.ts`**

```typescript
import { Schema, Document } from "mongoose";

export interface IUser extends Document {
  username: string;
  email: string;
  passwordHash: string;
  profile?: {
    firstName?: string;
    lastName?: string;
    avatar?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    profile: {
      firstName: String,
      lastName: String,
      avatar: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
```

**`src/models/mongoose/todoSchema.ts`**

```typescript
import { Schema, Document } from "mongoose";

export interface ITodo extends Document {
  title: string;
  description?: string;
  status: "pending" | "in_progress" | "completed";
  priority: "low" | "medium" | "high";
  userId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const todoSchema = new Schema<ITodo>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    description: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed"],
      default: "pending",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    userId: {
      type: String,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
todoSchema.index({ userId: 1, status: 1 });
todoSchema.index({ createdAt: -1 });
```

#### Service Using Mongoose

**`src/services/mongooseAuthService.ts`**

```typescript
import { getMongooseConnection } from "multibridge";
import { userSchema, IUser } from "../models/mongoose/userSchema";
import { todoSchema, ITodo } from "../models/mongoose/todoSchema";

export const mongooseAuthService = {
  /**
   * Get User model
   */
  async getUserModel() {
    const connection = await getMongooseConnection();
    // Check if model already exists
    if (connection.models.User) {
      return connection.models.User;
    }
    return connection.model<IUser>("User", userSchema);
  },

  /**
   * Create user
   */
  async createUser(data: { username: string; email: string; passwordHash: string; profile?: any }) {
    const User = await this.getUserModel();
    const user = new User({
      username: data.username,
      email: data.email,
      passwordHash: data.passwordHash,
      profile: data.profile,
    });

    const savedUser = await user.save();
    return savedUser.toObject();
  },

  /**
   * Find user by email
   */
  async findUserByEmail(email: string) {
    const User = await this.getUserModel();
    const user = await User.findOne({ email });
    return user ? user.toObject() : null;
  },

  /**
   * Get user with todos
   */
  async getUserWithTodos(userId: string) {
    const User = await this.getUserModel();
    const user = await User.findById(userId);
    if (!user) return null;

    const Todo = await mongooseTodoService.getTodoModel();
    const todos = await Todo.find({ userId: userId.toString() });

    return {
      ...user.toObject(),
      todos: todos.map((todo) => todo.toObject()),
    };
  },
};

export const mongooseTodoService = {
  /**
   * Get Todo model
   */
  async getTodoModel() {
    const connection = await getMongooseConnection();
    if (connection.models.Todo) {
      return connection.models.Todo;
    }
    return connection.model<ITodo>("Todo", todoSchema);
  },

  /**
   * Create todo
   */
  async createTodo(data: { title: string; description?: string; priority?: string; userId?: string }) {
    const Todo = await this.getTodoModel();
    const todo = new Todo({
      title: data.title,
      description: data.description,
      priority: data.priority || "medium",
      userId: data.userId,
    });

    const savedTodo = await todo.save();
    return savedTodo.toObject();
  },

  /**
   * Get all todos
   */
  async getTodos(filters: { status?: string; priority?: string; userId?: string }) {
    const Todo = await this.getTodoModel();
    const query: any = {};

    if (filters.status) query.status = filters.status;
    if (filters.priority) query.priority = filters.priority;
    if (filters.userId) query.userId = filters.userId;

    const todos = await Todo.find(query).sort({ createdAt: -1 });
    return todos.map((todo) => todo.toObject());
  },

  /**
   * Update todo
   */
  async updateTodo(id: string, updates: Partial<{ title: string; description: string; status: string; priority: string }>) {
    const Todo = await this.getTodoModel();
    const todo = await Todo.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!todo) {
      throw new Error("Todo not found");
    }

    return todo.toObject();
  },

  /**
   * Delete todo
   */
  async deleteTodo(id: string) {
    const Todo = await this.getTodoModel();
    const todo = await Todo.findByIdAndDelete(id);
    if (!todo) {
      throw new Error("Todo not found");
    }
  },
};
```

### Cassandra

#### Model Definition

**`src/models/cassandra/userModel.ts`**

```typescript
import { CassandraModelDefinition } from "multibridge";

export const userModel: CassandraModelDefinition = {
  tableName: "users",
  partitionKeys: ["user_id"],
  columns: {
    user_id: "uuid",
    username: "text",
    email: "text",
    password_hash: "text",
    created_at: "timestamp",
  },
  indexes: ["email"],
};
```

**`src/models/cassandra/todoModel.ts`**

```typescript
import { CassandraModelDefinition } from "multibridge";

export const todoModel: CassandraModelDefinition = {
  tableName: "todos",
  partitionKeys: ["user_id"],
  clusteringKeys: ["todo_id"],
  columns: {
    todo_id: "uuid",
    user_id: "uuid",
    title: "text",
    description: "text",
    status: "text",
    priority: "text",
    created_at: "timestamp",
  },
};
```

#### Service Using Cassandra

**`src/services/cassandraAuthService.ts`**

```typescript
import { getCassandraClient, createTable, insert, select, update, remove } from "multibridge";
import { userModel } from "../models/cassandra/userModel";
import { v4 as uuidv4 } from "uuid";

export const cassandraAuthService = {
  /**
   * Initialize user table
   */
  async initializeUserTable() {
    const client = await getCassandraClient();
    await createTable(client, userModel);
  },

  /**
   * Create user
   */
  async createUser(data: { username: string; email: string; passwordHash: string }) {
    const client = await getCassandraClient();
    const userId = uuidv4();

    await insert(client, userModel.tableName, {
      user_id: userId,
      username: data.username,
      email: data.email,
      password_hash: data.passwordHash,
      created_at: new Date(),
    });

    return { userId, username: data.username, email: data.email };
  },

  /**
   * Find user by email
   */
  async findUserByEmail(email: string) {
    const client = await getCassandraClient();
    const result = await select(
      client,
      userModel.tableName,
      ["user_id", "username", "email", "password_hash"],
      { email }
    );

    if (result && result.length > 0) {
      return result[0];
    }
    return null;
  },
};

export const cassandraTodoService = {
  /**
   * Initialize todo table
   */
  async initializeTodoTable() {
    const client = await getCassandraClient();
    const { todoModel } = await import("../models/cassandra/todoModel");
    await createTable(client, todoModel);
  },

  /**
   * Create todo
   */
  async createTodo(data: { userId: string; title: string; description?: string; priority?: string }) {
    const client = await getCassandraClient();
    const todoId = uuidv4();

    await insert(client, "todos", {
      todo_id: todoId,
      user_id: data.userId,
      title: data.title,
      description: data.description || "",
      status: "pending",
      priority: data.priority || "medium",
      created_at: new Date(),
    });

    return { todoId, ...data };
  },

  /**
   * Get todos for user
   */
  async getTodosByUserId(userId: string) {
    const client = await getCassandraClient();
    const result = await select(
      client,
      "todos",
      ["todo_id", "user_id", "title", "description", "status", "priority", "created_at"],
      { user_id: userId }
    );

    return result || [];
  },

  /**
   * Update todo
   */
  async updateTodo(todoId: string, userId: string, updates: Partial<{ title: string; description: string; status: string; priority: string }>) {
    const client = await getCassandraClient();
    await update(
      client,
      "todos",
      updates,
      { todo_id: todoId, user_id: userId }
    );
  },

  /**
   * Delete todo
   */
  async deleteTodo(todoId: string, userId: string) {
    const client = await getCassandraClient();
    await remove(
      client,
      "todos",
      { todo_id: todoId, user_id: userId }
    );
  },
};
```

---

## Model Organization

### Pattern: Separate Model Files

Each model should be in its own file for better organization and maintainability.

**Example Structure:**

```
src/models/
├── sequelize/
│   ├── index.ts          # Export all Sequelize models
│   ├── User.ts
│   └── Todo.ts
├── typeorm/
│   ├── index.ts          # Export all TypeORM entities
│   ├── User.entity.ts
│   └── Todo.entity.ts
├── mongoose/
│   ├── index.ts          # Export all Mongoose schemas
│   ├── userSchema.ts
│   └── todoSchema.ts
└── cassandra/
    ├── index.ts          # Export all Cassandra models
    ├── userModel.ts
    └── todoModel.ts
```

**`src/models/sequelize/index.ts`**

```typescript
export { User, UserAttributes, UserCreationAttributes } from "./User";
export { Todo, TodoAttributes, TodoCreationAttributes } from "./Todo";
```

**`src/models/typeorm/index.ts`**

```typescript
export { User } from "./User.entity";
export { Todo } from "./Todo.entity";
```

**`src/models/mongoose/index.ts`**

```typescript
export { userSchema, IUser } from "./userSchema";
export { todoSchema, ITodo } from "./todoSchema";
```

**`src/models/cassandra/index.ts`**

```typescript
export { userModel } from "./userModel";
export { todoModel } from "./todoModel";
```

### Using Models in Services

```typescript
// Import from centralized index
import { User, Todo } from "../models/sequelize";
// or
import { User } from "../models/typeorm";
// or
import { userSchema, IUser } from "../models/mongoose";
// or
import { userModel } from "../models/cassandra";
```

---

## Error Handling

MultiBridge provides custom error classes for better error handling:

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
    // Handle tenant context issues
    console.error("Tenant error:", error.message, error.context);
  } else if (error instanceof ConnectionError) {
    // Handle connection issues
    console.error("Connection error:", error.message);
  } else if (error instanceof QueryError) {
    // Handle query execution errors
    console.error("Query error:", error.message, error.context);
  } else if (error instanceof TimeoutError) {
    // Handle timeout errors
    console.error("Timeout error:", error.message);
  } else {
    // Handle other errors
    console.error("Unexpected error:", error);
  }
}
```

---

## Best Practices

### 1. Always Use `runWithTenant` in Controllers

```typescript
// ✅ Good
await runWithTenant(tenant, async () => {
  await service.doSomething();
});

// ❌ Bad - Missing tenant context
await service.doSomething();
```

### 2. Keep Services Pure

Services should not handle HTTP concerns. They should only contain business logic and database operations.

```typescript
// ✅ Good
export const todoService = {
  async createTodo(data: CreateTodoDto) {
    // Business logic only
    return await executeQuery(...);
  },
};

// ❌ Bad
export const todoService = {
  async createTodo(req: Request, res: Response) {
    // HTTP concerns in service
  },
};
```

### 3. Use Type Safety

Always define types for your data structures:

```typescript
interface CreateUserDto {
  username: string;
  email: string;
  password: string;
}

export const authService = {
  async createUser(data: CreateUserDto) {
    // Type-safe implementation
  },
};
```

### 4. Handle Database Result Formats

Different databases return results in different formats:

```typescript
const result = await executeQuery("SELECT * FROM users");

// PostgreSQL: result is QueryResult with rows array
// MySQL: result is [rows, fields]
// MongoDB: result is the document(s)
// Cassandra: result is ResultSet with rows

// Handle accordingly
let users;
if (Array.isArray(result) && result.length > 0) {
  if (Array.isArray(result[0])) {
    // MySQL format
    users = result[0];
  } else {
    // PostgreSQL format
    users = result;
  }
} else {
  users = result;
}
```

### 5. Initialize ORM Models Once Per Tenant Context

```typescript
// ✅ Good - Initialize models once
await runWithTenant(tenant, async () => {
  await initializeModels(); // Call once
  await service.createUser(...);
  await service.createTodo(...);
});

// ❌ Bad - Initialize models multiple times
await runWithTenant(tenant, async () => {
  await initializeModels();
  await service.createUser(...);
  await initializeModels(); // Redundant
  await service.createTodo(...);
});
```

### 6. Clean Up Connections on Shutdown

```typescript
import {
  closeAllConnections,
  closeAllSequelizeInstances,
  closeAllTypeORMDataSources,
  closeAllMongooseConnections,
  closeAllCassandraClients,
  closeCentralDB,
} from "multibridge";

// Graceful shutdown
process.on("SIGTERM", async () => {
  await closeAllSequelizeInstances();
  await closeAllTypeORMDataSources();
  await closeAllMongooseConnections();
  await closeAllCassandraClients();
  await closeAllConnections();
  await closeCentralDB();
  process.exit(0);
});
```

### 7. Use Connection Statistics for Monitoring

```typescript
import { getConnectionStats } from "multibridge";

// Get connection statistics
const stats = getConnectionStats();
console.log("Active connections:", stats.activeConnections);
console.log("Cached connections:", stats.cachedConnections);
console.log("Pending connections:", stats.pendingConnections);
```

### 8. Validate Tenant Input

MultiBridge automatically validates tenant input, but you can add additional validation:

```typescript
const tenant: TenantInfo = {
  appid: req.headers["x-app-id"],
  orgid: req.headers["x-org-id"],
  appdbname: req.headers["x-app-db-name"],
};

// Additional validation
if (!tenant.appid || !tenant.orgid || !tenant.appdbname) {
  return res.status(400).json({ error: "Missing tenant information" });
}
```

---

## Complete Server Example

**`src/server.ts`**

```typescript
import express from "express";
import authRoutes from "./routes/authRoutes";
import todoRoutes from "./routes/todoRoutes";
import {
  closeAllConnections,
  closeAllSequelizeInstances,
  closeAllTypeORMDataSources,
  closeAllMongooseConnections,
  closeAllCassandraClients,
  closeCentralDB,
} from "multibridge";

const app = express();

// Middleware
app.use(express.json());

// Routes
app.use("/auth", authRoutes);
app.use("/api", todoRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log("Shutting down gracefully...");
  
  server.close(async () => {
    try {
      await closeAllSequelizeInstances();
      await closeAllTypeORMDataSources();
      await closeAllMongooseConnections();
      await closeAllCassandraClients();
      await closeAllConnections();
      await closeCentralDB();
      console.log("All connections closed");
      process.exit(0);
    } catch (error) {
      console.error("Error during shutdown:", error);
      process.exit(1);
    }
  });
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
```

---

## Summary

This guide demonstrates:

1. **Controller Layer**: HTTP request handling with tenant context
2. **Service Layer**: Business logic with database operations
3. **Custom Queries**: Using `executeQuery` for direct database queries
4. **ORM Integration**: Using Sequelize, TypeORM, Mongoose, and Cassandra adapters
5. **Model Organization**: Separating models into individual files
6. **Error Handling**: Using MultiBridge's custom error classes
7. **Best Practices**: Following recommended patterns and conventions

MultiBridge provides a unified interface for multi-tenant database operations while supporting both raw queries and popular ORMs, making it flexible for various use cases and team preferences.
