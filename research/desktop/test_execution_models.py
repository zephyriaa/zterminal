import unittest
import pandas as pd
from execution_models import impact_bps, liquidity_inputs, validate_execution


class ExecutionModelTests(unittest.TestCase):
    def test_square_root_impact_and_units(self):
        cost, participation = impact_bps(100, 10, 1, 2, 1000, 'binance')
        self.assertAlmostEqual(cost, 10)
        self.assertAlmostEqual(participation, .01)
        self.assertAlmostEqual(impact_bps(100, 40, 1, 2, 1000, 'binance')[0], cost*2)
        self.assertEqual(impact_bps(100, 10, .0001, 2, 1000, 'gateio')[0], cost)
        with self.assertRaises(ValueError): impact_bps(100, 1, 1, 2, 0, 'binance')

    def test_current_and_future_candles_cannot_change_opening_impact(self):
        frame = pd.DataFrame({'open': [100.]*30, 'high': [102.]*30, 'low': [98.]*30, 'close': [100.]*30, 'volume': [1000.]*30})
        a, v = liquidity_inputs(frame)
        frame.loc[20:, ['high','volume']] = 1e9
        changed, volume = liquidity_inputs(frame)
        self.assertEqual(a.iloc[20], changed.iloc[20])
        self.assertEqual(v.iloc[20], volume.iloc[20])

    def test_wrong_venue_or_fabricated_fee_rejected(self):
        with self.assertRaises(ValueError): validate_execution({'provider':'gateio','exchangeProfile':'binance_vip9','feeBps':1.7}, {})
        with self.assertRaises(ValueError): validate_execution({'provider':'binance','exchangeProfile':'binance_vip9','feeBps':0}, {})


if __name__ == '__main__': unittest.main()
