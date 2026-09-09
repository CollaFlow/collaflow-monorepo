/**
 * CollaCore 运行时配置。
 * 所有配置通过环境变量读取，12-Factor 风格。
 */

export interface CollaCoreConfig {
  port: number;
  host: string;
  redisUrl: string;
  logLevel: string;
}

function getEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

export function loadConfig(): CollaCoreConfig {
  return {
    port: parseInt(getEnv('PORT', '3000'), 10),
    host: getEnv('HOST', '0.0.0.0'),
    redisUrl: getEnv('REDIS_URL', 'redis://localhost:6379'),
    logLevel: getEnv('LOG_LEVEL', 'info'),
  };
}

export const config = loadConfig();
