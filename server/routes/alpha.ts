import { Router, Request, Response } from 'express';
import { cmcService } from '../services/coinmarketcap';

const router = Router();

// Get micro-cap opportunities (<$100M market cap)
router.get('/micro-caps', async (req: Request, res: Response) => {
  try {
    const maxMarketCap = parseInt(req.query.maxMarketCap as string) || 100000000; // Default $100M
    const minScore = parseInt(req.query.minScore as string) || 0;

    console.log(`[Alpha] Fetching micro-caps with max market cap: $${(maxMarketCap / 1000000).toFixed(0)}M`);

    const coins = await cmcService.getMicroCaps(maxMarketCap);

    // Calculate scores for each coin
    const opportunities = coins.map(coin => {
      const tokenomics = cmcService.calculateTokenomicsScore(coin);
      const marketCap = coin.quote.USD.market_cap;
      const volume24h = coin.quote.USD.volume_24h;
      
      // Market cap score (prefer micro-caps)
      let marketCapScore = 0;
      if (marketCap < 10000000) marketCapScore = 100;
      else if (marketCap < 50000000) marketCapScore = 80;
      else if (marketCap < 100000000) marketCapScore = 60;
      else marketCapScore = 40;

      // Volume score
      let volumeScore = 0;
      if (volume24h > 5000000) volumeScore = 100;
      else if (volume24h > 1000000) volumeScore = 70;
      else if (volume24h > 100000) volumeScore = 40;
      else volumeScore = 20;

      // Combined alpha score (weighted)
      const alphaScore = Math.round(
        tokenomics.score * 0.4 + // 40% tokenomics
        marketCapScore * 0.3 +   // 30% market cap
        volumeScore * 0.3        // 30% volume
      );

      return {
        symbol: coin.symbol,
        name: coin.name,
        marketCap: coin.quote.USD.market_cap,
        marketCapFormatted: `$${(marketCap / 1000000).toFixed(2)}M`,
        price: coin.quote.USD.price,
        volume24h: coin.quote.USD.volume_24h,
        volumeFormatted: `$${(volume24h / 1000000).toFixed(2)}M`,
        percentChange24h: coin.quote.USD.percent_change_24h,
        circulatingSupply: coin.circulating_supply,
        totalSupply: coin.total_supply,
        circulatingRatio: tokenomics.circulatingRatio,
        dilutionRisk: tokenomics.dilutionRisk,
        tokenomicsScore: tokenomics.score,
        marketCapScore,
        volumeScore,
        alphaScore,
        tags: coin.tags,
        dateAdded: coin.date_added,
        cmcRank: coin.cmc_rank,
        reasoning: tokenomics.details,
      };
    });

    // Filter by minimum score
    const filtered = opportunities.filter(opp => opp.alphaScore >= minScore);

    // Sort by alpha score descending
    const sorted = filtered.sort((a, b) => b.alphaScore - a.alphaScore);

    res.json({
      success: true,
      data: sorted,
      metadata: {
        total: sorted.length,
        maxMarketCap: `$${(maxMarketCap / 1000000).toFixed(0)}M`,
        minScore,
      },
    });
  } catch (error) {
    console.error('[Alpha] Error fetching micro-caps:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch micro-cap opportunities',
    });
  }
});

// Get new listings from CMC (cross-exchange)
router.get('/new-listings', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const minScore = parseInt(req.query.minScore as string) || 0;

    console.log(`[Alpha] Fetching ${limit} new listings from CMC`);

    const coins = await cmcService.getNewListings(limit);

    const opportunities = coins.map(coin => {
      const tokenomics = cmcService.calculateTokenomicsScore(coin);
      const marketCap = coin.quote.USD.market_cap;
      
      // Calculate days since listing
      const listingDate = new Date(coin.date_added);
      const now = new Date();
      const daysSinceListing = Math.floor((now.getTime() - listingDate.getTime()) / (1000 * 60 * 60 * 24));

      // Listing freshness score (prefer recent listings)
      let freshnessScore = 0;
      if (daysSinceListing <= 7) freshnessScore = 100;
      else if (daysSinceListing <= 30) freshnessScore = 70;
      else if (daysSinceListing <= 90) freshnessScore = 40;
      else freshnessScore = 20;

      // Combined score
      const alphaScore = Math.round(
        tokenomics.score * 0.4 +
        freshnessScore * 0.6
      );

      return {
        symbol: coin.symbol,
        name: coin.name,
        marketCap: coin.quote.USD.market_cap,
        marketCapFormatted: `$${(marketCap / 1000000).toFixed(2)}M`,
        price: coin.quote.USD.price,
        volume24h: coin.quote.USD.volume_24h,
        percentChange24h: coin.quote.USD.percent_change_24h,
        dateAdded: coin.date_added,
        daysSinceListing,
        freshnessScore,
        tokenomicsScore: tokenomics.score,
        circulatingRatio: tokenomics.circulatingRatio,
        dilutionRisk: tokenomics.dilutionRisk,
        alphaScore,
        tags: coin.tags,
        cmcRank: coin.cmc_rank,
        reasoning: tokenomics.details,
      };
    });

    const filtered = opportunities.filter(opp => opp.alphaScore >= minScore);
    const sorted = filtered.sort((a, b) => b.alphaScore - a.alphaScore);

    res.json({
      success: true,
      data: sorted,
      metadata: {
        total: sorted.length,
        limit,
        minScore,
      },
    });
  } catch (error) {
    console.error('[Alpha] Error fetching new listings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch new listings',
    });
  }
});

// Get alpha screening for specific symbol
router.get('/screen/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    
    console.log(`[Alpha] Screening ${symbol}`);

    const quotes = await cmcService.getQuotes([symbol.toUpperCase()]);
    const metadata = await cmcService.getMetadata([symbol.toUpperCase()]);
    
    const coinData = quotes[symbol.toUpperCase()];
    const coinMeta = metadata[symbol.toUpperCase()];

    if (!coinData) {
      return res.status(404).json({
        success: false,
        error: `Symbol ${symbol} not found in CoinMarketCap`,
      });
    }

    const tokenomics = cmcService.calculateTokenomicsScore(coinData);
    const marketCap = coinData.quote.USD.market_cap;
    
    // Layer 1: Fundamental Score (35%)
    let fundamentalScore = 0;
    if (coinMeta) {
      if (coinMeta.urls.website && coinMeta.urls.website.length > 0) fundamentalScore += 10;
      if (coinMeta.urls.twitter && coinMeta.urls.twitter.length > 0) fundamentalScore += 10;
      if (coinMeta.urls.technical_doc && coinMeta.urls.technical_doc.length > 0) fundamentalScore += 15;
    }

    // Layer 2: Tokenomics Score (30%) - from CMC
    const tokenomicsScore = tokenomics.score;

    // Layer 3: Technical Traction (25%)
    let technicalScore = 0;
    if (marketCap > 0) technicalScore += 10;
    if (coinData.quote.USD.volume_24h > 1000000) technicalScore += 15;

    // Layer 4: Narrative Score (10%)
    let narrativeScore = 0;
    if (coinData.tags.includes('defi')) narrativeScore += 5;
    if (coinData.tags.includes('layer-1') || coinData.tags.includes('layer-2')) narrativeScore += 3;
    if (coinData.tags.some(tag => tag.toLowerCase().includes('rwa'))) narrativeScore += 10; // RWA premium

    // Combined Alpha Score (4-Layer Framework)
    const alphaScore = Math.round(
      fundamentalScore * 0.35 +
      tokenomicsScore * 0.30 +
      technicalScore * 0.25 +
      narrativeScore * 0.10
    );

    res.json({
      success: true,
      data: {
        symbol: coinData.symbol,
        name: coinData.name,
        marketCap: coinData.quote.USD.market_cap,
        marketCapFormatted: `$${(marketCap / 1000000).toFixed(2)}M`,
        price: coinData.quote.USD.price,
        volume24h: coinData.quote.USD.volume_24h,
        
        // 4-Layer Scoring
        alphaScore,
        fundamentalScore,
        tokenomicsScore,
        technicalScore,
        narrativeScore,
        
        // Tokenomics Details
        circulatingSupply: coinData.circulating_supply,
        totalSupply: coinData.total_supply,
        circulatingRatio: tokenomics.circulatingRatio,
        dilutionRisk: tokenomics.dilutionRisk,
        
        // Metadata
        tags: coinData.tags,
        dateAdded: coinData.date_added,
        cmcRank: coinData.cmc_rank,
        
        // Links (if available)
        website: coinMeta?.urls.website || [],
        twitter: coinMeta?.urls.twitter || [],
        whitepaper: coinMeta?.urls.technical_doc || [],
        
        // Reasoning
        reasoning: [
          `Layer 1 (Fundamental): ${fundamentalScore}/35 points`,
          `Layer 2 (Tokenomics): ${tokenomicsScore}/30 points`,
          `Layer 3 (Technical): ${technicalScore}/25 points`,
          `Layer 4 (Narrative): ${narrativeScore}/10 points`,
          ...tokenomics.details,
        ],
      },
    });
  } catch (error) {
    console.error('[Alpha] Error screening symbol:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to screen symbol',
    });
  }
});

// Get CMC global market metrics
router.get('/market-metrics', async (req: Request, res: Response) => {
  try {
    const metrics = await cmcService.getGlobalMetrics();

    if (!metrics) {
      return res.status(404).json({
        success: false,
        error: 'Failed to fetch global metrics',
      });
    }

    res.json({
      success: true,
      data: {
        totalMarketCap: metrics.quote.USD.total_market_cap,
        totalMarketCapFormatted: `$${(metrics.quote.USD.total_market_cap / 1000000000).toFixed(2)}B`,
        totalVolume24h: metrics.quote.USD.total_volume_24h,
        totalVolumeFormatted: `$${(metrics.quote.USD.total_volume_24h / 1000000000).toFixed(2)}B`,
        btcDominance: metrics.btc_dominance,
        ethDominance: metrics.eth_dominance,
        activeCryptocurrencies: metrics.active_cryptocurrencies,
        activeExchanges: metrics.active_exchanges,
        defiMarketCap: metrics.defi_market_cap,
        defiMarketCapFormatted: `$${(metrics.defi_market_cap / 1000000000).toFixed(2)}B`,
        stablecoinMarketCap: metrics.stablecoin_market_cap,
        stablecoinMarketCapFormatted: `$${(metrics.stablecoin_market_cap / 1000000000).toFixed(2)}B`,
        derivativesVolume24h: metrics.derivatives_volume_24h,
        lastUpdated: metrics.last_updated,
      },
    });
  } catch (error) {
    console.error('[Alpha] Error fetching market metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch market metrics',
    });
  }
});

// Get rate limit stats
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = cmcService.getRateLimitStats();

    res.json({
      success: true,
      data: {
        creditsUsed: stats.creditsUsed,
        creditsRemaining: stats.creditsRemaining,
        dailyLimit: stats.dailyLimit,
        monthlyLimit: stats.monthlyLimit,
        utilizationPercent: ((stats.creditsUsed / stats.monthlyLimit) * 100).toFixed(1),
        resetDaily: stats.resetDaily,
        resetMonthly: stats.resetMonthly,
      },
    });
  } catch (error) {
    console.error('[Alpha] Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rate limit stats',
    });
  }
});

export default router;
