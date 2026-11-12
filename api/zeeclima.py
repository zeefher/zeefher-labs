"""Consultas públicas do Zeeclima; fontes fixas, parâmetros limitados e sem chaves."""
import json
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlsplit, parse_qs
from zeeclima.servidor import monitoring_data, municipalities, municipal_forecast


def dispatch(query):
    resource=query.get('resource',['monitor'])[0]
    if resource=='monitor':return monitoring_data()
    if resource=='municipios':return municipalities(query.get('uf',[''])[0])
    if resource=='tempo':return municipal_forecast(query.get('code',[''])[0])
    raise ValueError('Recurso inválido')


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            result=dispatch(parse_qs(urlsplit(self.path).query));status=200
        except ValueError:
            result={'error':'Parâmetro inválido.'};status=400
        except Exception as error:
            print('Zeeclima: falha na fonte pública',type(error).__name__,flush=True)
            result={'error':'Fonte temporariamente indisponível.'};status=503
        body=json.dumps(result,ensure_ascii=False,separators=(',',':')).encode('utf-8')
        if len(body)>4_000_000:
            body=b'{"error":"Malha excede o limite desta demonstracao."}';status=503
        self.send_response(status)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Cache-Control','no-store')
        self.send_header('Content-Length',str(len(body)))
        self.end_headers();self.wfile.write(body)
