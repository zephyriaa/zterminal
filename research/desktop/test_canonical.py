import hashlib
import math
import random
import struct
import tempfile
import unittest
from pathlib import Path

import rfc8785
from validation import canonical_bytes, digest
from archive import Archive, encode


class CanonicalTests(unittest.TestCase):
    def test_reference_bytes_and_scalar_cache_types(self):
        values = [-0.0, 0, True, 1, 1.0, False, None, 1e-6, 1e-7, 1e20, 1e21,
                  333333333.33333329, 5e-324, float.fromhex('0x1.fffffffffffffp+1023'),
                  {'\ue000': 1, '\U00010000': 2, 'quoted': '123 " 1e+20 \\ 456'},
                  ('x' * 256, {'long' * 100: 'value'})]
        rng = random.Random(717)
        for _ in range(3000):
            number = struct.unpack('!d', rng.getrandbits(64).to_bytes(8, 'big'))[0]
            if math.isfinite(number):
                values.append({'number': number, 'values': [True, 1, 1.0, None, 'αβ']})
        for value in values:
            self.assertEqual(canonical_bytes(value), rfc8785.dumps(value))
            self.assertEqual(digest(value), hashlib.sha256(rfc8785.dumps(value)).hexdigest())

    def test_reference_errors(self):
        for value in [float('nan'), float('inf'), 2**53, {1: 'invalid'}, '\ud800', object()]:
            with self.assertRaises(Exception) as reference:
                rfc8785.dumps(value)
            with self.assertRaises(type(reference.exception)):
                canonical_bytes(value)

    def test_dataset_lookup_index_preserves_first_inserted(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'archive.sqlite'
            archive = Archive(path)
            query = dict(provider='gateio', product='spot', symbol='BTC_USDT', timeframe='1m',
                         **{'from': 1, 'to': 2})
            with archive.connect() as db:
                # Reverse lexical hash order to catch accidental primary-key ordering.
                for identity in ['z', 'a']:
                    db.execute('INSERT INTO datasets VALUES(?,?)', (identity, encode(dict(query, hash=identity))))
                keys = ('provider', 'product', 'symbol', 'timeframe', 'from', 'to')
                sql = 'SELECT manifest FROM datasets WHERE ' + ' AND '.join(
                    "json_extract(manifest, '$." + key + "')=?" for key in keys) + ' ORDER BY rowid LIMIT 1'
                plan = ' '.join(row[3] for row in db.execute('EXPLAIN QUERY PLAN ' + sql, tuple(query[k] for k in keys)))
                self.assertIn('SEARCH datasets USING INDEX datasets_identity', plan)
            self.assertEqual(archive.find_dataset(query)['hash'], 'z')
            self.assertEqual(Archive(path).find_dataset(query)['hash'], 'z')


if __name__ == '__main__':
    unittest.main()
