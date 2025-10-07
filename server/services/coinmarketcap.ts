import axios, { AxiosInstance } from 'axios';
import { cache } from '../utils/cache';

interface CMCQuote {
  price: number;
  volume_24h: number;
  volume_change_24h: number;
  percent_change_1h: number;
  percent_change_24h: number;
  percent_change_7d: number;
  market_cap: number;
  market_cap_dominance: number;
  fully_diluted_market_cap: number;
  last_updated: string;
}

interface CMCCryptocurrency {
  id: number;
  name: string;
  symbol: string;
  slug: string;
  cmc_rank: number;
  num_market_pairs: number;
  circulating_supply: number;
  total_supply: number;
  max_supply: number;
  infinite_supply: boolean;
  last_updated: string;
  date_added: string;
  tags: string[];
  platform: {
    id: number;
    name: string;
    symbol: string;
    slug: string;
    token_address: string;
  } | null;
  self_reported_circulating_supply: number | null;
  self_reported_market_cap: number | null;
  quote: {
    USD: CMCQuote;
  };
}

interface CMCMetadata {
  id: number;
  name: string;
  symbol: string;
  category: string;
  description: string;
  slug: string;
  logo: string;
  subreddit: string;
  notice: string;
  tags: string[];
  'tag-names': string[];
  'tag-groups': string[];
  urls: {
    website: string[];
    twitter: string[];
    message_board: string[];
    chat: string[];
    facebook: string[];
    explorer: string[];
    reddit: string[];
    technical_doc: string[];
    source_code: string[];
    announcement: string[];
  };
  platform: any;
  date_added: string;
  twitter_username: string;
  is_hidden: number;
  date_launched: string | null;
  contract_address: any[];
  self_reported_circulating_supply: number | null;
  self_reported_tags: string[] | null;
  self_reported_market_cap: number | null;
  infinite_supply: boolean;
}

interface CMCListingsResponse {
  status: {
    timestamp: string;
    error_code: number;
    error_message: string | null;
    elapsed: number;
    credit_count: number;
    notice: string | null;
  };
  data: CMCCryptocurrency[];
}

interface CMCQuotesResponse {
  status: {
    timestamp: string;
    error_code: number;
    error_message: string | null;
    elapsed: number;
    credit_count: number;
    notice: string | null;
  };
  data: {
    [symbol: string]: CMCCryptocurrency;
  };
}

interface CMCMetadataResponse {
  status: {
    timestamp: string;
    error_code: number;
    error_message: string | null;
    elapsed: number;
    credit_count: number;
    notice: string | null;
  };
  data: {
    [symbol: string]: CMCMetadata;
  };
}

interface CMCGlobalMetrics {
  active_cryptocurrencies: number;
  total_cryptocurrencies: number;
  active_market_pairs: number;
  active_exchanges: number;
  total_exchanges: number;
  eth_dominance: number;
  btc_dominance: number;
  eth_dominance_yesterday: number;
  btc_dominance_yesterday: number;
  eth_dominance_24h_percentage_change: number;
  btc_dominance_24h_percentage_change: number;
  defi_volume_24h: number;
  defi_volume_24h_reported: number;
  defi_market_cap: number;
  defi_24h_percentage_change: number;
  stablecoin_volume_24h: number;
  stablecoin_volume_24h_reported: number;
  stablecoin_market_cap: number;
  stablecoin_24h_percentage_change: number;
  derivatives_volume_24h: number;
  derivatives_volume_24h_reported: number;
  derivatives_24h_percentage_change: number;
  quote: {
    USD: {
      total_market_cap: number;
      total_volume_24h: number;
      total_volume_24h_reported: number;
      altcoin_volume_24h: number;
      altcoin_volume_24h_reported: number;
      altcoin_market_cap: number;
      defi_volume_24h: number;
      defi_volume_24h_reported: number;
      defi_24h_percentage_change: number;
      defi_market_cap: number;
      stablecoin_volume_24h: number;
      stablecoin_volume_24h_reported: number;
      stablecoin_24h_percentage_change: number;
      stablecoin_market_cap: number;
      derivatives_volume_24h: number;
      derivatives_volume_24h_reported: number;
      derivatives_24h_percentage_change: number;
      total_market_cap_yesterday: number;
      total_volume_24h_yesterday: number;
      total_market_cap_yesterday_percentage_change: number;
      total_volume_24h_yesterday_percentage_change: number;
      last_updated: string;
    };
  };
  last_updated: string;
}

interface CMCGlobalMetricsResponse {
  status: {
    timestamp: string;
    error_code: number;
    error_message: string | null;
    elapsed: number;
    credit_count: number;
    notice: string | null;
  };
  data: CMCGlobalMetrics;
}

interface RateLimitStats {
  creditsUsed: number;
  creditsRemaining: number;
  dailyLimit: number;
  monthlyLimit: number;
  resetDaily: Date;
  resetMonthly: Date;
}

export class CoinMarketCapService {
  private client: AxiosInstance;
  private apiKey: string;
  private baseURL = 'https://pro-api.coinmarketcap.com';
  
  // Rate limiting (Free tier: 10K/month, ~333/day, 30 req/min)
  private creditsUsedToday = 0;
  private creditsUsedMonth = 0;
  private dailyLimit = 333;
  private monthlyLimit = 10000;
  private requestsThisMinute = 0;
  private minuteLimit = 30;
  private lastMinuteReset = Date.now();
  private lastDayReset = new Date().toDateString();
  private lastMonthReset = new Date().getMonth();

  constructor() {
    this.apiKey = process.env.COINMARKETCAP_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('[CMC] No API key found. CMC service will not function.');
    }

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 15000,
      headers: {
        'X-CMC_PRO_API_KEY': this.apiKey,
        'Accept': 'application/json',
        'Accept-Encoding': 'deflate, gzip',
      },
    });

    // Request interceptor for rate limiting
    this.client.interceptors.request.use(
      async (config) => {
        await this.checkRateLimit();
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to track credits
    this.client.interceptors.response.use(
      (response) => {
        const credits = response.data?.status?.credit_count || 1;
        this.creditsUsedToday += credits;
        this.creditsUsedMonth += credits;
        this.requestsThisMinute += 1;
        
        console.log(`[CMC] API call success - Credits used: ${credits}, Daily: ${this.creditsUsedToday}/${this.dailyLimit}, Monthly: ${this.creditsUsedMonth}/${this.monthlyLimit}`);
        
        return response;
      },
      (error) => {
        console.error('[CMC] API error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const currentDay = new Date().toDateString();
    const currentMonth = new Date().getMonth();

    // Reset daily counter if day changed
    if (currentDay !== this.lastDayReset) {
      this.creditsUsedToday = 0;
      this.lastDayReset = currentDay;
      console.log('[CMC] Daily credit counter reset');
    }

    // Reset monthly counter if month changed
    if (currentMonth !== this.lastMonthReset) {
      this.creditsUsedMonth = 0;
      this.lastMonthReset = currentMonth;
      console.log('[CMC] Monthly credit counter reset');
    }

    // Reset minute counter if needed
    if (now - this.lastMinuteReset >= 60000) {
      this.requestsThisMinute = 0;
      this.lastMinuteReset = now;
    }

    // Check minute limit
    if (this.requestsThisMinute >= this.minuteLimit) {
      const waitTime = 60000 - (now - this.lastMinuteReset);
      console.warn(`[CMC] Rate limit reached (${this.minuteLimit} req/min). Waiting ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.requestsThisMinute = 0;
      this.lastMinuteReset = Date.now();
    }

    // Check daily limit
    if (this.creditsUsedToday >= this.dailyLimit) {
      throw new Error(`Daily credit limit reached (${this.dailyLimit}). Try again tomorrow.`);
    }

    // Check monthly limit
    if (this.creditsUsedMonth >= this.monthlyLimit) {
      throw new Error(`Monthly credit limit reached (${this.monthlyLimit}). Upgrade plan or wait for reset.`);
    }
  }

  async getListings(params: {
    start?: number;
    limit?: number;
    sort?: 'market_cap' | 'volume_24h' | 'percent_change_24h' | 'date_added';
    sortDir?: 'asc' | 'desc';
    marketCapMin?: number;
    marketCapMax?: number;
    volumeMin?: number;
    volumeMax?: number;
  } = {}): Promise<CMCCryptocurrency[]> {
    const cacheKey = `cmc:listings:${JSON.stringify(params)}`;
    const cached = cache.get<CMCCryptocurrency[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const queryParams: any = {
        start: params.start || 1,
        limit: params.limit || 100,
        convert: 'USD',
      };

      if (params.sort) queryParams.sort = params.sort;
      if (params.sortDir) queryParams.sort_dir = params.sortDir;
      if (params.marketCapMin) queryParams.market_cap_min = params.marketCapMin;
      if (params.marketCapMax) queryParams.market_cap_max = params.marketCapMax;
      if (params.volumeMin) queryParams.volume_24h_min = params.volumeMin;
      if (params.volumeMax) queryParams.volume_24h_max = params.volumeMax;

      const response = await this.client.get<CMCListingsResponse>(
        '/v1/cryptocurrency/listings/latest',
        { params: queryParams }
      );

      if (response.data.data) {
        cache.set(cacheKey, response.data.data, 60); // Cache 1 minute
        return response.data.data;
      }

      return [];
    } catch (error) {
      console.error('[CMC] Error fetching listings:', error);
      return [];
    }
  }

  async getQuotes(symbols: string[]): Promise<{ [symbol: string]: CMCCryptocurrency }> {
    const cacheKey = `cmc:quotes:${symbols.join(',')}`;
    const cached = cache.get<{ [symbol: string]: CMCCryptocurrency }>(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const response = await this.client.get<CMCQuotesResponse>(
        '/v1/cryptocurrency/quotes/latest',
        {
          params: {
            symbol: symbols.join(','),
            convert: 'USD',
          },
        }
      );

      if (response.data.data) {
        cache.set(cacheKey, response.data.data, 60); // Cache 1 minute
        return response.data.data;
      }

      return {};
    } catch (error) {
      console.error('[CMC] Error fetching quotes:', error);
      return {};
    }
  }

  async getMetadata(symbols: string[]): Promise<{ [symbol: string]: CMCMetadata }> {
    const cacheKey = `cmc:metadata:${symbols.join(',')}`;
    const cached = cache.get<{ [symbol: string]: CMCMetadata }>(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const response = await this.client.get<CMCMetadataResponse>(
        '/v1/cryptocurrency/info',
        {
          params: {
            symbol: symbols.join(','),
          },
        }
      );

      if (response.data.data) {
        cache.set(cacheKey, response.data.data, 3600); // Cache 1 hour (metadata changes rarely)
        return response.data.data;
      }

      return {};
    } catch (error) {
      console.error('[CMC] Error fetching metadata:', error);
      return {};
    }
  }

  async getGlobalMetrics(): Promise<CMCGlobalMetrics | null> {
    const cacheKey = 'cmc:global-metrics';
    const cached = cache.get<CMCGlobalMetrics>(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const response = await this.client.get<CMCGlobalMetricsResponse>(
        '/v1/global-metrics/quotes/latest',
        {
          params: {
            convert: 'USD',
          },
        }
      );

      if (response.data.data) {
        cache.set(cacheKey, response.data.data, 60); // Cache 1 minute
        return response.data.data;
      }

      return null;
    } catch (error) {
      console.error('[CMC] Error fetching global metrics:', error);
      return null;
    }
  }

  async getMicroCaps(maxMarketCap: number = 100000000): Promise<CMCCryptocurrency[]> {
    return this.getListings({
      limit: 100,
      sort: 'market_cap',
      sortDir: 'desc',
      marketCapMax: maxMarketCap,
    });
  }

  async getNewListings(limit: number = 50): Promise<CMCCryptocurrency[]> {
    return this.getListings({
      limit,
      sort: 'date_added',
      sortDir: 'desc',
    });
  }

  getRateLimitStats(): RateLimitStats {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCHours(24, 0, 0, 0);
    
    const nextMonth = new Date(now);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1, 1);
    nextMonth.setUTCHours(0, 0, 0, 0);

    return {
      creditsUsed: this.creditsUsedMonth,
      creditsRemaining: this.monthlyLimit - this.creditsUsedMonth,
      dailyLimit: this.dailyLimit,
      monthlyLimit: this.monthlyLimit,
      resetDaily: tomorrow,
      resetMonthly: nextMonth,
    };
  }

  // Calculate tokenomics score for alpha screening
  calculateTokenomicsScore(coin: CMCCryptocurrency): {
    score: number;
    circulatingRatio: number;
    dilutionRisk: number;
    details: string[];
  } {
    const details: string[] = [];
    let score = 0;

    // Circulating supply ratio (max 15 points)
    const circulatingRatio = coin.total_supply > 0 
      ? coin.circulating_supply / coin.total_supply 
      : 0;
    
    if (circulatingRatio >= 0.8) {
      score += 15;
      details.push('✅ High circulating ratio (80%+)');
    } else if (circulatingRatio >= 0.5) {
      score += 10;
      details.push('⚠️ Medium circulating ratio (50-80%)');
    } else {
      score += 5;
      details.push('❌ Low circulating ratio (<50%)');
    }

    // FDV dilution risk (max 10 points)
    const currentMC = coin.quote.USD.market_cap;
    const fdv = coin.quote.USD.fully_diluted_market_cap;
    const dilutionRisk = fdv > 0 ? (fdv - currentMC) / currentMC : 0;

    if (dilutionRisk < 0.5) {
      score += 10;
      details.push('✅ Low dilution risk (<50%)');
    } else if (dilutionRisk < 2) {
      score += 5;
      details.push('⚠️ Medium dilution risk (50-200%)');
    } else {
      score += 0;
      details.push('❌ High dilution risk (>200%)');
    }

    // Supply cap (max 5 points)
    if (!coin.infinite_supply && coin.max_supply > 0) {
      score += 5;
      details.push('✅ Capped supply');
    } else {
      details.push('⚠️ Infinite/uncapped supply');
    }

    return {
      score: Math.min(score, 30), // Max 30 points for tokenomics
      circulatingRatio,
      dilutionRisk,
      details,
    };
  }
}

// Singleton instance
export const cmcService = new CoinMarketCapService();
