declare module 'sql.js' {
  interface SqlJsStatic {
    Database: new (data?: Buffer | Uint8Array) => {
      exec(sql: string): { columns: string[]; values: unknown[][] }[];
      close(): void;
    };
  }
  function initSqlJs(opts?: { locateFile?: (file: string) => string }): Promise<SqlJsStatic>;
  export = initSqlJs;
}
