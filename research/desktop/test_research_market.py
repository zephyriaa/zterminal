import time
import unittest
from unittest.mock import patch
from research_market import instrument, history, funding


class ResearchMarketTests(unittest.TestCase):
    def test_instrument_canonicalizes_without_wrong_market_fallback(self):
        raw={'name':'BTC_USDT','in_delisting':False,'enable_decimal':False,'quanto_multiplier':'.0001','order_price_round':'.1','order_size_min':1,'maker_fee_rate':'.0002','taker_fee_rate':'.0005'}
        with patch('research_market.read_json',return_value=raw):
            result=instrument({'provider':'gateio','symbol':'BTCUSDT'})
            self.assertEqual(result['symbol'],'BTC_USDT')
            self.assertEqual(result['multiplier'],.0001)
            self.assertEqual(result['takerFeeBps'],5)
            with self.assertRaises(ValueError): instrument({'provider':'gateio','symbol':'ETH_USDT'})

    def test_history_requires_all_candles_and_valid_units(self):
        end=int(time.time()*1000)//3600000*3600000
        body={'provider':'gateio','symbol':'BTC_USDT','timeframe':'1h','from':end-3*3600000,'to':end}
        raw=[{'t':t//1000,'o':'100','h':'101','l':'99','c':'100','v':'200'} for t in range(body['from'],end,3600000)]
        with patch('research_market.read_json',return_value=raw): self.assertEqual(len(history(body)['bars']),3)
        with patch('research_market.read_json',return_value=raw[:-1]):
            with self.assertRaisesRegex(ValueError,'Incomplete'): history(body)
        body['from']=end-70080*3600000
        with self.assertRaisesRegex(ValueError,'10,000'): history(body)

    def test_missing_funding_cannot_be_reported_as_zero(self):
        end=int(time.time()*1000)//3600000*3600000
        body={'provider':'gateio','symbol':'BTC_USDT','timeframe':'1h','from':end-24*3600000,'to':end}
        with patch('research_market.read_json',return_value=[]):
            with self.assertRaisesRegex(ValueError,'missing'): funding(body)


if __name__ == '__main__': unittest.main()
