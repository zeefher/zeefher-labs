"""Análise de CSV em memória; nenhum arquivo é persistido."""
import csv, io, json
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation
from http.server import BaseHTTPRequestHandler

def analyze(payload):
    raw=payload.get("csv","")
    if not isinstance(raw,str) or len(raw.encode("utf-8"))>500000: raise ValueError("Use um CSV de até 500 KB.")
    reader=csv.DictReader(io.StringIO(raw.lstrip("\ufeff")),delimiter=";" if ";" in raw.split("\n")[0] else ",")
    required={"pedido","data","produto","categoria","quantidade","preco_unitario"}
    if not reader.fieldnames or not required.issubset(reader.fieldnames): raise ValueError("Colunas obrigatórias: "+", ".join(sorted(required)))
    rows=[]; issues=[]; seen=set(); duplicates=0; total=0
    for line,r in enumerate(reader,2):
        total+=1
        if total>5000: raise ValueError("Limite de 5.000 linhas por arquivo.")
        try:
            if None in r: raise ValueError("Número incorreto de colunas")
            v={k:(r.get(k) or "").strip() for k in required}
            if any(not x for x in v.values()): raise ValueError("Campo obrigatório vazio")
            if any(len(x)>120 for x in v.values()): raise ValueError("Campo muito longo")
            day=date.fromisoformat(v["data"])
            qty=int(v["quantidade"])
            price=Decimal(v["preco_unitario"].replace(",","."))
            if not price.is_finite() or price<0 or price>1000000 or price.as_tuple().exponent < -2 or qty<1 or qty>100000: raise ValueError("Quantidade ou preço inválido")
            key=tuple(v[k] for k in sorted(required))
            if key in seen:
                duplicates+=1; issues.append({"linha":line,"motivo":"Duplicata exata removida"}); continue
            seen.add(key)
            rows.append(dict(v,data=day.isoformat(),quantidade=qty,centavos=int(price*100),receita=int(price*100)*qty))
        except (ValueError,InvalidOperation,TypeError):
            issues.append({"linha":line,"motivo":"Linha inválida: confira campos, data ISO, quantidade positiva e preço com até 2 casas"})
    if not rows: raise ValueError("Nenhuma linha válida encontrada.")
    start=date.fromisoformat(payload.get("start") or min(r["data"] for r in rows))
    end=date.fromisoformat(payload.get("end") or max(r["data"] for r in rows))
    if start>end or (end-start).days>3660: raise ValueError("Selecione um período válido de até 10 anos.")
    category=payload.get("category","")
    selected=[r for r in rows if start.isoformat()<=r["data"]<=end.isoformat() and (not category or r["categoria"]==category)]
    days=(end-start).days+1; previous_start=start-timedelta(days=days)
    previous=[r for r in rows if previous_start.isoformat()<=r["data"]<start.isoformat() and (not category or r["categoria"]==category)]
    revenue=sum(r["receita"] for r in selected); old=sum(r["receita"] for r in previous)
    orders=len({r["pedido"] for r in selected})
    byday=defaultdict(int); byproduct=defaultdict(int)
    for r in selected: byday[r["data"]]+=r["receita"]; byproduct[r["produto"]]+=r["receita"]
    return {"revenue":revenue,"orders":orders,"units":sum(r["quantidade"] for r in selected),"ticket":round(revenue/orders) if orders else 0,
        "previous":old,"change":round((revenue-old)*100/old,1) if old else None,
        "start":start.isoformat(),"end":end.isoformat(),"previous_start":previous_start.isoformat(),"previous_end":(start-timedelta(days=1)).isoformat(),
        "daily":[{"label":d,"value":v} for d,v in sorted(byday.items())],
        "products":[{"label":d,"value":v} for d,v in sorted(byproduct.items(),key=lambda x:x[1],reverse=True)[:10]],
        "categories":sorted({r["categoria"] for r in rows}),"quality":{"total":total,"valid":len(rows),"duplicates":duplicates,"invalid":total-len(rows)-duplicates},
        "issues":issues,"selected":len(selected)}

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            size=int(self.headers.get("Content-Length","0"))
            if not 0<size<=650000: raise ValueError("Use um CSV de até 500 KB.")
            data=json.loads(self.rfile.read(size))
            if not isinstance(data,dict): raise ValueError("Requisição inválida.")
            result=analyze(data); status=200
        except (ValueError,TypeError,KeyError) as error:
            result={"error":str(error)}; status=400
        body=json.dumps(result,ensure_ascii=False).encode()
        self.send_response(status); self.send_header("Content-Type","application/json; charset=utf-8")
        self.send_header("Cache-Control","no-store"); self.end_headers(); self.wfile.write(body)
