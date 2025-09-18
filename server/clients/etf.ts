import { getApiMap, getJson } from '../services/discovery';

const CIRCUIT_MS_DEFAULT = 60 * 60 * 1000; // 1 jam

export class EtfClient {
  private circuitUntil: number | null = null;

  constructor(private circuitMs = CIRCUIT_MS_DEFAULT) {}

  circuitOpen() {
    return this.circuitUntil !== null && Date.now() < this.circuitUntil;
  }

  private openCircuit() {
    this.circuitUntil = Date.now() + this.circuitMs;
  }

  async getFlows(asset: 'BTC' | 'ETH') {
    if (this.circuitOpen()) {
      const err: any = new Error('ETF_CIRCUIT_OPEN');
      err.soft = true;
      throw err;
    }

    // Use unified POST endpoint
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    try {
      const response = await fetch((process.env.PY_BASE || 'http://127.0.0.1:8000') + '/gpts/advanced', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          op: 'etf_flows',
          params: {
            asset: asset
          }
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 402) {
          this.openCircuit();
          const err: any = new Error('ETF_PAYMENT_REQUIRED');
          err.soft = true;
          throw err;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.message?.includes('402') || (error instanceof Error && error.message.includes('ETF_PAYMENT_REQUIRED'))) {
        this.openCircuit();
        const err: any = new Error('ETF_PAYMENT_REQUIRED');
        err.soft = true;
        throw err;
      }
      throw error;
    }
  }
}