import type { FeedHealthStatus } from "../market/l2-types";

export type DealerConvention = 'DEALER_LONG_CALLS_SHORT_PUTS' | 'DEALER_SHORT_ALL';

export type OptionType = 'call' | 'put';

export interface RawDeribitOptionSummary {
  instrument_name: string;
  underlying_price?: number;
  underlying_index?: string;
  mark_price?: number;
  mark_iv?: number;
  bid_iv?: number;
  ask_iv?: number;
  open_interest?: number;
  volume?: number;
  delta?: number;
  gamma?: number;
  creation_timestamp?: number;
  estimated_delivery_price?: number;
}

export interface ParsedOptionContract {
  instrumentName: string;
  underlying: 'BTC' | 'ETH';
  expiryTimestamp: number;
  timeToExpiryYears: number;
  strike: number;
  type: OptionType;
  openInterest: number;
  markIv: number; // decimal (e.g. 0.55 for 55%)
  markPrice: number;
  delta: number;
  underlyingPrice: number;
}

export interface GexStrike {
  strike: number;
  callGex: number;
  putGex: number;
  netGex: number;           // Signed dealer estimate
  grossGamma: number;       // Objective raw gamma sum
  callOI: number;
  putOI: number;
  callVolume: number;
  putVolume: number;
}

export interface GexProfile {
  underlying: 'BTC' | 'ETH';
  indexPrice: number;
  gammaFlip: number | null;
  totalCallGex: number;
  totalPutGex: number;
  netGex: number;
  totalGrossGamma: number;
  callOiWall: number;
  putOiWall: number;
  callVolumeWall?: number;
  putVolumeWall?: number;
  timestamp: number;
  isEstimate: true;         // Mandated research integrity tag
  dealerConvention: DealerConvention;
  health: FeedHealthStatus;
  strikes: GexStrike[];
}
