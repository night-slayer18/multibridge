import { AsyncLocalStorage } from "async_hooks";

export interface ConnectVo {
  appid: string;
  orgid: string;
  appdbname: string; // The target schema or database name for the tenant
}

const tenantContext = new AsyncLocalStorage<ConnectVo>();

export function runWithTenant<T>(tenant: ConnectVo, fn: () => Promise<T>): Promise<T> {
  return tenantContext.run(tenant, fn);
}

export function getTenant(): ConnectVo | undefined {
  return tenantContext.getStore();
}
