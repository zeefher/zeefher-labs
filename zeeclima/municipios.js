"use strict";
(()=>{
let current=null,selected=null,request=0,loading=false,zoomFrame=0,weatherRequest=0;
const weatherCache=new Map();let weatherLoading=false;
const cache=new Map(),stage=document.querySelector('.map-stage'),country=$('brazil-map');
const controls=element('div','municipal-controls');
const back=element('button','municipal-back','← Brasil');back.type='button';
const stateBack=element('button','municipal-back','↖ Ver estado');stateBack.type='button';stateBack.hidden=true;
const caption=element('div','municipal-caption');caption.hidden=true;stage.append(caption);
const heading=element('strong','','Municípios');
const selectCity=element('select');selectCity.setAttribute('aria-label','Buscar município');
const prompt=element('option','','Selecione um município');prompt.value='';selectCity.append(prompt);
controls.append(back,stateBack,heading,selectCity);controls.hidden=true;stage.before(controls);
const svg=node('svg',{viewBox:'0 0 600 600',class:'municipal-map','aria-label':'Mapa municipal interativo'});svg.setAttribute('hidden','');stage.append(svg);
const detail=element('section','municipal-detail');detail.hidden=true;detail.setAttribute('aria-live','polite');stage.after(detail);
const explore=element('button','municipal-explore','Explorar municípios do estado →');explore.type='button';document.querySelector('.map-bottom').after(explore);
function restoreDetail(){document.body.classList.remove('city-selected');stage.after(detail);stateBack.hidden=true;caption.hidden=true;cancelAnimationFrame(zoomFrame);svg.setAttribute('viewBox','0 0 600 600');}
stateBack.addEventListener('click',()=>{chooseCity('');selectCity.focus();});
function close(){restoreDetail();weatherRequest++;stage.classList.remove('municipal-active');request++;current=null;selected=null;loading=false;country.removeAttribute('hidden');svg.setAttribute('hidden','');controls.hidden=true;detail.hidden=true;explore.hidden=false;document.querySelector('.map-hint').hidden=false;$('map-tooltip').hidden=true;back.blur();}
back.addEventListener('click',()=>{close();explore.focus();});
$('reset').addEventListener('click',close);
explore.addEventListener('click',()=>window.openMunicipalities(state.uf));
function cityWarnings(code){return validWarnings().filter(a=>(a.municipality_codes||[]).includes(code));}
function showDetails(){
 detail.replaceChildren();
 if(!current)return;
 const data=cache.get(current),city=data?.features.find(f=>f.properties.code===selected),official=document.body.dataset.mode==='official';
 detail.append(element('span','municipal-eyebrow',city?'MUNICÍPIO SELECIONADO':'EXPLORAÇÃO MUNICIPAL'),element('h3','',city?city.properties.name+' / '+current:mapData.find(i=>i.uf===current).name));
 if(!city){detail.append(element('p','',loading?'Carregando limites municipais do IBGE…':data?data.features.length+' municípios na malha. Toque no mapa ou escolha na lista para consultar os detalhes.':'Não foi possível carregar a malha municipal. Volte ao Brasil e tente novamente.'));return;}
 detail.append(element('p','municipal-code','Código IBGE '+selected));
 renderWeather();
 detail.append(element('h4','municipal-alert-heading','Avisos vigentes / INMET'));
 if(!official){detail.append(element('p','','Modo simulado: os índices do painel ao lado representam o estado. Não há previsão nem probabilidade calculada por município.'));return;}
 const feed=inmetFeed(),warnings=cityWarnings(selected);
 detail.append(element('p','',!feed?.data?'Consulta INMET indisponível. Não é possível confirmar os avisos do município.':warnings.length?warnings.length+' aviso(s) vigente(s) que incluem este município na lista do INMET.':'Nenhum aviso vigente encontrado para este município nesta consulta. Isso não significa ausência de risco.'));
 if(feed?.status==='stale')detail.append(element('p','','Atualização indisponível: usando a última consulta, com vigência filtrada pelo horário atual.'));
 for(const warning of warnings){
 const card=element('article','municipal-warning');const badge=element('span','',warning.severity);badge.style.color=WARNING_COLORS[warning.rank];
 card.append(badge,element('h4','',warning.title),element('p','','Até '+officialTime(warning.expires)));
 if(warning.risks[0])card.append(element('p','',warning.risks[0]));
 card.append(externalLink(warning.cap_url,'Consultar aviso original ↗'));detail.append(card);
 }
 detail.append(element('p','municipal-code','Abrangência por código municipal informado pelo INMET. O aviso pode cobrir apenas parte do município. Limites: IBGE.'));
}
function paint(){
 for(const path of svg.querySelectorAll('.municipal-shape')){
 const warnings=cityWarnings(path.dataset.code),official=document.body.dataset.mode==='official';
 path.setAttribute('fill',official?(inmetFeed()?.data?WARNING_COLORS[Math.max(0,...warnings.map(a=>a.rank))]:'#354957'):'#477c78');
 path.setAttribute('aria-pressed',String(path.dataset.code===selected));
 }
 showDetails();
}
function zoomCity(code){
 cancelAnimationFrame(zoomFrame);
 const path=[...svg.querySelectorAll('.municipal-shape')].find(el=>el.dataset.code===code);
 if(!path)return;
 const box=path.getBBox(),size=Math.max(box.width,box.height,12)*1.6,target=[box.x+box.width/2-size/2,box.y+box.height/2-size/2,size,size];
 const initial=svg.getAttribute('viewBox').split(' ').map(Number),start=performance.now();
 const animate=now=>{const t=matchMedia('(prefers-reduced-motion:reduce)').matches?1:Math.min(1,(now-start)/480),ease=1-Math.pow(1-t,3);svg.setAttribute('viewBox',initial.map((n,i)=>n+(target[i]-n)*ease).join(' '));if(t<1)zoomFrame=requestAnimationFrame(animate);};zoomFrame=requestAnimationFrame(animate);
 path.parentNode.append(path);
 caption.textContent=path.getAttribute('aria-label')+' / '+current;caption.hidden=false;
}
async function loadWeather(code){
 const id=++weatherRequest,cached=weatherCache.get(code);
 if(cached&&Date.now()-cached.clock<900000){weatherLoading=false;showDetails();return;}
 weatherLoading=true;showDetails();
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),22000);
 try{
 const response=await fetch('/api/zeeclima?resource=tempo&code='+encodeURIComponent(code),{signal:controller.signal});
 if(!response.ok)throw Error('Previsão indisponível');
 const payload=await response.json();weatherCache.set(code,{clock:Date.now(),payload});
 }catch(error){weatherCache.set(code,{clock:Date.now()-840000,payload:{status:'unavailable'}});}
 finally{clearTimeout(timer);if(id===weatherRequest&&selected===code){weatherLoading=false;showDetails();}}
}
function chooseCity(code,focusDetail=false){
 selected=code||null;selectCity.value=code;
 if(selected){
 document.body.classList.add('city-selected');document.querySelector('.workspace').append(detail);stateBack.hidden=false;zoomCity(code);paint();loadWeather(code);
 }else{weatherRequest++;weatherLoading=false;restoreDetail();paint();}
}
function turnNamesFor(period){return {manha:'manhã',tarde:'tarde',noite:'noite',dia:'dia'}[period]||'período';}
function renderWeather(){
 const wrap=element('div','municipal-weather');detail.append(wrap);
 wrap.append(element('span','municipal-eyebrow','PREVISÃO DO TEMPO / INMET'));
 const record=weatherCache.get(selected)?.payload;
 if(weatherLoading){wrap.append(element('p','','Consultando previsão municipal…'));return;}
 const dateParts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const dateValue=type=>dateParts.find(p=>p.type===type).value,iso=dateValue('year')+'-'+dateValue('month')+'-'+dateValue('day');
 const days=record?.data?.days?.filter(day=>day.date>=iso)||[];
 if(!days.length){
 wrap.append(element('p','',record?.data?'A fonte retornou apenas previsões anteriores à data atual. Não há previsão vigente para exibir.':'Previsão municipal temporariamente indisponível. Os avisos abaixo são consultados separadamente.'));
 const retry=element('button','municipal-back','Tentar novamente');retry.type='button';retry.addEventListener('click',()=>{weatherCache.delete(selected);loadWeather(selected);});wrap.append(retry);return;
 }
 if(record.status==='stale')wrap.append(element('p','weather-stale','A atualização falhou. Exibindo a última previsão consultada; confira as datas.'));
 const day=days[0],periods=day.periods,base=periods[0],num=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
 const minimum=num(base.temp_min),maximum=num(base.temp_max);
 wrap.append(element('h4','weather-summary',base.resumo||'Condição não informada'));
 const metrics=element('div','weather-metrics');
 const metric=(label,value)=>{const cell=element('div');cell.append(element('span','',label),element('strong','',value));metrics.append(cell);};
 metric('Mínima / máxima', (minimum===null?'—':minimum+'°')+' / '+(maximum===null?'—':maximum+'°C'));
 metric('Umidade / '+turnNamesFor(base.period),(num(base.umidade_min)===null?'—':base.umidade_min+'%')+' a '+(num(base.umidade_max)===null?'—':base.umidade_max+'%'));
 wrap.append(metrics,element('p','weather-date','Previsão para '+day.date.split('-').reverse().join('/')));
 const explanation=element('p','weather-explanation');
 explanation.textContent='O INMET prevê '+(base.resumo?base.resumo.charAt(0).toLowerCase()+base.resumo.slice(1):'condições não descritas')+' para '+turnNamesFor(base.period)+'. '+(minimum!==null&&maximum!==null?'A faixa de temperatura informada é de '+minimum+'°C a '+maximum+'°C. ':'')+'Veja abaixo como o tempo e o vento devem se comportar em cada período.';
 wrap.append(explanation);
 const turnNames={manha:'Manhã',tarde:'Tarde',noite:'Noite',dia:'Dia'};
 for(const period of periods){
 const row=element('article','weather-period');row.append(element('strong','',turnNames[period.period]),element('p','',period.resumo||'Condição não informada'),element('p','weather-wind','Vento: '+(period.int_vento||'não informado')+' · direção '+(period.dir_vento||'não informada')));
 if(num(period.umidade_min)!==null&&num(period.umidade_max)!==null)row.append(element('p','weather-wind','Umidade: '+period.umidade_min+'% a '+period.umidade_max+'%'));
 if(period.tempo&&period.tempo!==period.resumo)row.append(element('p','',period.tempo));
 wrap.append(row);
 }
 if(days.length>1){
 const upcoming=element('details','weather-next');upcoming.append(element('summary','','Próximos dias'));
 for(const next of days.slice(1)){const row=element('p'),p=next.periods[0];row.textContent=next.date.split('-').reverse().join('/')+' · '+(p.resumo||'Sem descrição')+' · '+(num(p.temp_min)===null?'—':p.temp_min+'°')+' / '+(num(p.temp_max)===null?'—':p.temp_max+'°C');upcoming.append(row);}
 wrap.append(upcoming);
 }
 wrap.append(element('p','municipal-code','Previsão por município, não medição ao vivo. A fonte não informa aqui volume de chuva nem probabilidade de danos. Eventos locais não são automaticamente atribuídos ao El Niño.'));
 wrap.append(externalLink(record.source_url,'Fonte: previsão municipal INMET ↗'),element('p','municipal-code','Consultado em '+officialTime(record.fetched_at)+'. Cache de até 15 minutos.'));
}
selectCity.addEventListener('change',()=>chooseCity(selectCity.value,true));
function draw(data){
 const points=[];const polys=f=>f.geometry.type==='MultiPolygon'?f.geometry.coordinates:[f.geometry.coordinates];
 for(const f of data.features)for(const poly of polys(f))for(const ring of poly)for(const point of ring)points.push(point);
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
 let lo=Infinity,hi=-Infinity,bottom=Infinity,top=-Infinity;
 for(const x of xs){lo=Math.min(lo,x);hi=Math.max(hi,x);}for(const y of ys){bottom=Math.min(bottom,y);top=Math.max(top,y);}
 const cos=Math.cos((top+bottom)/2*Math.PI/180),scale=Math.min(520/((hi-lo)*cos),510/(top-bottom)),ox=(600-(hi-lo)*cos*scale)/2,oy=(580-(top-bottom)*scale)/2;
 svg.replaceChildren(node('title',{},'Municípios de '+mapData.find(i=>i.uf===current).name));
 selectCity.replaceChildren(prompt);
 for(const f of [...data.features].sort((a,b)=>a.properties.name.localeCompare(b.properties.name,'pt-BR'))){
 const code=f.properties.code,name=f.properties.name;
 const option=element('option','',name);option.value=code;selectCity.append(option);
 let d='';for(const poly of polys(f))for(const ring of poly)d+=ring.map((p,i)=>(i?'L':'M')+(ox+(p[0]-lo)*cos*scale).toFixed(2)+','+(oy+(top-p[1])*scale).toFixed(2)).join('')+'Z';
 const path=node('path',{d,class:'municipal-shape','data-code':code,role:'button',tabindex:0,'aria-label':name,'aria-pressed':'false','fill-rule':'evenodd'});
 path.append(node('title',{},name));path.addEventListener('click',()=>chooseCity(code,true));path.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();chooseCity(code,true);}});
 path.addEventListener('mouseenter',()=>{$('map-tooltip').textContent=name;$('map-tooltip').hidden=false;});path.addEventListener('mouseleave',()=>{$('map-tooltip').hidden=true;});svg.append(path);
 }
 paint();
}
window.openMunicipalities=async uf=>{
 restoreDetail();weatherRequest++;weatherLoading=false;stage.classList.add('municipal-active');const id=++request;current=uf;selected=null;loading=true;country.setAttribute('hidden','');svg.removeAttribute('hidden');svg.replaceChildren();controls.hidden=false;detail.hidden=false;explore.hidden=true;selectCity.disabled=true;selectCity.replaceChildren(prompt);heading.textContent=mapData.find(i=>i.uf===uf).name;document.querySelector('.map-hint').hidden=true;$('map-tooltip').hidden=true;showDetails();
 try{
 if(!cache.has(uf)){
 const response=await fetch('/api/zeeclima?resource=municipios&uf='+encodeURIComponent(uf));if(!response.ok)throw Error('Malha indisponível');
 const data=await response.json();if(!data.features?.length)throw Error('Malha vazia');cache.set(uf,data);
 }
 if(id!==request)return;loading=false;selectCity.disabled=false;draw(cache.get(uf));
 }catch(error){if(id!==request)return;loading=false;showDetails();}
};
window.refreshMunicipalities=()=>{if(current&&current!==state.uf)window.openMunicipalities(state.uf);else if(current)paint();};
})();
