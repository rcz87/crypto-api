import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { type Server } from "http";
import { nanoid } from "nanoid";
import { log } from "./utils/logger.js";

// Simple logger replacement (no vite dependency)
const viteLogger = {
  info: (msg: string) => console.log(`[vite] ${msg}`),
  warn: (msg: string) => console.warn(`[vite] ${msg}`),
  error: (msg: string, options?: any) => console.error(`[vite] ${msg}`, options),
  clearScreen: () => {},
  hasErrorLogged: () => false,
  hasWarned: false,
  warnOnce: (msg: string) => console.warn(`[vite] ${msg}`)
};

export { log };

export async function setupVite(app: Express, server: Server) {
  // ✅ FIXED: Dynamic import vite only when needed (development mode)
  // This prevents "vite not found" errors in production
  try {
    const viteModule = await import("vite");
    const createViteServer = viteModule.createServer;
    
    if (!createViteServer || typeof createViteServer !== 'function') {
      throw new Error('Vite createServer function not available');
    }
    
    const serverOptions = {
      middlewareMode: true,
      hmr: { server },
      allowedHosts: true as const,
    };

    const vite = await createViteServer({
      // ✅ FIXED: Use inline config instead of importing vite.config
      configFile: false,
      root: process.cwd(),
      customLogger: viteLogger as any, // Use simple logger without vite dependency
      server: serverOptions,
      appType: "custom",
    });

    app.use(vite.middlewares);
    app.use("*", async (req, res, next) => {
      const url = req.originalUrl;

      try {
        const clientTemplate = path.resolve(
          import.meta.dirname,
          "..",
          "client",
          "index.html",
        );

        // always reload the index.html file from disk incase it changes
        let template = await fs.promises.readFile(clientTemplate, "utf-8");
        template = template.replace(
          `src="/src/main.tsx"`,
          `src="/src/main.tsx?v=${nanoid()}"`,
        );
        const page = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(page);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
    
    console.log("✅ Vite development server setup successfully");
  } catch (error) {
    console.warn("⚠️ Vite not available (production mode) - skipping vite setup");
    // This is expected in production - vite is not needed
  }
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    console.warn(
      `⚠️ Could not find the build directory: ${distPath}`,
    );
    console.warn("Frontend static files will not be served. API endpoints will still work.");
    return;
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
  
  console.log("✅ Static file server setup successfully");
}
