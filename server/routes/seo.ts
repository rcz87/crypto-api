import type { Express, Request, Response } from "express";
import path from "path";
import fs from "fs";

/**
 * SEO and OpenAPI Routes Module
 * Contains all routes related to SEO, robots.txt, sitemaps, and OpenAPI specifications
 */
export function registerSeoRoutes(app: Express): void {
  // Robots.txt for search engines (HIGH PRIORITY)
  app.get('/robots.txt', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/plain');
    res.send(`User-agent: *
Allow: /
Allow: /api/
Allow: /.well-known/

Sitemap: https://guardiansofthegreentoken.com/sitemap.xml

# API endpoints for crawlers
Allow: /api/sol/complete
Allow: /health
Allow: /api/metrics
Allow: /.well-known/ai-plugin.json
Allow: /openapi.yaml
Allow: /openapi.json`);
  });

  // OpenAPI JSON specification for GPT custom actions - HIGH PRIORITY
  app.get('/openapi.json', (req: Request, res: Response) => {
    try {
      const openapiPath = path.join(process.cwd(), 'openapi-spec.json');
      const stats = fs.statSync(openapiPath);
      const openapiContent = fs.readFileSync(openapiPath, 'utf8');
      
      // Generate ETag from file modification time and size
      const etag = `"${stats.mtime.getTime()}-${stats.size}"`;
      
      // Check if client has cached version
      const clientETag = req.headers['if-none-match'];
      if (clientETag === etag) {
        return res.status(304).end(); // Not Modified
      }
      
      // Set smart cache headers
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=1800, must-revalidate'); // 30 min cache
      res.setHeader('ETag', etag);
      res.setHeader('Last-Modified', stats.mtime.toUTCString());
      res.setHeader('Vary', 'Accept-Encoding');
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      // Parse and send JSON
      const jsonContent = JSON.parse(openapiContent);
      res.json(jsonContent);
    } catch (error) {
      console.error('Error serving OpenAPI JSON:', error);
      res.status(500).json({ error: 'Failed to load OpenAPI JSON specification' });
    }
  });

  // Alternative OpenAPI JSON endpoint
  app.get('/api/openapi.json', (req: Request, res: Response) => {
    try {
      const openapiPath = path.join(process.cwd(), 'openapi-spec.json');
      const stats = fs.statSync(openapiPath);
      const openapiContent = fs.readFileSync(openapiPath, 'utf8');
      
      // Generate ETag from file modification time and size
      const etag = `"api-${stats.mtime.getTime()}-${stats.size}"`;
      
      // Check if client has cached version
      const clientETag = req.headers['if-none-match'];
      if (clientETag === etag) {
        return res.status(304).end(); // Not Modified
      }
      
      // Set smart cache headers
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=900, must-revalidate'); // 15 min cache for API endpoint
      res.setHeader('ETag', etag);
      res.setHeader('Last-Modified', stats.mtime.toUTCString());
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      // Parse and send JSON
      const jsonContent = JSON.parse(openapiContent);
      res.json(jsonContent);
    } catch (error) {
      console.error('Error serving OpenAPI JSON via API:', error);
      res.status(500).json({ error: 'Failed to load OpenAPI JSON specification' });
    }
  });

  // GPT Actions Schema - Ultra-compact version (25KB, 31 operations)
  app.get('/gpt-actions-schema.json', (req: Request, res: Response) => {
    try {
      const schemaPath = path.join(process.cwd(), 'openapi-gpt-actions.json');
      const schemaContent = fs.readFileSync(schemaPath, 'utf8');
      
      // NO caching - always fresh for GPT Actions import
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      const jsonContent = JSON.parse(schemaContent);
      res.json(jsonContent);
    } catch (error) {
      console.error('Error serving GPT Actions schema:', error);
      res.status(500).json({ error: 'Failed to load GPT Actions schema' });
    }
  });

  // Sitemap.xml for search engines
  app.get('/sitemap.xml', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour cache
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://guardiansofthegreentoken.com/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://guardiansofthegreentoken.com/health</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://guardiansofthegreentoken.com/api/sol/complete</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>always</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://guardiansofthegreentoken.com/openapi.json</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://guardiansofthegreentoken.com/.well-known/ai-plugin.json</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>
</urlset>`);
  });

  // AI Plugin manifest for GPT and AI assistants
  app.get("/.well-known/ai-plugin.json", (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hour cache
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({
      schema_version: "v1",
      name_for_model: "SOL_Trading_Gateway",
      name_for_human: "SOL Perpetual Futures Trading Gateway",
      description_for_model: "Advanced SOL-USDT-SWAP perpetual futures trading data gateway with LIVE TRADING SIGNALS, 8-layer SharpSignalEngine analysis, and premium institutional analytics. Provides real-time BUY/SELL/HOLD signals with entry/exit prices, risk management, multi-timeframe confluence analysis, CVD, SMC, technical indicators, Fibonacci analysis, and VIP8+ premium features for derivatives trading.",
      description_for_human: "Real-time SOL trading signals with entry/exit points, risk management, and institutional-grade market intelligence for derivatives trading.",
      auth: { type: "none" },
      api: {
        type: "openapi",
        url: "https://guardiansofthegreentoken.com/openapi.json"
      },
      logo_url: "https://guardiansofthegreentoken.com/logo.png",
      contact_email: "support@guardiansofthegreentoken.com",
      legal_info_url: "https://guardiansofthegreentoken.com/legal"
    });
  });

  // Well-known OpenAPI endpoint 
  app.get("/.well-known/openapi.json", (req: Request, res: Response) => {
    res.redirect(301, '/openapi.json');
  });
}