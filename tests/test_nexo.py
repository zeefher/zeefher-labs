import unittest
from api.nexo import run
class NexoTest(unittest.TestCase):
 def test_revenue_excludes_cancelled(self):
  r=run({"query":"clientes"})
  self.assertEqual(sum(row[2] for row in r["rows"]),1900)
  self.assertEqual(r["rows"][0],["Cliente Aurora",3,1550.0])
 def test_monthly(self):
  r=run({"query":"mensal"})
  self.assertEqual([row[1] for row in r["rows"]],[450,650,800])
  self.assertIsNone(r["rows"][0][2])
 def test_inactive(self):
  r=run({"query":"inativos"})
  self.assertEqual(r["rows"],[["Cliente Maré","Bacabal"]])
 def test_stock(self):
  r=run({"query":"estoque"})
  self.assertEqual(r["rows"][0],["Mouse",4,8,5])
 def test_filter(self):
  r=run({"query":"clientes","start":"2027-01-01","end":"2027-02-01"})
  self.assertEqual(r["rows"],[])
 def test_query_allowlist(self):
  with self.assertRaises(ValueError):run({"query":"DROP TABLE clientes"})
 def test_invalid_dates(self):
  with self.assertRaises(ValueError):run({"start":"2026-09-01","end":"2026-07-01"})
