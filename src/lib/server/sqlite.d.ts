declare module "node:sqlite" {
  type Value = string | number | null | Uint8Array;
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): {
      run(...params: Value[]): { changes: number; lastInsertRowid: number | bigint };
      get(...params: Value[]): Record<string, unknown> | undefined;
      all(...params: Value[]): Record<string, unknown>[];
    };
  }
}
