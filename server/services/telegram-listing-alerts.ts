import { sendTelegram } from '../observability/telegram';
import { NewListing, VolumeSpike } from '@shared/schema';

interface OpportunityAlert {
  symbol: string;
  score: number;
  recommendation: any;
  reasoning: string[];
}

export class TelegramListingAlertsService {
  async sendNewListingAlert(listing: NewListing): Promise<boolean> {
    try {
      const hoursOld = (Date.now() - new Date(listing.listingTime).getTime()) / (1000 * 60 * 60);
      const price = listing.currentPrice || listing.initialPrice;

      const message = [
        '🔔 *NEW LISTING ALERT!*',
        '━━━━━━━━━━━━━━━━━━',
        `🪙 ${listing.symbol}`,
        `📊 Exchange: ${listing.exchange}`,
        `⏰ Listed: ${new Date(listing.listingTime).toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })} WIB`,
        `💰 Price: $${price}`,
        `📈 Volume (1h): ${listing.volume24h ? `$${parseFloat(listing.volume24h).toLocaleString()}` : 'Calculating...'}`,
        '',
        `⚡ *Action:* Monitor for spikes`,
        `🕐 Detected: ${hoursOld.toFixed(1)}h ago`,
      ].join('\n');

      return await sendTelegram(message, { parseMode: 'Markdown' });
    } catch (error) {
      console.error('Error sending new listing alert:', error);
      return false;
    }
  }

  async sendVolumeSpikeAlert(spike: VolumeSpike): Promise<boolean> {
    try {
      const spikePercent = parseFloat(spike.spikePercentage);
      const signal = spike.signal || 'neutral';
      const signalEmoji = this.getSignalEmoji(signal);
      const directionEmoji = this.getDirectionEmoji(signal);

      const message = [
        '🚨 *VOLUME SPIKE ALERT!*',
        '━━━━━━━━━━━━━━━━━━',
        `🪙 ${spike.symbol}`,
        '',
        '📊 *Volume Explosion:*',
        `   Normal: $${parseFloat(spike.normalVolume).toLocaleString()}/h`,
        `   Now: $${parseFloat(spike.spikeVolume).toLocaleString()}/h`,
        `   Spike: *+${spikePercent.toFixed(0)}%*`,
        '',
      ];

      if (spike.whaleCount && spike.whaleCount > 0) {
        const metadata = spike.metadata as any || {};
        const whaleBuyPressure = metadata.whaleBuyOrders || 0;
        const whaleSellPressure = metadata.whaleSellOrders || 0;
        const totalWhaleUsd = parseFloat(spike.whaleTotalUsd || '0');
        const avgSize = totalWhaleUsd / spike.whaleCount;
        
        message.push('🐋 *Whale Activity:*');
        message.push(`   • ${spike.whaleCount} large orders detected`);
        message.push(`   • Total: $${totalWhaleUsd.toLocaleString()}`);
        message.push(`   • Avg size: $${avgSize.toLocaleString()}`);
        
        if (whaleBuyPressure > 0 || whaleSellPressure > 0) {
          message.push(`   • Direction: ${whaleBuyPressure > whaleSellPressure ? '🟢 BUY' : '🔴 SELL'} pressure`);
          message.push(`     (${whaleBuyPressure} buy / ${whaleSellPressure} sell)`);
        }
        message.push('');
      }

      const metadata = spike.metadata as any || {};
      if (metadata.buyVolume || metadata.sellVolume) {
        const buyVol = parseFloat(metadata.buyVolume || '0');
        const sellVol = parseFloat(metadata.sellVolume || '0');
        const total = buyVol + sellVol;
        const buyPercent = (buyVol / total) * 100;
        const sellPercent = (sellVol / total) * 100;
        const cvd = buyVol - sellVol;
        
        message.push('📈 *Order Flow Analysis:*');
        message.push(`   • Buy Volume: $${buyVol.toLocaleString()} (${buyPercent.toFixed(1)}%)`);
        message.push(`   • Sell Volume: $${sellVol.toLocaleString()} (${sellPercent.toFixed(1)}%)`);
        message.push(`   • CVD: ${cvd >= 0 ? '+' : ''}$${cvd.toLocaleString()}`);
        message.push(`   • Pressure: ${buyPercent > sellPercent ? '🟢 BULLISH' : '🔴 BEARISH'}`);
        message.push('');
      }

      if (spike.openInterestChange) {
        const oiChange = parseFloat(spike.openInterestChange);
        message.push('📊 *Open Interest:*');
        message.push(`   • Change: ${oiChange >= 0 ? '+' : ''}${oiChange.toFixed(1)}%`);
        message.push(`   • Interpretation: ${oiChange > 0 ? 'New positions opening' : 'Positions closing'}`);
        message.push('');
      }

      if (spike.fundingRateChange) {
        const frChange = parseFloat(spike.fundingRateChange);
        message.push(`⚡ *Funding Rate:* ${frChange >= 0 ? '+' : ''}${frChange}% ${this.getFundingEmoji(frChange)}`);
        message.push(`   ${frChange > 0 ? 'Longs paying shorts' : 'Shorts paying longs'}`);
        message.push('');
      }

      message.push(`${directionEmoji} *TRADING SIGNAL:* ${signalEmoji} ${signal.toUpperCase()}`);
      message.push(`💡 Confidence: ${spike.confidence || 0}%`);
      message.push('');
      
      if (signal === 'buy') {
        message.push(`🎯 *Action:* CONSIDER LONG POSITION`);
        message.push(`⚡ Entry window: Next 10-15 min`);
        message.push(`🛡️ Manage risk: Use stop loss`);
      } else if (signal === 'sell') {
        message.push(`🎯 *Action:* CONSIDER SHORT POSITION`);
        message.push(`⚡ Entry window: Next 10-15 min`);
        message.push(`🛡️ Manage risk: Use stop loss`);
      } else {
        message.push(`⚠️ *Action:* MONITOR - Mixed signals`);
      }

      return await sendTelegram(message.join('\n'), { parseMode: 'Markdown' });
    } catch (error) {
      console.error('Error sending volume spike alert:', error);
      return false;
    }
  }

  async sendOpportunityAlert(opportunity: OpportunityAlert): Promise<boolean> {
    try {
      const { symbol, score, recommendation, reasoning } = opportunity;
      const actionEmoji = this.getActionEmoji(recommendation.action);

      const message = [
        '💎 *OPPORTUNITY ALERT!*',
        '━━━━━━━━━━━━━━━━━━',
        `🪙 ${symbol}`,
        `📊 Score: *${score}/100*`,
        '',
        `${actionEmoji} *${recommendation.action}*`,
        '',
        '📈 *Trade Setup:*',
      ];

      if (recommendation.entry) {
        message.push(`   Entry: ${recommendation.entry}`);
      }
      if (recommendation.stopLoss) {
        message.push(`   Stop Loss: ${recommendation.stopLoss}`);
      }
      if (recommendation.targets && recommendation.targets.length > 0) {
        message.push(`   Targets:`);
        recommendation.targets.forEach((target: string, i: number) => {
          message.push(`     ${i + 1}. ${target}`);
        });
      }
      if (recommendation.riskReward) {
        message.push(`   R:R: ${recommendation.riskReward}`);
      }
      if (recommendation.positionSize) {
        message.push(`   Position: ${recommendation.positionSize} portfolio`);
      }
      if (recommendation.timeframe) {
        message.push(`   Timeframe: ${recommendation.timeframe}`);
      }

      message.push('');
      message.push('💡 *Analysis:*');
      reasoning.slice(0, 5).forEach(reason => {
        message.push(`   ${reason}`);
      });

      message.push('');
      message.push(`🔍 Confidence: ${recommendation.confidence}`);

      return await sendTelegram(message.join('\n'), { parseMode: 'Markdown' });
    } catch (error) {
      console.error('Error sending opportunity alert:', error);
      return false;
    }
  }

  async sendAlphaOpportunityAlert(opportunity: {
    symbol: string;
    marketCap: number;
    price: number;
    alphaScore: number;
    tokenomicsScore?: number;
    circulatingRatio?: number;
    dilutionRisk?: number;
    reasoning?: string[];
  }): Promise<boolean> {
    try {
      const mcInM = (opportunity.marketCap / 1000000).toFixed(2);
      const emoji = opportunity.alphaScore >= 80 ? '💎💎' : opportunity.alphaScore >= 70 ? '💎' : '📊';

      const message = [
        `${emoji} *ALPHA OPPORTUNITY!*`,
        '━━━━━━━━━━━━━━━━━━',
        `🪙 ${opportunity.symbol}`,
        '',
        '📊 *Multi-Exchange Data (CMC):*',
        `   • Market Cap: $${mcInM}M`,
        `   • Price: $${opportunity.price.toFixed(8)}`,
        `   • Alpha Score: *${opportunity.alphaScore}/100*`,
        '',
      ];

      if (opportunity.tokenomicsScore !== undefined) {
        message.push('🔗 *Tokenomics Analysis:*');
        message.push(`   • Score: ${opportunity.tokenomicsScore}/30`);
        if (opportunity.circulatingRatio !== undefined) {
          const ratio = (opportunity.circulatingRatio * 100).toFixed(0);
          message.push(`   • Circulating: ${ratio}%`);
        }
        if (opportunity.dilutionRisk !== undefined) {
          const risk = (opportunity.dilutionRisk * 100).toFixed(0);
          message.push(`   • Dilution Risk: ${risk}%`);
        }
        message.push('');
      }

      if (opportunity.reasoning && opportunity.reasoning.length > 0) {
        message.push('💡 *Key Insights:*');
        opportunity.reasoning.slice(0, 4).forEach(reason => {
          message.push(`   ${reason}`);
        });
        message.push('');
      }

      if (opportunity.alphaScore >= 80) {
        message.push('🎯 *Action:* HIGH CONVICTION - Consider Position');
      } else if (opportunity.alphaScore >= 70) {
        message.push('🎯 *Action:* STRONG CANDIDATE - Research Further');
      } else {
        message.push('🎯 *Action:* MONITOR - Emerging Opportunity');
      }

      message.push('');
      message.push('📱 Data from 300+ exchanges via CoinMarketCap');

      return await sendTelegram(message.join('\n'), { parseMode: 'Markdown' });
    } catch (error) {
      console.error('Error sending alpha opportunity alert:', error);
      return false;
    }
  }

  async sendDailySummary(stats: {
    newListings: number;
    volumeSpikes: number;
    opportunities: number;
    topOpportunities: any[];
  }): Promise<boolean> {
    try {
      const message = [
        '📊 *DAILY LISTINGS SUMMARY*',
        '━━━━━━━━━━━━━━━━━━',
        `📅 ${new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Jakarta' })} WIB`,
        '',
        '📈 *Today\'s Activity:*',
        `   • New Listings: ${stats.newListings}`,
        `   • Volume Spikes: ${stats.volumeSpikes}`,
        `   • Opportunities: ${stats.opportunities}`,
        '',
      ];

      if (stats.topOpportunities.length > 0) {
        message.push('🏆 *Top Opportunities:*');
        stats.topOpportunities.slice(0, 3).forEach((opp, i) => {
          message.push(`   ${i + 1}. ${opp.symbol} - Score: ${opp.score}`);
        });
        message.push('');
      }

      message.push(`Generated: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })} WIB`);

      return await sendTelegram(message.join('\n'), { parseMode: 'Markdown' });
    } catch (error) {
      console.error('Error sending daily summary:', error);
      return false;
    }
  }

  private getSignalEmoji(signal: string): string {
    switch (signal.toLowerCase()) {
      case 'buy':
        return '🟢';
      case 'sell':
        return '🔴';
      default:
        return '⚪';
    }
  }

  private getDirectionEmoji(signal: string): string {
    switch (signal.toLowerCase()) {
      case 'buy':
        return '📈';
      case 'sell':
        return '📉';
      default:
        return '➡️';
    }
  }

  private getActionEmoji(action: string): string {
    if (action.includes('STRONG BUY')) return '🟢🟢';
    if (action.includes('BUY')) return '🟢';
    if (action.includes('SELL')) return '🔴';
    if (action.includes('MONITOR')) return '🟡';
    return '⛔';
  }

  private getFundingEmoji(rate: number): string {
    if (rate > 0.05) return '🔥';
    if (rate > 0) return '📈';
    if (rate < -0.05) return '❄️';
    return '📉';
  }
}

export const telegramListingAlerts = new TelegramListingAlertsService();
