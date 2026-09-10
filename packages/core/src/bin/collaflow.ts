import 'reflect-metadata';
import { bootstrap } from '../main';

const command = process.argv[2] ?? 'start';

async function main(): Promise<void> {
  if (command !== 'start') {
    console.error(`Unknown command: ${command}`);
    console.error('Usage: collaflow start');
    process.exit(1);
  }

  const { app } = await bootstrap();
  console.log(`CollaFlow core server running at ${await app.getUrl()}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
