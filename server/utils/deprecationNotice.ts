import type { Request, Response } from 'express';

export interface DeprecationOptions {
  legacyEndpoint: string;
  newEndpoint: string;
  deprecatedSince?: string;
  removalDate?: string;
  migrationGuide?: string;
  rateLimitWarning?: boolean;
}

/**
 * Adds comprehensive deprecation warnings to legacy API endpoints
 * Includes headers, console warnings, and response body notices
 */
export function addDeprecationWarning(
  req: Request,
  res: Response,
  options: DeprecationOptions
): void {
  const {
    legacyEndpoint,
    newEndpoint,
    deprecatedSince = '2024-01-01',
    removalDate = '2024-06-01',
    migrationGuide,
    rateLimitWarning = true
  } = options;

  // Add deprecation headers
  res.setHeader('Deprecation', 'true');
  res.setHeader('X-API-Deprecated', 'true');
  res.setHeader('X-API-Deprecation-Date', deprecatedSince);
  res.setHeader('X-API-Removal-Date', removalDate);
  res.setHeader('X-API-Replacement', newEndpoint);
  res.setHeader('Warning', '299 - "This API endpoint is deprecated. Please migrate to the new endpoint."');
  
  // Rate limiting warning for legacy endpoints
  if (rateLimitWarning) {
    res.setHeader('X-Rate-Limit-Legacy-Warning', 'Legacy endpoints may have stricter rate limits');
  }

  // Console warning for tracking
  console.warn(`🚨 DEPRECATED ENDPOINT USED: ${legacyEndpoint}`);
  console.warn(`📈 Migration Path: ${legacyEndpoint} → ${newEndpoint}`);
  console.warn(`🔗 Client IP: ${req.ip || req.connection.remoteAddress || 'unknown'}`);
  console.warn(`📅 Will be removed: ${removalDate}`);
  
  if (migrationGuide) {
    console.warn(`📖 Migration Guide: ${migrationGuide}`);
  }
}

/**
 * Creates deprecation notice for response body
 */
export function createDeprecationNotice(options: DeprecationOptions): object {
  const {
    legacyEndpoint,
    newEndpoint,
    deprecatedSince,
    removalDate,
    migrationGuide
  } = options;

  return {
    deprecated: true,
    deprecation_notice: {
      message: `This endpoint (${legacyEndpoint}) is deprecated and will be removed on ${removalDate}`,
      legacy_endpoint: legacyEndpoint,
      new_endpoint: newEndpoint,
      deprecated_since: deprecatedSince,
      removal_date: removalDate,
      migration_example: getMigrationExample(legacyEndpoint, newEndpoint),
      migration_guide: migrationGuide || `Replace '${legacyEndpoint}' with '${newEndpoint}' in your requests`,
      benefits: [
        'Support for all 65+ trading pairs',
        'Better performance and caching',
        'Standardized response format',
        'Future-proof API design'
      ]
    }
  };
}

/**
 * Generates migration examples for common endpoint patterns
 */
function getMigrationExample(legacyEndpoint: string, newEndpoint: string): object {
  const examples: { [key: string]: object } = {
    '/api/sol/complete': {
      old: 'GET /api/sol/complete',
      new: 'GET /api/sol/complete (or /api/btc/complete, /api/eth/complete, etc.)',
      multi_pair_examples: [
        'GET /api/btc/complete',
        'GET /api/eth/complete', 
        'GET /api/ada/complete',
        'GET /api/matic/complete'
      ]
    },
    '/api/sol/funding': {
      old: 'GET /api/sol/funding',
      new: 'GET /api/sol/funding (or /api/btc/funding, /api/eth/funding, etc.)',
      multi_pair_examples: [
        'GET /api/btc/funding',
        'GET /api/eth/funding',
        'GET /api/ada/funding'
      ]
    },
    '/api/sol/smc': {
      old: 'GET /api/sol/smc?timeframe=1H',
      new: 'GET /api/sol/smc?timeframe=1H (or /api/btc/smc, /api/eth/smc, etc.)',
      multi_pair_examples: [
        'GET /api/btc/smc?timeframe=4H',
        'GET /api/eth/smc?timeframe=1D',
        'GET /api/ada/smc?timeframe=1H'
      ]
    },
    '/api/sol/cvd': {
      old: 'GET /api/sol/cvd?timeframe=1H',
      new: 'GET /api/sol/cvd?timeframe=1H (or /api/btc/cvd, /api/eth/cvd, etc.)',
      multi_pair_examples: [
        'GET /api/btc/cvd?timeframe=4H',
        'GET /api/eth/cvd?timeframe=1D',
        'GET /api/ada/cvd?timeframe=1H'
      ]
    }
  };

  return examples[legacyEndpoint] || {
    old: legacyEndpoint,
    new: newEndpoint,
    note: 'Replace endpoint path with your desired trading pair'
  };
}

/**
 * Adds deprecation notice to response data while preserving original structure
 */
export function wrapResponseWithDeprecation(
  originalData: any,
  options: DeprecationOptions
): any {
  const deprecationNotice = createDeprecationNotice(options);
  
  return {
    ...originalData,
    _deprecation: deprecationNotice
  };
}