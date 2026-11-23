import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { app } from './server/app.ts';
import { ensureDatabaseInitialized } from './server/db.ts';

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
        next();
        return;
      }
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    // Warm up database asynchronously so slow/unreachable remote DBs never kill port 3000 startup
    ensureDatabaseInitialized().catch((err) => {
      console.error(
        'Initial database warm-up failed (API middleware will retry on request):',
        err?.message || err
      );
    });
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
