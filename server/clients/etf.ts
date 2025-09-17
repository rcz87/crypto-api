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

    const map = await getApiMap();
    const path = `${map['etf_flows'] || '/advanced/etf/flows'}?asset=${asset}`;

    try {
      return await getJson(path);
    } catch (e: any) {
      if (e.status === 402) {
        this.openCircuit();
        const err: any = new Error('ETF_PAYMENT_REQUIRED');
        err.soft = true; // soft-fail
        throw err;
      }
      throw e;
    }
  }
}