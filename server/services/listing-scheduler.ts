import { listingsService } from './listings';
import { listingScorerService } from './listing-scorer';
import { telegramListingAlerts } from './telegram-listing-alerts';
import { db } from '../db';
import { newListings, volumeSpikes, listingOpportunities } from '@shared/schema';
import { eq } from 'drizzle-orm';

let schedulerInterval: NodeJS.Timeout | null = null;
let isRunning = false;

const SCAN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MIN_OPPORTUNITY_SCORE = 40; // Lower threshold for more alerts (testing)

async function scanAndAlert(): Promise<void> {
  if (isRunning) {
    console.log('[Listing Scheduler] Previous scan still running, skipping...');
    return;
  }

  isRunning = true;
  const startTime = Date.now();

  try {
    console.log('[Listing Scheduler] 🔍 Starting listing scan...');

    await listingsService.initializeMonitoredSymbols();

    const [newLis, spikes] = await Promise.all([
      listingsService.scanNewListings(),
      listingsService.detectVolumeSpikes(),
    ]);

    console.log(`[Listing Scheduler] ✅ Scan complete: ${newLis.length} new listings, ${spikes.length} volume spikes`);

    for (const listing of newLis) {
      if (!listing.alertSent) {
        const sent = await telegramListingAlerts.sendNewListingAlert(listing);
        
        if (sent) {
          await db
            .update(newListings)
            .set({ alertSent: true })
            .where(eq(newListings.id, listing.id));
          
          console.log(`[Listing Scheduler] 📤 Alert sent for new listing: ${listing.symbol}`);
        }
      }

      try {
        const analysis = await listingScorerService.analyzeOpportunity(listing);
        
        if (analysis.scores.opportunityScore >= MIN_OPPORTUNITY_SCORE) {
          await listingScorerService.saveOpportunity(listing.id, analysis);

          const sent = await telegramListingAlerts.sendOpportunityAlert({
            symbol: listing.symbol,
            score: analysis.scores.opportunityScore,
            recommendation: analysis.recommendation,
            reasoning: analysis.reasoning,
          });

          if (sent) {
            console.log(`[Listing Scheduler] 💎 Opportunity alert sent: ${listing.symbol} (Score: ${analysis.scores.opportunityScore})`);
          }
        }
      } catch (error) {
        console.error(`[Listing Scheduler] Error analyzing ${listing.symbol}:`, error);
      }
    }

    for (const spike of spikes) {
      if (!spike.alertSent) {
        const sent = await telegramListingAlerts.sendVolumeSpikeAlert(spike);
        
        if (sent) {
          await db
            .update(volumeSpikes)
            .set({ alertSent: true })
            .where(eq(volumeSpikes.id, spike.id));
          
          console.log(`[Listing Scheduler] 📤 Volume spike alert sent: ${spike.symbol}`);
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Listing Scheduler] ⏱️ Scan completed in ${duration}ms`);

  } catch (error) {
    console.error('[Listing Scheduler] ❌ Scan error:', error);
  } finally {
    isRunning = false;
  }
}

export function startListingScheduler(): void {
  // 🔧 PATCH 9: DISABLE LISTING SCHEDULER (memory/API optimization)
  // This scheduler was causing MASSIVE memory leaks by processing 200+ instruments
  // as "new listings" on every scan, consuming API quota and causing DB errors
  const LISTING_SCHEDULER_ENABLED = process.env.LISTING_SCHEDULER_ENABLED === 'true';
  
  if (!LISTING_SCHEDULER_ENABLED) {
    console.log('⏸️  [Listing Scheduler] DISABLED (memory optimization - set LISTING_SCHEDULER_ENABLED=true to enable)');
    return;
  }

  console.log('[Listing Scheduler] 🚀 Starting listing detection scheduler...');
  console.log(`[Listing Scheduler] ⏰ Scan interval: ${SCAN_INTERVAL_MS / 1000}s`);
  console.log(`[Listing Scheduler] 🎯 Min opportunity score for alerts: ${MIN_OPPORTUNITY_SCORE}`);

  scanAndAlert();

  schedulerInterval = setInterval(scanAndAlert, SCAN_INTERVAL_MS);
}

export function stopListingScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[Listing Scheduler] 🛑 Scheduler stopped');
  }
}

export function getSchedulerStatus(): { running: boolean; interval: number; isScanning: boolean } {
  return {
    running: schedulerInterval !== null,
    interval: SCAN_INTERVAL_MS,
    isScanning: isRunning,
  };
}
