/**
 * Ambient type declarations for Node.js built-in modules that don't ship
 * with full @types/node declarations yet.
 *
 * node:sqlite is stable in Node 22+ but @types/node's bundled types may lag.
 * We declare just the slice we use.
 */
declare module "node:sqlite" {
  export type BindParameters =
    | { [key: string]: unknown }
    | unknown[]
    | undefined
    | null;

  export interface StatementSync {
    run(params?: BindParameters): { changes: number; lastInsertRowid: number | bigint };
    get(params?: BindParameters): unknown;
    all(params?: BindParameters): unknown[];
  }

  export interface DatabaseSyncOptions {
    readOnly?: boolean;
  }

  export class DatabaseSync {
    constructor(location: string, options?: DatabaseSyncOptions);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }

  export const constants: {
    SQLITE_OPEN_READONLY: number;
  };
}
