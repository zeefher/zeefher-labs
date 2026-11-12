"""Servidor local com cache de fontes públicas INMET e NOAA. Sem chaves ou pacotes externos."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from datetime import datetime, timezone, timedelta
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
import urllib.request, gzip, json, re, threading, time

ROOT=Path(__file__).resolve().parent
TZ=timezone(timedelta(hours=-3))
SOURCES={
 'inmet':('https://apiprevmet3.inmet.gov.br/avisos/ativos',600),
 'advisory':('https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml',21600),
 'roni':('https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/',21600),
 'relative':('https://www.cpc.ncep.noaa.gov/data/indices/rel_mthsst9120.txt',21600),
}
UF_CODES={'11':'RO','12':'AC','13':'AM','14':'RR','15':'PA','16':'AP','17':'TO','21':'MA','22':'PI','23':'CE','24':'RN','25':'PB','26':'PE','27':'AL','28':'SE','29':'BA','31':'MG','32':'ES','33':'RJ','35':'SP','41':'PR','42':'SC','43':'RS','50':'MS','51':'MT','52':'GO','53':'DF'}
cache={};locks={key:threading.Lock() for key in SOURCES}

class PageText(HTMLParser):
    def __init__(self):super().__init__();self.parts=[];self.rows=[];self.row=[];self.cell=None
    def handle_starttag(self,tag,attrs):
        if tag=='tr':self.row=[]
        if tag in ('td','th'):self.cell=[]
    def handle_data(self,data):
        self.parts.append(data)
        if self.cell is not None:self.cell.append(data)
    def handle_endtag(self,tag):
        if tag in ('td','th') and self.cell is not None:self.row.append(' '.join(''.join(self.cell).split()));self.cell=None
        if tag=='tr' and self.row:self.rows.append(self.row)
    @property
    def text(self):return ' '.join(' '.join(self.parts).split())

def date_local(value):
    try:return datetime.strptime(value,'%Y-%m-%d %H:%M').replace(tzinfo=TZ).isoformat()
    except (ValueError,TypeError):return None

def parse_inmet(raw):
    source=json.loads(raw);now=datetime.now(timezone.utc);alerts=[];seen=set()
    if not isinstance(source,dict) or 'hoje' not in source:raise ValueError('Formato INMET não reconhecido')
    for row in source.get('hoje',[])+source.get('futuro',[]):
        start=date_local(row.get('inicio'));end=date_local(row.get('fim'))
        if row.get('encerrado'):continue
        if not start or not end:raise ValueError('Validade do aviso INMET não reconhecida')
        if not (datetime.fromisoformat(start)<=now<datetime.fromisoformat(end)):continue
        identity=row.get('codigo')
        if not identity or identity in seen:continue
        seen.add(identity)
        codes=sorted(set(re.findall(r'\b\d{7}\b',str(row.get('geocodes','')))))
        ufs=sorted({UF_CODES[g[:2]] for g in codes if g[:2] in UF_CODES})
        severity=str(row.get('severidade','')).strip()
        severity_key=severity.casefold()
        rank=3 if 'grande perigo' in severity_key else 2 if severity_key=='perigo' else 1 if 'potencial' in severity_key else 0
        if not rank:raise ValueError('Severidade do aviso INMET não reconhecida')
        polygon=row.get('poligono')
        if isinstance(polygon,str):polygon=json.loads(polygon)
        alerts.append({'id':str(row.get('id_aviso')),'identifier':identity,'title':str(row.get('descricao') or 'Aviso meteorológico'),'severity':severity,'rank':rank,'start':start,'expires':end,'ufs':ufs,'municipality_codes':codes,'geometry':polygon,'risks':[str(x) for x in (row.get('riscos') or [])][:2],'source_url':'https://avisos.inmet.gov.br/','cap_url':f"https://apiprevmet3.inmet.gov.br/avisos/rss/{row.get('id_aviso')}"})
    return {'alerts':alerts,'count':len(alerts),'timezone':'America/Sao_Paulo','aggregate_note':'UF com aviso em parte do território; consultar o polígono e o aviso original.'}

def parse_advisory(raw):
    page=PageText();page.feed(raw);text=page.text
    status=next((label for label in ['El Niño Advisory','La Niña Advisory','El Niño Watch','La Niña Watch','Not Active'] if label in text),None)
    date=re.search(r'\b(\d{1,2} (?:January|February|March|April|May|June|July|August|September|October|November|December) 20\d{2})\b',text)
    if not status or not date:raise ValueError('Comunicado ENSO não reconhecido')
    published=datetime.strptime(date.group(1),'%d %B %Y').date().isoformat()
    return {'status':status,'published':published,'note':'Diagnóstico oficial oceano-atmosfera; não atribui eventos locais ao ENSO.'}

def parse_roni(raw):
    page=PageText();page.feed(raw);series=[];seasons=['DJF','JFM','FMA','MAM','AMJ','MJJ','JJA','JAS','ASO','SON','OND','NDJ']
    for row in page.rows:
        if not row or not re.fullmatch(r'20\d{2}',row[0]):continue
        for i,cell in enumerate(row[1:13]):
            try:value=float(cell.replace('−','-'))
            except ValueError:continue
            if abs(value)>10:continue
            series.append({'year':int(row[0]),'season':seasons[i],'value':value})
    if not series:raise ValueError('Tabela RONI não reconhecida')
    return {'series':series[-18:],'latest':series[-1],'note':'Média móvel trimestral relativa; valores recentes são estimativas sujeitas a revisão.'}

def parse_relative(raw):
    series=[]
    for line in raw.splitlines():
        cells=line.split()
        if len(cells)!=6 or not cells[0].isdigit():continue
        year,month=int(cells[0]),int(cells[1])
        if not 1<=month<=12:continue
        value=float(cells[-1])
        if abs(value)>10:continue
        series.append({'year':year,'month':month,'value':value})
    if not series:raise ValueError('Série mensal Niño 3.4 relativo não reconhecida')
    return {'series':series[-18:],'latest':series[-1],'note':'Anomalia relativa mensal Niño 3.4 em °C; não equivale ao RONI trimestral.'}

PARSERS={'inmet':parse_inmet,'advisory':parse_advisory,'roni':parse_roni,'relative':parse_relative}

def get_source(key):
    url,ttl=SOURCES[key]
    with locks[key]:
        previous=cache.get(key)
        if previous and time.monotonic()-previous['clock']<previous['retry_after']:return previous['payload']
        try:
            request=urllib.request.Request(url,headers={'User-Agent':'ZeefherLabs-ZeeclimaDemo/1.0','Accept':'application/json,text/html,text/plain'})
            with urllib.request.urlopen(request,timeout=15) as response:
                data=response.read(12_000_001)
            if len(data)>12_000_000:raise ValueError('Resposta maior que o limite permitido')
            if data[:2]==b'\x1f\x8b':data=gzip.decompress(data)
            raw=data.decode('utf-8')
            payload={'status':'ok','source_url':url,'fetched_at':datetime.now(timezone.utc).isoformat(),'refresh_seconds':ttl,'data':PARSERS[key](raw)}
            cache[key]={'clock':time.monotonic(),'retry_after':ttl,'payload':payload}
        except Exception as error:
            payload={'status':'unavailable','source_url':url,'fetched_at':None,'refresh_seconds':ttl,'error':'Fonte temporariamente indisponível.'}
            if previous and previous['payload'].get('data'):
                payload.update(status='stale',fetched_at=previous['payload'].get('fetched_at'),data=previous['payload']['data'])
            cache[key]={'clock':time.monotonic(),'retry_after':120,'payload':payload}
            print(f'Fonte {key}: {type(error).__name__}',flush=True)
        return payload

def monitoring_data():
    with ThreadPoolExecutor(max_workers=4) as pool:values=list(pool.map(get_source,SOURCES))
    return {'generated_at':datetime.now(timezone.utc).isoformat(),'sources':dict(zip(SOURCES,values)),'attribution':'Avisos locais não são automaticamente atribuídos ao El Niño ou à La Niña.'}

municipal_cache={}
municipal_locks={uf:threading.Lock() for uf in UF_CODES.values()}

def municipalities(uf):
    if uf not in municipal_locks:raise ValueError('UF inválida')
    with municipal_locks[uf]:
        previous=municipal_cache.get(uf)
        if previous and time.monotonic()-previous[0]<86400:return previous[1]
        code=next(code for code,value in UF_CODES.items() if value==uf)
        def fetch_json(url):
            with urllib.request.urlopen(url,timeout=25) as response:data=response.read(20_000_001)
            if len(data)>20_000_000:raise ValueError('Malha excedeu o limite')
            if data[:2]==b'\x1f\x8b':data=gzip.decompress(data)
            return json.loads(data)
        base='https://servicodados.ibge.gov.br/api/'
        with ThreadPoolExecutor(max_workers=2) as pool:
            geometry=pool.submit(fetch_json,base+'v3/malhas/estados/'+code+'?formato=application/vnd.geo%2Bjson&intrarregiao=municipio&qualidade=minima')
            names=pool.submit(fetch_json,base+'v1/localidades/estados/'+code+'/municipios')
            geo=geometry.result();lookup={str(row['id']):row['nome'] for row in names.result()}
        features=geo.get('features',[])
        if not features:raise ValueError('Malha municipal vazia')
        for feature in features:
            city=str(feature['properties']['codarea'])
            feature['properties']={'code':city,'name':lookup.get(city,'Distrito Federal' if uf=='DF' else city)}
        payload={'uf':uf,'features':features,'source':'IBGE','fetched_at':datetime.now(timezone.utc).isoformat()}
        municipal_cache[uf]=(time.monotonic(),payload)
        return payload

forecast_cache={}
forecast_guard=threading.Lock()
forecast_locks={}

def parse_forecast(raw,code):
    source=json.loads(raw).get(code)
    if not isinstance(source,dict):raise ValueError('Previsão municipal não reconhecida')
    days=[]
    allowed=('resumo','tempo','temp_min','temp_max','umidade_min','umidade_max','dir_vento','int_vento')
    for date,values in source.items():
        try:day=datetime.strptime(date,'%d/%m/%Y').date().isoformat()
        except ValueError:continue
        if not isinstance(values,dict):continue
        periods=[]
        for period in ('manha','tarde','noite'):
            row=values.get(period)
            if isinstance(row,dict):periods.append(dict(period=period,**{key:row.get(key) for key in allowed}))
        if not periods and 'resumo' in values:periods=[dict(period='dia',**{key:values.get(key) for key in allowed})]
        if periods:days.append({'date':day,'periods':periods})
    if not days:raise ValueError('Previsão municipal sem períodos')
    return {'code':code,'days':sorted(days,key=lambda day:day['date'])}

def municipal_forecast(code):
    if not re.fullmatch(r'\d{7}',code) or code[:2] not in UF_CODES:raise ValueError('Código municipal inválido')
    with forecast_guard:lock=forecast_locks.setdefault(code,threading.Lock())
    with lock:
        previous=forecast_cache.get(code)
        if previous and time.monotonic()-previous[0]<previous[1]:return previous[2]
        url='https://apiprevmet3.inmet.gov.br/previsao/'+code
        try:
            request=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (ZeefherLabs Zeeclima demo)','Accept':'application/json'})
            with urllib.request.urlopen(request,timeout=18) as response:raw=response.read(8_000_001)
            if len(raw)>8_000_000:raise ValueError('Previsão excedeu limite')
            if raw[:2]==b'\x1f\x8b':raw=gzip.decompress(raw)
            data=parse_forecast(raw.decode('utf-8'),code)
            result={'status':'ok','fetched_at':datetime.now(timezone.utc).isoformat(),'source_url':'https://previsao.inmet.gov.br/'+code,'data':data}
            ttl=900
        except Exception:
            result={'status':'unavailable','fetched_at':None,'source_url':'https://previsao.inmet.gov.br/'+code}
            if previous and previous[2].get('data'):result.update(status='stale',fetched_at=previous[2]['fetched_at'],data=previous[2]['data'])
            ttl=120
        forecast_cache[code]=(time.monotonic(),ttl,result)
        return result

class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT),**kwargs)
    def list_directory(self,path):self.send_error(403);return None
    def do_GET(self):
        if self.path.split('?')[0].startswith('/api/tempo/'):
            code=self.path.split('?')[0].rsplit('/',1)[-1]
            try:payload=municipal_forecast(code)
            except ValueError:self.send_error(400);return
            data=json.dumps(payload,ensure_ascii=False).encode('utf-8')
            self.send_response(200);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
        elif self.path.split('?')[0].startswith('/api/municipios/'):
            uf=self.path.split('?')[0].rsplit('/',1)[-1]
            if uf not in municipal_locks:self.send_error(404);return
            try:data=json.dumps(municipalities(uf),ensure_ascii=False).encode('utf-8')
            except Exception:self.send_error(503,'Malha municipal indisponivel');return
            self.send_response(200);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
        elif self.path.split('?')[0]=='/api/monitor':
            data=json.dumps(monitoring_data(),ensure_ascii=False).encode('utf-8')
            self.send_response(200);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
        else:super().do_GET()

if __name__=='__main__':
    print('Zeeclima com fontes oficiais: http://127.0.0.1:4175',flush=True)
    ThreadingHTTPServer(('127.0.0.1',4175),Handler).serve_forever()
