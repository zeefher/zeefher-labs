import unittest
from api.pulso import analyze

HEADER="pedido;data;produto;categoria;quantidade;preco_unitario\n"
class PulsoTest(unittest.TestCase):
 def test_metrics_and_quality(self):
  a="A;2026-08-01;Mouse;A;2;10.00\n"
  data=analyze({"csv":HEADER+a+a+"B;2026-08-02;SSD;B;1;30.00\n"+"C;;SSD;B;1;30.00\n"})
  self.assertEqual(data["revenue"],5000)
  self.assertEqual(data["orders"],2)
  self.assertEqual(data["ticket"],2500)
  self.assertEqual(data["quality"],{"total":4,"valid":2,"duplicates":1,"invalid":1})
 def test_previous_period(self):
  data=analyze({"csv":HEADER+"A;2026-08-01;Mouse;A;1;10\nB;2026-08-02;Mouse;A;1;20\n","start":"2026-08-02","end":"2026-08-02"})
  self.assertEqual(data["change"],100)
 def test_empty_selection(self):
  data=analyze({"csv":HEADER+"A;2026-08-01;Mouse;A;1;10\n","category":"Ausente"})
  self.assertEqual(data["orders"],0)
  self.assertIsNone(data["change"])
 def test_invalid_prices(self):
  for price in ["NaN","Infinity","-2","1.234"]:
   with self.assertRaises(ValueError): analyze({"csv":HEADER+"A;2026-08-01;Mouse;A;1;"+price+"\n"})
