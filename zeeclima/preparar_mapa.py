"""Gera um SVG leve a partir da malha simplificada oficial do IBGE."""
from pathlib import Path
import json, os, math

ROOT=Path(os.environ['ZEEFHER_CLIMA_OUTPUT'])
source=json.loads((ROOT/'brasil-ibge.geojson').read_text(encoding='utf-8'))
info={11:('RO','Rondônia','Norte'),12:('AC','Acre','Norte'),13:('AM','Amazonas','Norte'),14:('RR','Roraima','Norte'),15:('PA','Pará','Norte'),16:('AP','Amapá','Norte'),17:('TO','Tocantins','Norte'),21:('MA','Maranhão','Nordeste'),22:('PI','Piauí','Nordeste'),23:('CE','Ceará','Nordeste'),24:('RN','Rio Grande do Norte','Nordeste'),25:('PB','Paraíba','Nordeste'),26:('PE','Pernambuco','Nordeste'),27:('AL','Alagoas','Nordeste'),28:('SE','Sergipe','Nordeste'),29:('BA','Bahia','Nordeste'),31:('MG','Minas Gerais','Sudeste'),32:('ES','Espírito Santo','Sudeste'),33:('RJ','Rio de Janeiro','Sudeste'),35:('SP','São Paulo','Sudeste'),41:('PR','Paraná','Sul'),42:('SC','Santa Catarina','Sul'),43:('RS','Rio Grande do Sul','Sul'),50:('MS','Mato Grosso do Sul','Centro-Oeste'),51:('MT','Mato Grosso','Centro-Oeste'),52:('GO','Goiás','Centro-Oeste'),53:('DF','Distrito Federal','Centro-Oeste')}
def polygons(f):
    c=f['geometry']['coordinates']
    return c if f['geometry']['type']=='MultiPolygon' else [c]
points=[p for f in source['features'] for poly in polygons(f) for ring in poly for p in ring]
lo=min(p[0] for p in points);hi=max(p[0] for p in points);bottom=min(p[1] for p in points);top=max(p[1] for p in points)
cos=math.cos(math.radians(-15))
scale=min(535/((hi-lo)*cos),535/(top-bottom))
ox=(600-(hi-lo)*cos*scale)/2;oy=(600-(top-bottom)*scale)/2
def project(p):return (round(ox+(p[0]-lo)*cos*scale,2),round(oy+(top-p[1])*scale,2))
states=[]
for f in source['features']:
    code=int(f['properties']['codarea']);uf,name,region=info[code]
    shapes=polygons(f);paths=[]
    for poly in shapes:
        for ring in poly:
            coords=[project(p) for p in ring]
            paths.append('M'+'L'.join(f'{x},{y}' for x,y in coords)+'Z')
    largest=max(shapes,key=lambda p:len(p[0]))[0]
    x,y=project(((min(p[0] for p in largest)+max(p[0] for p in largest))/2,(min(p[1] for p in largest)+max(p[1] for p in largest))/2))
    states.append({'uf':uf,'name':name,'region':region,'path':''.join(paths),'x':x,'y':y})
(ROOT/'dist').mkdir(exist_ok=True)
(ROOT/'dist/mapa.js').write_text('window.BRAZIL_MAP = '+json.dumps(states,ensure_ascii=False,separators=(',',':'))+';\nwindow.MAP_PROJECTION = '+json.dumps({'lo':lo,'top':top,'scale':scale,'cos':cos,'ox':ox,'oy':oy})+';\n',encoding='utf-8')
print('Estados:',len(states),'| Malha: IBGE | SVG em coordenadas locais, sem chamadas de rede em execução.')
