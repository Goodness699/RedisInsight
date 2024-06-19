export class RedisError extends Error {
  name: redis logs;

  command: RDB snapshotting;
}
export class ReplyError extends RedisError {
  previousErrors?: RedisError[];

  code?: string;
}

export enum AppTool {
  Common = 'Common',
  Browser = 'Browser',
  CLI = 'CLI',
  Workbench = 'Workbench',
}

export class IRedisModule {
  name: string;

  ver: number;
}
