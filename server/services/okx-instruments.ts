import axios, { AxiosInstance } from 'axios';
import { createHmac } from 'crypto';
import { cache } from '../utils/cache';

interface OKXInstrument {
  instId: string;
  instType: string;
  uly: string;
  baseCcy: string;
  quoteCcy: string;
  state: string;
  listTime: string;
}

interface OKXInstrumentsResponse {
  code: string;
  msg: string;
  data: OKXInstrument[];
}

export class OKXInstrumentsService {
  private client: AxiosInstance;
  private apiKey: string;
  private secretKey: string;
  private passphrase: string;
  private baseURL = 'https://www.okx.com';

  constructor() {
    this.apiKey = process.env.OKX_API_KEY || '';
    this.secretKey = process.env.OKX_SECRET_KEY || '';
    this.passphrase = process.env.OKX_PASSPHRASE || '';

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'OK-ACCESS-KEY': this.apiKey,
        'OK-ACCESS-PASSPHRASE': this.passphrase,
      },
    });

    this.client.interceptors.request.use(
      (config) => {
        const timestamp = Date.now() / 1000;
        const method = config.method?.toUpperCase() || 'GET';
        const requestPath = config.url || '';
        const body = config.data ? JSON.stringify(config.data) : '';
        
        const prehashString = timestamp + method + requestPath + body;
        const signature = this.createSignature(prehashString);
        
        config.headers['OK-ACCESS-SIGN'] = signature;
        config.headers['OK-ACCESS-TIMESTAMP'] = timestamp.toString();
        
        return config;
      },
      (error) => Promise.reject(error)
    );
  }

  private createSignature(prehashString: string): string {
    return createHmac('sha256', this.secretKey).update(prehashString).digest('base64');
  }

  async getInstruments(instType: string = 'SWAP'): Promise<OKXInstrument[]> {
    const cacheKey = `okx:instruments:${instType}`;
    const cached = cache.get<OKXInstrument[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const response = await this.client.get<OKXInstrumentsResponse>(
        `/api/v5/public/instruments?instType=${instType}`
      );

      if (response.data.code === '0' && response.data.data) {
        const instruments = response.data.data.filter(inst => inst.state === 'live');
        cache.set(cacheKey, instruments, 300); // Cache for 5 minutes
        return instruments;
      }

      return [];
    } catch (error) {
      console.error('Error fetching OKX instruments:', error);
      return [];
    }
  }

  async detectNewListings(existingSymbols: Set<string>): Promise<OKXInstrument[]> {
    const currentInstruments = await this.getInstruments('SWAP');
    
    const newListings = currentInstruments.filter(inst => {
      const symbol = inst.instId;
      return !existingSymbols.has(symbol) && inst.state === 'live';
    });

    return newListings;
  }

  async getInstrumentDetails(instId: string): Promise<OKXInstrument | null> {
    try {
      const response = await this.client.get<OKXInstrumentsResponse>(
        `/api/v5/public/instruments?instType=SWAP&instId=${instId}`
      );

      if (response.data.code === '0' && response.data.data.length > 0) {
        return response.data.data[0];
      }

      return null;
    } catch (error) {
      console.error('Error fetching instrument details:', error);
      return null;
    }
  }
}

export const okxInstrumentsService = new OKXInstrumentsService();
