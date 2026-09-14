"""Demo isolada: SQLite transacional por requisição; snapshot pertence ao visitante."""
import json, sqlite3
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler

SCHEMA = '''
CREATE TABLE products(id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, price INTEGER NOT NULL CHECK(price>=0), minimum INTEGER NOT NULL CHECK(minimum>=0));
CREATE TABLE movements(id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id), quantity INTEGER NOT NULL CHECK(quantity!=0), note TEXT NOT NULL, created TEXT NOT NULL);
'''
SEED = {'products': [
 {'id':1,'name':'Teclado mecânico','category':'Periféricos','price':18990,'minimum':5},
 {'id':2,'name':'Mouse sem fio','category':'Periféricos','price':7990,'minimum':8},
 {'id':3,'name':'SSD 480 GB','category':'Armazenamento','price':22990,'minimum':4},
 {'id':4,'name':'Cabo HDMI','category':'Acessórios','price':2990,'minimum':10},
 {'id':5,'name':'Hub USB-C','category':'Acessórios','price':11990,'minimum':3}],
 'movements':[{'id':i,'product_id':i,'quantity':q,'note':'Saldo inicial demonstrativo','created':'2026-09-14T12:00:00+00:00'} for i,q in enumerate([12,4,7,6,9],1)]}

def integer(value, minimum=0, maximum=100000000):
    if type(value) is not int or not minimum <= value <= maximum: raise ValueError('Número inteiro fora do limite permitido.')
    return value

def label(value, limit=100):
    if not isinstance(value,str) or not value.strip() or len(value)>limit: raise ValueError('Preencha os campos de texto corretamente.')
    return value.strip()

def execute(payload):
    if not isinstance(payload,dict): raise ValueError('Requisição inválida.')
    state=payload.get('state') or SEED
    if not isinstance(state,dict): raise ValueError('Dados inválidos.')
    products=state.get('products',[]); movements=state.get('movements',[])
    if not isinstance(products,list) or not isinstance(movements,list) or len(products)>200 or len(movements)>2000: raise ValueError('Limite da demonstração atingido.')
    db=sqlite3.connect(':memory:'); db.row_factory=sqlite3.Row
    try:
        db.execute('PRAGMA foreign_keys=ON'); db.executescript(SCHEMA)
        with db:
            for p in products:
                db.execute('INSERT INTO products VALUES(?,?,?,?,?)',(integer(p['id'],1),label(p['name']),label(p['category']),integer(p['price']),integer(p['minimum'])))
            for m in movements:
                db.execute('INSERT INTO movements VALUES(?,?,?,?,?)',(integer(m['id'],1),integer(m['product_id'],1),integer(m['quantity'],-100000,100000),label(m['note'],200),label(m['created'])))
            if db.execute('SELECT product_id FROM movements GROUP BY product_id HAVING SUM(quantity)<0').fetchone(): raise ValueError('Saldo inválido.')
            action=payload.get('action','list'); data=payload.get('data',{})
            if action=='product':
                if len(products)>=200: raise ValueError('Máximo de 200 produtos na demonstração.')
                db.execute('INSERT INTO products(name,category,price,minimum) VALUES(?,?,?,?)',(label(data.get('name')),label(data.get('category')),integer(data.get('price')),integer(data.get('minimum'))))
            elif action=='move':
                if len(movements)>=2000: raise ValueError('Máximo de 2.000 movimentações na demonstração.')
                pid=integer(data.get('product_id'),1); qty=integer(data.get('quantity'),-100000,100000)
                if qty==0: raise ValueError('A quantidade deve ser maior que zero.')
                if not db.execute('SELECT id FROM products WHERE id=?',(pid,)).fetchone(): raise ValueError('Produto não encontrado.')
                balance=db.execute('SELECT COALESCE(SUM(quantity),0) FROM movements WHERE product_id=?',(pid,)).fetchone()[0]
                if balance+qty<0: raise ValueError('Saída maior que o saldo disponível.')
                db.execute('INSERT INTO movements(product_id,quantity,note,created) VALUES(?,?,?,?)',(pid,qty,label(data.get('note'),200),datetime.now(timezone.utc).isoformat()))
            elif action!='list': raise ValueError('Ação desconhecida.')
        rows=[dict(r) for r in db.execute('SELECT p.*, COALESCE(SUM(m.quantity),0) AS stock FROM products p LEFT JOIN movements m ON m.product_id=p.id GROUP BY p.id ORDER BY p.name')]
        history=[dict(r) for r in db.execute('SELECT m.*,p.name FROM movements m JOIN products p ON p.id=m.product_id ORDER BY m.id DESC LIMIT 100')]
        return {'products':rows,'history':history,'metrics':{'items':len(rows),'units':sum(p['stock'] for p in rows),'value':sum(p['stock']*p['price'] for p in rows),'low':sum(p['stock']<=p['minimum'] for p in rows)},'state':{'products':[dict(r) for r in db.execute('SELECT * FROM products')],'movements':[dict(r) for r in db.execute('SELECT * FROM movements')]}}
    finally: db.close()

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            length=int(self.headers.get('Content-Length','0'))
            if length<1 or length>600000: raise ValueError('Tamanho da requisição inválido.')
            result=execute(json.loads(self.rfile.read(length))); status=200
        except (ValueError,KeyError,TypeError,sqlite3.IntegrityError):
            result={'error':'Dados inválidos. Confira os campos e o saldo disponível.'}; status=400
        body=json.dumps(result,ensure_ascii=False).encode()
        self.send_response(status); self.send_header('Content-Type','application/json; charset=utf-8'); self.send_header('Cache-Control','no-store'); self.end_headers(); self.wfile.write(body)
