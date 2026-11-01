import assert from 'node:assert/strict';
import { normalizeChartBars } from '../../../../src/lib/market/chart-data';
import { timeToLogical, logicalToTime } from '../../../../src/lib/chart/drawings/coordinates';
import { evaluateIndicator } from '../../../../src/lib/chart/indicators/evaluators';
import { createStudy } from '../../../../src/lib/indicator-library';
import { minutesSinceMidnightET } from '../../../../src/lib/market/session';

// TEST ONLY: characterize existing boundaries without changing the product.
const invalid = {t:0,o:10,h:5,l:15,c:10,v:-1};
const accepted = normalizeChartBars([invalid]);
assert.equal(accepted.length,1); // Existing display normalization checks finite fields only.
const corrected = {...invalid,c:11};
assert.equal(normalizeChartBars([invalid,corrected])[0].c,11); // Last duplicate wins silently.
const origin = BigInt('9007199254740992');
assert.equal(Number(origin),Number(origin+BigInt(1))); // Existing native double conversion loses a tick here.
assert.equal(Number((origin+BigInt(1))-origin),1); // Exact local-origin subtraction would preserve it.
const times = [0,60_000,180_000];
assert.equal(timeToLogical(times,120_000,60_000),1.5);
assert.equal(logicalToTime(times,1.5,60_000),120_000);
const study = createStudy('ema20'); study.inputs.length=3;
const bars = [1,2,3,1e6].map((c,i)=>({t:i*60_000,o:c,h:c,l:c,c,v:1}));
assert.deepEqual(evaluateIndicator(study,bars.slice(0,3),'UTC')[0].values,[1,1.5,2.25]);
assert.equal(minutesSinceMidnightET(Date.UTC(2026,6,1,13,30)),510);
const trueEt = new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(Date.UTC(2026,6,1,13,30)));
assert.equal(trueEt,'09:30');
console.log(JSON.stringify({test_only:true,display_normalization_accepts_invalid_ohlcv:true,last_duplicate_wins:true,absolute_double_tick_collision:true,local_origin_retains_tick:true,gap_anchor_inverse:true,ema_prefix:[1,1.5,2.25],fixed_est_helper_minutes:510,iana_et:trueEt},null,2));
