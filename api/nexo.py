"""Consultas SQL fixas sobre uma base fictícia isolada em memória."""
import json, sqlite3
from pathlib import Path
from datetime import date
from http.server import BaseHTTPRequestHandler
ROOT = Path(__file__).resolve().parent.parent / "nexo"
def run(payload):
    if not isinstance(payload,dict): raise ValueError("Requisição inválida.")
    queries=json.loads((ROOT / "consultas.json").read_text(encoding="utf-8"))
    query=next((q for q in queries if q["id"]==payload.get("query","clientes")),None)
    if query is None: raise ValueError("Consulta não encontrada.")
    start=payload.get("start") or "2026-07-01"; end=payload.get("end") or "2026-09-30"
    if date.fromisoformat(start)>date.fromisoformat(end): raise ValueError("A data inicial deve anteceder a final.")
    with sqlite3.connect(":memory:") as db:
        db.executescript((ROOT / "schema.sql").read_text(encoding="utf-8"))
        db.execute("PRAGMA query_only=ON")
        cursor=db.execute(query["sql"],{"inicio":start,"fim":end})
        columns=[c[0] for c in cursor.description]
        rows=[list(r) for r in cursor.fetchall()]
    return {"query":query,"catalog":[{"id":q["id"],"title":q["title"]} for q in queries],"columns":columns,"rows":rows,"start":start,"end":end}
class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            size=int(self.headers.get("Content-Length","0"))
            if not 0<size<4096: raise ValueError("Requisição inválida.")
            result=run(json.loads(self.rfile.read(size))); status=200
        except (ValueError,TypeError):
            result={"error":"Confira a consulta e as datas informadas."}; status=400
        body=json.dumps(result,ensure_ascii=False).encode()
        self.send_response(status); self.send_header("Content-Type","application/json; charset=utf-8")
        self.send_header("Cache-Control","no-store"); self.end_headers(); self.wfile.write(body)
