import { db } from '../db';
import { listingOpportunities, NewListing, InsertListingOpportunity } from '@shared/schema';
import { OKXService } from './okx';
import { eq } from 'drizzle-orm';

interface OpportunityScores {
  opportunityScore: number;
  liquidityScore: number;
  momentumScore: number;
  riskScore: number;
  smartMoneyScore: number;
  technicalScore: number;
}

interface TradingRecommendation {
  action: string;
  entry?: string;
  stopLoss?: string;
  targets?: string[];
  riskReward?: string;
  confidence: string;
  timeframe?: string;
  positionSize?: string;
}

interface OpportunityAnalysis {
  scores: OpportunityScores;
  recommendation: TradingRecommendation;
  reasoning: string[];
  exitStrategy?: any;
}

export class ListingScorerService {
  private okxService: OKXService;

  constructor() {
    this.okxService = new OKXService();
  }

  async analyzeOpportunity(listing: NewListing): Promise<OpportunityAnalysis> {
    const [
      liquidityScore,
      momentumScore,
      smartMoneyScore,
      technicalScore,
    ] = await Promise.all([
      this.calculateLiquidityScore(listing.symbol),
      this.calculateMomentumScore(listing.symbol),
      this.calculateSmartMoneyScore(listing.symbol),
      this.calculateTechnicalScore(listing.symbol),
    ]);

    const riskScore = this.calculateRiskScore(listing, liquidityScore, momentumScore);
    
    const opportunityScore = this.calculateOpportunityScore({
      opportunityScore: 0,
      liquidityScore,
      momentumScore,
      riskScore,
      smartMoneyScore,
      technicalScore,
    });

    const scores: OpportunityScores = {
      opportunityScore,
      liquidityScore,
      momentumScore,
      riskScore,
      smartMoneyScore,
      technicalScore,
    };

    const recommendation = this.generateRecommendation(scores, listing);
    const reasoning = this.generateReasoning(scores, listing);
    const exitStrategy = this.generateExitStrategy(recommendation);

    return {
      scores,
      recommendation,
      reasoning,
      exitStrategy,
    };
  }

  private async calculateLiquidityScore(symbol: string): Promise<number> {
    try {
      const [orderBook, volume] = await Promise.all([
        this.okxService.getOrderBook(symbol, 50),
        this.okxService.getTicker(symbol),
      ]);

      const bidLiquidity = orderBook.bids.slice(0, 10).reduce((sum, bid) => {
        return sum + (parseFloat(bid.price) * parseFloat(bid.size));
      }, 0);

      const askLiquidity = orderBook.asks.slice(0, 10).reduce((sum, ask) => {
        return sum + (parseFloat(ask.price) * parseFloat(ask.size));
      }, 0);

      const totalLiquidity = bidLiquidity + askLiquidity;
      const volume24h = parseFloat(volume.tradingVolume24h);

      let score = 0;
      if (totalLiquidity > 500000) score += 40;
      else if (totalLiquidity > 200000) score += 25;
      else if (totalLiquidity > 50000) score += 15;

      if (volume24h > 5000000) score += 40;
      else if (volume24h > 1000000) score += 25;
      else if (volume24h > 100000) score += 10;

      const spread = parseFloat(orderBook.spread);
      if (spread < 0.1) score += 20;
      else if (spread < 0.5) score += 10;

      return Math.min(score, 100);
    } catch {
      return 20;
    }
  }

  private async calculateMomentumScore(symbol: string): Promise<number> {
    try {
      const candles = await this.okxService.getCandles(symbol, '5m', 12);
      
      if (candles.length < 2) return 0;

      const priceChanges = candles.slice(0, 5).map((candle, i) => {
        if (i === candles.length - 1) return 0;
        const current = parseFloat(candle.close);
        const previous = parseFloat(candles[i + 1].close);
        return ((current - previous) / previous) * 100;
      });

      const avgPriceChange = priceChanges.reduce((sum, change) => sum + change, 0) / priceChanges.length;

      const volumes = candles.slice(0, 5).map(c => parseFloat(c.volume));
      const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
      const latestVolume = volumes[0];
      const volumeIncrease = ((latestVolume - avgVolume) / avgVolume) * 100;

      let score = 0;
      
      if (avgPriceChange > 5) score += 50;
      else if (avgPriceChange > 2) score += 30;
      else if (avgPriceChange > 0) score += 15;

      if (volumeIncrease > 100) score += 50;
      else if (volumeIncrease > 50) score += 30;
      else if (volumeIncrease > 0) score += 15;

      return Math.min(score, 100);
    } catch {
      return 0;
    }
  }

  private async calculateSmartMoneyScore(symbol: string): Promise<number> {
    try {
      const [trades, oi, funding] = await Promise.all([
        this.okxService.getRecentTrades(symbol),
        this.okxService.getOpenInterest(symbol),
        this.okxService.getFundingRate(symbol),
      ]);

      const WHALE_THRESHOLD = 10000;
      const whaleTrades = trades.filter(trade => 
        parseFloat(trade.size) * parseFloat(trade.price) >= WHALE_THRESHOLD
      );

      const buyWhales = whaleTrades.filter(t => t.side === 'buy').length;
      const sellWhales = whaleTrades.filter(t => t.side === 'sell').length;

      let score = 0;

      if (whaleTrades.length >= 3) score += 40;
      else if (whaleTrades.length >= 1) score += 20;

      if (buyWhales > sellWhales * 1.5) score += 30;

      const oiValue = parseFloat(oi.oiUsd);
      if (oiValue > 5000000) score += 30;
      else if (oiValue > 1000000) score += 15;

      return Math.min(score, 100);
    } catch {
      return 0;
    }
  }

  private async calculateTechnicalScore(symbol: string): Promise<number> {
    try {
      const [candles, orderBook] = await Promise.all([
        this.okxService.getCandles(symbol, '15m', 20),
        this.okxService.getOrderBook(symbol, 20),
      ]);

      if (candles.length < 10) return 0;

      const closes = candles.map(c => parseFloat(c.close));
      const highs = candles.map(c => parseFloat(c.high));
      const lows = candles.map(c => parseFloat(c.low));

      const sma10 = closes.slice(0, 10).reduce((sum, p) => sum + p, 0) / 10;
      const currentPrice = closes[0];

      let score = 0;

      if (currentPrice > sma10) score += 30;

      const isUptrend = closes.slice(0, 5).every((price, i) => {
        if (i === 0) return true;
        return price >= closes[i + 1];
      });
      if (isUptrend) score += 40;

      const bidWalls = orderBook.bids.filter(bid => 
        parseFloat(bid.size) * parseFloat(bid.price) > 20000
      );
      const askWalls = orderBook.asks.filter(ask => 
        parseFloat(ask.size) * parseFloat(ask.price) > 20000
      );

      if (bidWalls.length > askWalls.length) score += 30;

      return Math.min(score, 100);
    } catch {
      return 0;
    }
  }

  private calculateRiskScore(listing: NewListing, liquidityScore: number, momentumScore: number): number {
    const listingAge = Date.now() - new Date(listing.listingTime).getTime();
    const hoursOld = listingAge / (1000 * 60 * 60);

    let risk = 100;

    if (hoursOld < 1) risk = 80;
    else if (hoursOld < 6) risk = 60;
    else if (hoursOld < 24) risk = 40;
    else risk = 20;

    if (liquidityScore < 30) risk = Math.min(risk + 30, 100);
    else if (liquidityScore > 70) risk = Math.max(risk - 20, 0);

    if (momentumScore > 80) risk = Math.max(risk - 10, 0);

    return risk;
  }

  private calculateOpportunityScore(scores: OpportunityScores): number {
    const weights = {
      liquidity: 0.25,
      momentum: 0.30,
      risk: -0.20,
      smartMoney: 0.15,
      technical: 0.10,
    };

    const weighted = 
      scores.liquidityScore * weights.liquidity +
      scores.momentumScore * weights.momentum +
      scores.riskScore * weights.risk +
      scores.smartMoneyScore * weights.smartMoney +
      scores.technicalScore * weights.technical;

    return Math.max(0, Math.min(100, weighted));
  }

  private generateRecommendation(scores: OpportunityScores, listing: NewListing): TradingRecommendation {
    const { opportunityScore, riskScore } = scores;
    const currentPrice = parseFloat(listing.currentPrice || listing.initialPrice);

    let action = '⛔ AVOID';
    let confidence = `${opportunityScore}%`;
    
    if (opportunityScore >= 80) {
      action = '🟢 STRONG BUY';
    } else if (opportunityScore >= 65) {
      action = '🟢 BUY';
    } else if (opportunityScore >= 45) {
      action = '🟡 MONITOR';
    }

    const stopLoss = (currentPrice * 0.92).toFixed(8);
    const target1 = (currentPrice * 1.15).toFixed(8);
    const target2 = (currentPrice * 1.35).toFixed(8);
    const target3 = (currentPrice * 1.60).toFixed(8);

    const riskReward = ((1.35 - 1) / (1 - 0.92)).toFixed(1);

    return {
      action,
      entry: `$${(currentPrice * 0.98).toFixed(8)} - $${(currentPrice * 1.02).toFixed(8)}`,
      stopLoss: `$${stopLoss}`,
      targets: [`$${target1} (15%)`, `$${target2} (35%)`, `$${target3} (60%)`],
      riskReward: `1:${riskReward}`,
      confidence,
      timeframe: riskScore < 40 ? '2-6 hours' : '1-3 hours',
      positionSize: opportunityScore >= 80 ? '5-7%' : opportunityScore >= 65 ? '3-5%' : '1-3%',
    };
  }

  private generateReasoning(scores: OpportunityScores, listing: NewListing): string[] {
    const reasons: string[] = [];
    const hoursOld = (Date.now() - new Date(listing.listingTime).getTime()) / (1000 * 60 * 60);

    if (hoursOld < 2) {
      reasons.push(`✅ Listed ${hoursOld.toFixed(1)}h ago - Early entry window`);
    }

    if (scores.liquidityScore >= 70) {
      reasons.push(`✅ Deep liquidity (Score: ${scores.liquidityScore}) - Safe for large positions`);
    } else if (scores.liquidityScore < 40) {
      reasons.push(`🚩 Low liquidity (Score: ${scores.liquidityScore}) - High manipulation risk`);
    }

    if (scores.momentumScore >= 70) {
      reasons.push(`✅ Strong momentum (Score: ${scores.momentumScore}) - Bullish price action`);
    }

    if (scores.smartMoneyScore >= 70) {
      reasons.push(`✅ Whale accumulation detected (Score: ${scores.smartMoneyScore})`);
    } else if (scores.smartMoneyScore < 30) {
      reasons.push(`⚠️ No significant whale activity - Retail dominated`);
    }

    if (scores.technicalScore >= 60) {
      reasons.push(`✅ Bullish technical setup (Score: ${scores.technicalScore})`);
    }

    if (scores.riskScore > 70) {
      reasons.push(`⚠️ High risk (Score: ${scores.riskScore}) - New listing volatility`);
    }

    if (reasons.length === 0) {
      reasons.push('⚠️ Limited data - Wait for more price history');
    }

    return reasons;
  }

  private generateExitStrategy(recommendation: TradingRecommendation): any {
    return {
      partial1: `30% position at Target 1 (${recommendation.targets?.[0]})`,
      partial2: `40% position at Target 2 (${recommendation.targets?.[1]})`,
      runner: `30% position at Target 3 or trail SL`,
      stopLoss: `Exit 100% if breaks ${recommendation.stopLoss}`,
    };
  }

  async saveOpportunity(listingId: string, analysis: OpportunityAnalysis): Promise<void> {
    const data: InsertListingOpportunity = {
      listingId,
      symbol: '', 
      opportunityScore: analysis.scores.opportunityScore,
      liquidityScore: analysis.scores.liquidityScore,
      momentumScore: analysis.scores.momentumScore,
      riskScore: analysis.scores.riskScore,
      smartMoneyScore: analysis.scores.smartMoneyScore,
      technicalScore: analysis.scores.technicalScore,
      recommendation: analysis.recommendation as any,
      reasoning: analysis.reasoning as any,
      exitStrategy: analysis.exitStrategy,
      status: 'active',
      alertSent: false,
    };

    await db.insert(listingOpportunities).values(data);
  }

  async getOpportunities(symbol?: string, minScore: number = 0): Promise<any[]> {
    let query = db.select().from(listingOpportunities);

    if (symbol) {
      query = query.where(eq(listingOpportunities.symbol, symbol)) as any;
    }

    const opportunities = await query;
    
    return opportunities.filter(opp => (opp.opportunityScore || 0) >= minScore);
  }
}

export const listingScorerService = new ListingScorerService();
