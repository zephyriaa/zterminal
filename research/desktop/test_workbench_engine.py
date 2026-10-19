import copy
import tempfile
import unittest
from pathlib import Path
from archive import Archive
from engine import execute
from research_analysis import execute_analysis
from test_research_workflow import modern, history
from validation import digest


class WorkbenchEngineTests(unittest.TestCase):
    def test_config_defaults_overrides_and_compiler_positions(self):
        source = 'import zterminal as zt\nCONFIG={"length": 2}\nPERIOD=CONFIG["length"]\ndef strategy(data, params):\n i=data.close*0+PERIOD\n return zt.Strategy(i == 3, i < 0)\n'
        request = modern(source)
        request['params'] = {'length': 3}
        result = execute(request)
        self.assertEqual(result['resolvedParams']['length'], 3)
        self.assertTrue(result['trades'])
        request = modern('import zterminal as zt\ndef strategy(data, params):\n return zt.Strategy(data.close.shift(-1)>data.close,data.close<0)\n', guardrails=True)
        with self.assertRaises(SyntaxError) as error: execute(request)
        self.assertEqual(error.exception.lineno, 3)

    def test_preroll_excluded_and_holdout_applies_only_to_visible_range(self):
        request = modern(prices=[100.]*40, reserveHoldout=True, warmupBars=20, autoWarmup=True)
        request['source'] = request['source'].replace('i == 0, i == 2', 'i == 20, i == 23')
        request['config']['evaluationFrom'] = request['config']['from']+20*3600000
        result = execute(request)
        self.assertEqual(len(result['equity']), 36)  # 20 context + 80% of 20 scored bars
        self.assertTrue(all(t['entryTime'] >= request['config']['evaluationFrom'] for t in result['trades']))
        self.assertEqual(result['metrics']['exposure']['value'], 3/16)
        Archive.validate_result(result)

    def test_dynamic_fills_use_prior_volume_and_reconcile(self):
        source = 'import pandas as pd\nimport zterminal as zt\ndef strategy(data, params):\n i=pd.Series(range(len(data)),index=data.index)\n return zt.Strategy(i==20,i==23)\n'
        request = modern(source, prices=[100.]*30, warmupBars=20, impactModel='atr_volume_v1', liquidityTier='institutional', allocation=1)
        for bar in request['dataset']['bars']: bar['v'] = 1000
        request['dataset']['hash'] = digest([[b[k] for k in ('t','o','h','l','c','v')] for b in request['dataset']['bars']])
        result = execute(request)
        self.assertGreater(result['fills'][0]['slippageBps'], 0)
        self.assertLessEqual(result['fills'][0]['participation'], .05)
        changed = copy.deepcopy(request)
        changed['dataset']['bars'][21]['v'] = 1e9
        changed['dataset']['hash'] = digest([[b[k] for k in ('t','o','h','l','c','v')] for b in changed['dataset']['bars']])
        other = execute(changed)
        self.assertEqual(result['fills'][0]['price'], other['fills'][0]['price'])
        Archive.validate_result(result)

    def test_funding_sign_timing_and_archive_cash_identity(self):
        for side, sign in [('long',1),('short',-1)]:
            request = modern(prices=[100.]*6, fundingMode='historical', direction='both')
            if side == 'short': request['source'] = request['source'].replace('zt.Strategy(i == 0, i == 2)','zt.Strategy(i < 0, i < 0, i == 0, i == 2)')
            start = request['config']['from']
            events = [{'time':start+3600000,'rate':.01,'markPrice':100}, {'time':start+2*3600000,'rate':.01,'markPrice':100}]
            request['fundingData'] = {**{k:request['config'][k] for k in ('provider','symbol','from','to')},'events':events,'hash':digest(events)}
            result = execute(request)
            # Position opens at first event; only the second event is owed.
            self.assertEqual(len(result['funding']),1)
            self.assertEqual(result['funding'][0]['payment'],sign)
            self.assertAlmostEqual(result['trades'][0]['pnl'], -sign)
            self.assertAlmostEqual(result['accounts'][-1]['equity'],1000-sign)
            Archive.validate_result(result)

    def test_final_candle_intrabar_funding_is_charged_before_marking_equity(self):
        request = modern(prices=[100.]*6, fundingMode='historical')
        request['source'] = request['source'].replace('i == 0, i == 2', 'i == 0, i < 0')
        event = {'time':request['config']['to']-1800000,'rate':.01,'markPrice':100}
        events = [event]
        request['fundingData'] = {**{k:request['config'][k] for k in ('provider','symbol','from','to')},'events':events,'hash':digest(events)}
        result = execute(request)
        self.assertEqual(len(result['funding']),1)
        self.assertEqual(result['accounts'][-1]['fundingPaid'],1)
        self.assertEqual(result['trades'][-1]['pnl'],-.5)  # +0.5 mark gain minus 1 funding.
        Archive.validate_result(result)

    def test_background_health_preserves_frozen_base_and_never_consumes_holdout(self):
        result = execute(history(days=80))
        original = copy.deepcopy(result)
        analysis = execute_analysis({'kind':'health','result':result},lambda _:None)
        self.assertEqual(result, original)
        self.assertFalse(analysis['payload']['holdoutEvaluated'])
        self.assertFalse(analysis['payload']['calibratedProbability'])
        Archive.validate_analysis(analysis,result)
        with tempfile.TemporaryDirectory() as directory:
            archive=Archive(Path(directory)/'archive.sqlite3')
            archive.save_result(result)
            archive.save_analysis(analysis)
            self.assertEqual(archive.analyses(result['id'])[0]['hash'],analysis['hash'])


if __name__ == '__main__': unittest.main()
