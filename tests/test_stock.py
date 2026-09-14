import unittest
from api.stock import execute
class StockTest(unittest.TestCase):
 def test_flow(self):
  s=execute({})
  s=execute({'state':s['state'],'action':'product','data':{'name':'Teste','category':'Teste','price':1250,'minimum':2}})
  pid=max(p['id'] for p in s['products'])
  s=execute({'state':s['state'],'action':'move','data':{'product_id':pid,'quantity':5,'note':'Compra'}})
  s=execute({'state':s['state'],'action':'move','data':{'product_id':pid,'quantity':-3,'note':'Venda'}})
  self.assertEqual(next(p['stock'] for p in s['products'] if p['id']==pid),2)
  with self.assertRaises(ValueError):execute({'state':s['state'],'action':'move','data':{'product_id':pid,'quantity':-3,'note':'Venda'}})
  self.assertEqual(execute({})['metrics']['items'],5)
 def test_invalid(self):
  for q in [0,1.5,True,-999999]:
   with self.assertRaises(ValueError):execute({'action':'move','data':{'product_id':1,'quantity':q,'note':'Teste'}})
 def test_sql_text(self):
  s=execute({'action':'product','data':{'name':"'; DROP TABLE products; --",'category':'Teste','price':1,'minimum':0}})
  self.assertEqual(s['metrics']['items'],6)
