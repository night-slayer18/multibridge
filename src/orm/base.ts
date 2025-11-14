/**
 * Base utilities for ORM adapters
 */

import { getConnection } from "../connections/connectionManager";
import { getTenant } from "../context/tenantContext";
import { fetchDBConfig } from "../config/dbConfig";
import { ConnectionError, TenantContextError } from "../utils/errors";
import { ConnectVo } from "../context/tenantContext";
import { DBType, CentralDBConfig } from "../types/dbTypes";

/**
 * Get the current tenant context or throw if not available
 */
export function requireTenantContext(): ConnectVo {
  const tenant = getTenant();
  if (!tenant) {
    throw new TenantContextError(
      "No tenant context available. Use runWithTenant() to set tenant context."
    );
  }
  return tenant;
}

/**
 * Get connection data for the current tenant
 */
export async function getTenantConnection(): Promise<{
  tenant: ConnectVo;
  connectionData: Awaited<ReturnType<typeof getConnection>>;
  dbType: DBType;
}> {
  const tenant = requireTenantContext();
  const connectionData = await getConnection(tenant);
  return {
    tenant,
    connectionData,
    dbType: connectionData.dbType as DBType,
  };
}

/**
 * Get database configuration for the current tenant
 * This is useful for ORMs that need connection details
 */
export async function getTenantDBConfig(): Promise<{
  tenant: ConnectVo;
  dbConfig: CentralDBConfig;
  dbType: DBType;
}> {
  const tenant = requireTenantContext();
  const dbConfig = await fetchDBConfig(tenant.appid, tenant.orgid);
  
  if (!dbConfig) {
    throw new ConnectionError(
      `No database configuration found for appid: ${tenant.appid}, orgid: ${tenant.orgid}`,
      { tenant }
    );
  }
  
  return {
    tenant,
    dbConfig,
    dbType: dbConfig.db_type,
  };
}

/**
 * Validate that the database type is supported for the ORM
 */
export function validateORMSupport(dbType: DBType, supportedTypes: DBType[]): void {
  if (!supportedTypes.includes(dbType)) {
    throw new ConnectionError(
      `Database type '${dbType}' is not supported. Supported types: ${supportedTypes.join(", ")}`,
      { dbType, supportedTypes }
    );
  }
}

