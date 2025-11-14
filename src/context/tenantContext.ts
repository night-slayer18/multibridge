import { AsyncLocalStorage } from "async_hooks";
import { ValidationError } from "../utils/errors";
import { getConnection } from "../connections/connectionManager";
import logger from "../utils/loggers";

export interface ConnectVo {
  appid: string;
  orgid: string;
  appdbname: string; // The target schema or database name for the tenant
}

const tenantContext = new AsyncLocalStorage<ConnectVo>();

// Validation pattern: alphanumeric, underscore, hyphen, dot (for database names)
const VALID_ID_PATTERN = /^[a-zA-Z0-9_\-\.]+$/;
const MAX_ID_LENGTH = 255;
const MIN_ID_LENGTH = 1;

function validateTenantInput(tenant: ConnectVo): void {
  const errors: string[] = [];

  // Validate appid
  if (!tenant.appid || typeof tenant.appid !== "string") {
    errors.push("appid is required and must be a string");
  } else if (tenant.appid.length < MIN_ID_LENGTH || tenant.appid.length > MAX_ID_LENGTH) {
    errors.push(`appid must be between ${MIN_ID_LENGTH} and ${MAX_ID_LENGTH} characters`);
  } else if (!VALID_ID_PATTERN.test(tenant.appid)) {
    errors.push("appid contains invalid characters. Only alphanumeric, underscore, hyphen, and dot are allowed");
  }

  // Validate orgid
  if (!tenant.orgid || typeof tenant.orgid !== "string") {
    errors.push("orgid is required and must be a string");
  } else if (tenant.orgid.length < MIN_ID_LENGTH || tenant.orgid.length > MAX_ID_LENGTH) {
    errors.push(`orgid must be between ${MIN_ID_LENGTH} and ${MAX_ID_LENGTH} characters`);
  } else if (!VALID_ID_PATTERN.test(tenant.orgid)) {
    errors.push("orgid contains invalid characters. Only alphanumeric, underscore, hyphen, and dot are allowed");
  }

  // Validate appdbname
  if (!tenant.appdbname || typeof tenant.appdbname !== "string") {
    errors.push("appdbname is required and must be a string");
  } else if (tenant.appdbname.length < MIN_ID_LENGTH || tenant.appdbname.length > MAX_ID_LENGTH) {
    errors.push(`appdbname must be between ${MIN_ID_LENGTH} and ${MAX_ID_LENGTH} characters`);
  } else if (!VALID_ID_PATTERN.test(tenant.appdbname)) {
    errors.push("appdbname contains invalid characters. Only alphanumeric, underscore, hyphen, and dot are allowed");
  }

  if (errors.length > 0) {
    throw new ValidationError(`Invalid tenant input: ${errors.join("; ")}`, { tenant });
  }
}
export async function runWithTenant<T>(
  tenant: ConnectVo,
  fn: () => Promise<T>,
  options?: { lazyConnection?: boolean }
): Promise<T> {
  validateTenantInput(tenant);
  
  // Set tenant context
  return tenantContext.run(tenant, async () => {
    try {
      // Create connection eagerly at the start (default behavior)
      // Since runWithTenant implies DB operations, we create connection upfront
      if (!options?.lazyConnection) {
        try {
          await getConnection(tenant);
          logger.debug(`Connection established for tenant: ${tenant.appid}-${tenant.orgid}-${tenant.appdbname}`);
        } catch (error) {
          // If connection creation fails, throw error immediately
          // This provides fail-fast behavior
          logger.error(`Failed to establish connection for tenant: ${(error as Error).message}`, {
            tenant,
            error: (error as Error).stack,
          });
          throw error;
        }
      }
      return await fn();
    } finally {
      // Tenant context is automatically cleared by AsyncLocalStorage when this block completes
      // Connection remains in cache - it's NOT closed, just no longer associated with this thread
      logger.debug(`Tenant context cleared for: ${tenant.appid}-${tenant.orgid}-${tenant.appdbname} (connection remains in cache)`);
    }
  });
}

export function getTenant(): ConnectVo | undefined {
  return tenantContext.getStore();
}
