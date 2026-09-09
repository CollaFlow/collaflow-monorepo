import { createServer } from './server';
import { config } from './config';

export { createServer };
export type { CreateServerOptions } from './server';

/**
 * CollaCore 启动入口。
 */
async function bootstrap(): Promise<void> {
  const app = await createServer();

  try {
    await app.listen({ port: config.port, host: config.host });
    app.log.info(`CollaCore listening on ${config.host}:${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  const gracefulShutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, closing server...`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

if (require.main === module) {
  bootstrap();
}
