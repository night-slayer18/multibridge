/**
 * Type definitions for ORM adapters
 */

import { ConnectVo } from "../context/tenantContext";
import { DBType } from "../types/dbTypes";

export interface ORMAdapterConfig {
  tenant: ConnectVo;
  models?: any; // Model definitions (varies by ORM)
  options?: Record<string, any>; // ORM-specific options
}

export interface ORMInstance {
  tenant: ConnectVo;
  dbType: DBType;
  instance: any; // The ORM instance (Sequelize, DataSource, etc.)
  close?: () => Promise<void>; // Optional cleanup function
}

