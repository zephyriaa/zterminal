import unittest
from script_inspection import inspect_script, check_source


class ScriptInspectionTests(unittest.TestCase):
    def test_discovers_config_get_and_required_subscripts_without_execution(self):
        source = 'CONFIG = {"period": 200, "enabled": True}\nraise RuntimeError("must not execute")\ndef strategy(data, params):\n p = int(params.get("range_minutes", 30))\n x = params["threshold"]\n return data.close.ewm(span=params["period"]).mean()\n'
        result = inspect_script(source)
        self.assertEqual(result['parameters']['range_minutes']['default'], 30)
        self.assertTrue(result['parameters']['threshold']['required'])
        self.assertGreater(result['warmupBars'], 1300)
        self.assertLess(inspect_script(source, {'period': 20})['warmupBars'], result['warmupBars'])

    def test_sdk_declarations_and_local_periods(self):
        result = inspect_script('PARAMETERS = {"length": zt.input.integer(20, min=1, max=500)}\ndef strategy(data, params):\n length = params["length"]\n return zt.sma(data.close, length)\n')
        self.assertEqual(result['warmupBars'], 20)
        with self.assertRaises(ValueError): inspect_script('CONFIG={"x": 1}', {'x': True})

    def test_future_leaks_have_editor_positions(self):
        for expression in ['data.close.shift(-1)', 'data.close.shift(periods=-2)', 'data.close.rolling(20, center=True).mean()', 'data.close.bfill()']:
            with self.assertRaises(SyntaxError) as error: check_source('def strategy(data, params):\n return ' + expression)
            self.assertEqual(error.exception.lineno, 2)
        self.assertFalse(check_source('x = data.close.shift(1)')['diagnostics'])

    def test_required_has_no_invented_default(self):
        with self.assertRaisesRegex(ValueError, 'threshold'): check_source('x = params["threshold"]')
        self.assertEqual(check_source('x = params["threshold"]', {'threshold': 2.5})['resolvedParams']['threshold'], 2.5)


if __name__ == '__main__': unittest.main()
