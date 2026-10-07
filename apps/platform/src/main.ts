import { readConfig } from './config.ts';
import { createApp } from './app.ts';
import { createHttpServer } from './http.ts';
const config = readConfig();
const app = await createApp(config);
const stopWorker = app.sites ? await app.sites.startWorker() : async () => {};
const stopManagedWorker = app.managed ? await app.managed.startWorker() : async () => {};
const server = createHttpServer(config, app);
server.listen(config.port, '0.0.0.0', () =>
  console.info(
    JSON.stringify({ event: 'platform.listening', port: config.port, test: false })
  )
);
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () =>
    server.close(() => {
      void Promise.all([stopWorker(),stopManagedWorker()])
        .then(() => app.pool.end())
        .then(() => process.exit(0));
    })
  );
