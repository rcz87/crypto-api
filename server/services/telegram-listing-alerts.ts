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
      const signal = this.getSignalEmoji(spike.signal || 'neutral');

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
        message.push('🐋 *Whale Activity:*');
        message.push(`   • ${spike.whaleCount} large orders detected`);
        message.push(`   • Total: $${parseFloat(spike.whaleTotalUsd || '0').toLocaleString()}`);
        const avgSize = parseFloat(spike.whaleTotalUsd || '0') / spike.whaleCount;
        message.push(`   • Avg size: $${avgSize.toLocaleString()}`);
        message.push('');
      }

      if (spike.openInterestChange) {
        message.push('📈 *Open Interest:*');
        message.push(`   • Change: +${spike.openInterestChange}%`);
        message.push('');
      }

      if (spike.fundingRateChange) {
        message.push(`⚡ Funding Rate: ${spike.fundingRateChange}% ${this.getFundingEmoji(parseFloat(spike.fundingRateChange))}`);
        message.push('');
      }

      message.push(`🎯 *Signal:* ${signal} ${spike.signal?.toUpperCase() || 'NEUTRAL'}`);
      message.push(`💡 Confidence: ${spike.confidence || 0}%`);
      message.push('');
      message.push(`⚡ *Entry window:* Next 10-15 min`);

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
