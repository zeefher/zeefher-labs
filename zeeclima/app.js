"use strict";
// Cenários inteiramente fictícios. Estes números não são previsões meteorológicas.
const TYPES={rain:{name:'Chuva intensa',icon:'rain'},storm:{name:'Tempestade',icon:'storm'},heat:{name:'Calor intenso',icon:'sun'},dry:{name:'Seca e baixa umidade',icon:'dry'},wind:{name:'Vento forte',icon:'wind'}};
const FIXTURES={RO:[41,47,39,21,28],AC:[28,22,24,12,20],AM:[43,37,31,26,22],RR:[22,14,49,46,27],PA:[78,70,63,29,58],AP:[52,33,24,18,24],TO:[48,51,67,58,39],MA:[82,66,43,35,60],PI:[56,51,85,80,46],CE:[48,34,42,35,32],RN:[23,18,31,29,27],PB:[48,32,49,42,35],PE:[62,48,70,52,49],AL:[74,57,63,37,49],SE:[76,60,66,41,51],BA:[43,42,83,77,45],MG:[42,43,59,48,37],ES:[37,33,44,22,37],RJ:[65,72,71,26,52],SP:[61,69,68,30,56],PR:[74,76,38,25,66],SC:[85,82,24,17,80],RS:[91,87,28,16,78],MS:[70,75,72,41,64],MT:[64,67,86,78,56],GO:[45,65,80,73,48],DF:[28,22,32,26,23]};
const KEYS=Object.keys(TYPES);
const DELTA={rain:[0,-5,-12],storm:[0,-7,-16],heat:[0,4,9],dry:[0,6,12],wind:[0,-6,-10]};
const COLORS=['#477c78','#bfa567','#d18a60','#ce647d'];
const LEVELS=['Baixa','Moderada','Alta','Muito alta'];
const NS='http://www.w3.org/2000/svg';
const state={uf:'MA',event:'all',horizon:24};
const mapData=window.BRAZIL_MAP;
const $=id=>document.getElementById(id);
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
function intensity(uf,type){return clamp(FIXTURES[uf][KEYS.indexOf(type)]+DELTA[type][[24,48,72].indexOf(state.horizon)],4,98);}
function level(score){return score<35?0:score<55?1:score<75?2:3;}
function ranked(uf){return (state.event==='all'?KEYS:[state.event]).map(type=>({type,score:intensity(uf,type)})).sort((a,b)=>b.score-a.score);}
function principal(uf){return ranked(uf)[0];}
function node(tag,attributes={},text){const el=document.createElementNS(NS,tag);for(const [key,value] of Object.entries(attributes))el.setAttribute(key,String(value));if(text!==undefined)el.textContent=text;return el;}
function icon(type){const svg=node('svg',{'aria-hidden':'true',viewBox:'0 0 24 24'});svg.append(node('use',{href:'#'+TYPES[type].icon}));return svg;}
const select=$('state-select');
for(const item of [...mapData].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'))){const option=document.createElement('option');option.value=item.uf;option.textContent=item.name;select.append(option);}
const outsideLabels={RN:[574,183],PB:[575,205],PE:[571,224],AL:[578,244],SE:[568,266],DF:[405,311],RJ:[463,424]};
for(const item of mapData){
  const path=node('path',{d:item.path,'data-uf':item.uf,class:'map-state',tabindex:0,role:'button','aria-pressed':'false','aria-label':item.name});
  path.append(node('title',{},item.name));
  path.addEventListener('click',()=>{choose(item.uf);window.openMunicipalities?.(item.uf);});
  path.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();choose(item.uf);window.openMunicipalities?.(item.uf);}});
  const hint=()=>{if(document.body.dataset.mode==='official'&&window.officialHint){window.officialHint(item.uf);return;}const entry=principal(item.uf);$('map-tooltip').textContent=`${item.name} · ${LEVELS[level(entry.score)]} · ${entry.score}/100 · simulado`;$('map-tooltip').hidden=false;};
  path.addEventListener('mouseenter',hint);path.addEventListener('focus',hint);
  for(const event of ['mouseleave','blur'])path.addEventListener(event,()=>{$('map-tooltip').hidden=true;});
  $('states').append(path);
  const target=outsideLabels[item.uf]||[item.x,item.y];
  if(outsideLabels[item.uf])$('state-labels').append(node('path',{d:`M${item.x},${item.y} L${target[0]-9},${target[1]-3}`,class:'label-connector'}));
  $('state-labels').append(node('text',{x:target[0],y:target[1],class:'state-label'},item.uf));
}
function choose(uf){state.uf=uf;render();}
function probabilitySeries(uf,type){
  // Curvas ilustrativas pré-definidas para demonstrar a interface, sem modelo meteorológico.
  const strength=intensity(uf,type);
  const offset=(uf.charCodeAt(0)+uf.charCodeAt(1))%11;
  let peak=clamp(Math.round(strength*.68+20+offset),12,97);
  if(uf==='MA'&&type==='rain')peak=86-[0,5,11][[24,48,72].indexOf(state.horizon)];
  const profiles={rain:[.33,.43,.62,.82,1,.85,.70],storm:[.26,.43,.76,1,.88,.65,.43],heat:[.54,.58,.67,.73,.84,.94,1],dry:[.62,.68,.73,.79,.87,.95,1],wind:[.34,.61,1,.88,.74,.61,.48]};
  return profiles[type].map((factor,index)=>({hour:index*state.horizon/6,value:Math.round(peak*factor)}));
}
function drawChart(item,type){
  const series=probabilitySeries(item.uf,type),peak=Math.max(...series.map(p=>p.value));
  $('probability').textContent=peak+'%';$('chart-event').textContent=TYPES[type].name;
  const svg=$('probability-chart');svg.replaceChildren();
  svg.setAttribute('aria-label',`${TYPES[type].name}, ${item.name}, cenário de ${state.horizon} horas. Probabilidades fictícias: ${series.map(p=>`${p.hour} horas: ${p.value}%`).join('; ')}. Não é previsão real.`);
  const defs=node('defs'),gradient=node('linearGradient',{id:'chart-fill',x1:'0',x2:'0',y1:'0',y2:'1'});
  gradient.append(node('stop',{offset:'0%','stop-color':'#80dfca','stop-opacity':'.23'}),node('stop',{offset:'100%','stop-color':'#80dfca','stop-opacity':'.01'}));defs.append(gradient);svg.append(defs);
  const left=34,right=383,top=22,bottom=155;
  for(const value of [0,50,100]){const y=bottom-value/100*(bottom-top);svg.append(node('line',{x1:left,x2:right,y1:y,y2:y,class:'chart-grid'}),node('text',{x:25,y:y+3,'text-anchor':'end',class:'chart-axis'},value+'%'));}
  const points=series.map((p,i)=>[left+i/6*(right-left),bottom-p.value/100*(bottom-top)]);
  const line=points.map((p,i)=>(i?'L':'M')+p.join(',')).join(' ');
  svg.append(node('path',{d:line+` L${right},${bottom} L${left},${bottom} Z`,fill:'url(#chart-fill)'}),node('path',{d:line,class:'chart-line'}));
  series.forEach((p,i)=>{if(i%2===0)svg.append(node('text',{x:points[i][0],y:178,'text-anchor':'middle',class:'chart-axis'},'+'+p.hour+'h'));if(p.value===peak){svg.append(node('circle',{cx:points[i][0],cy:points[i][1],r:4,class:'chart-point'}),node('text',{x:points[i][0],y:points[i][1]-11,'text-anchor':'middle',fill:'#a4e8d7','font-size':10,'font-family':'Segoe UI,Arial,sans-serif'},p.value+'%'));}});
  const values=$('chart-values');values.replaceChildren();for(const point of series){const li=document.createElement('li');li.textContent=`+${point.hour}h · ${point.value}% ilustrativos`;values.append(li);}
}
function renderEventRows(uf){
  const entries=ranked(uf);$('event-count').textContent=entries.length+' '+(entries.length===1?'tipo':'tipos');
  const list=$('state-event-list');list.replaceChildren();
  for(const entry of entries){const row=document.createElement('div');row.className='state-event-row';const name=document.createElement('span');name.append(icon(entry.type),document.createTextNode(TYPES[entry.type].name));const score=document.createElement('span'),dot=document.createElement('i');dot.className='severity-dot';dot.style.background=COLORS[level(entry.score)];score.append(dot,document.createTextNode(LEVELS[level(entry.score)]+' · '+entry.score));row.append(name,score);list.append(row);}
}
function renderCards(ranking){
  const eligible=ranking.filter(item=>item.score>=55).slice(0,5),cards=$('event-cards');cards.replaceChildren();$('empty-events').hidden=eligible.length>0;
  for(const item of eligible){const button=document.createElement('button');button.type='button';button.className='event-card';button.setAttribute('aria-pressed',String(item.uf===state.uf));button.setAttribute('aria-label',`Explorar ${item.name}, ${TYPES[item.type].name}, intensidade simulada ${LEVELS[level(item.score)]}`);const top=document.createElement('div');top.className='event-card-top';top.append(icon(item.type));const badge=document.createElement('span');badge.className='event-severity';badge.textContent=LEVELS[level(item.score)].toUpperCase();badge.style.color=level(item.score)===3?'#e5a8b6':'#e6b289';top.append(badge);const title=document.createElement('h3');title.textContent=item.name;const type=document.createElement('span');type.className='event-type';type.textContent=TYPES[item.type].name;const bottom=document.createElement('div');bottom.className='event-card-bottom';const value=document.createElement('span');const strong=document.createElement('strong');strong.textContent=item.score;value.append(strong,document.createTextNode(' / 100 · simulado'));bottom.append(value);const arrow=node('svg',{'aria-hidden':'true'});arrow.append(node('use',{href:'#arrow'}));bottom.append(arrow);button.append(top,title,type,bottom);button.addEventListener('click',()=>{choose(item.uf);if(matchMedia('(max-width:600px)').matches)$('state-name').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'center'});});cards.append(button);}
}
function render(){
  window.refreshMunicipalities?.();
  $('map-tooltip').hidden=true;
  if(document.body.dataset.mode==='official'&&window.renderOfficial){window.renderOfficial(state.uf);return;}
  select.value=state.uf;
  const item=mapData.find(s=>s.uf===state.uf),current=principal(state.uf),index=level(current.score);
  $('state-name').textContent=item.name;$('state-region').textContent=item.region+' / Brasil';$('state-uf').textContent=item.uf;
  $('level-name').textContent='Intensidade '+LEVELS[index].toLocaleLowerCase('pt-BR');$('state-score').textContent=current.score+' / 100';$('level-name').style.color=COLORS[index];$('state-score').style.color=COLORS[index];$('risk-fill').style.left=`calc(${current.score}% - 1px)`;
  for(const path of document.querySelectorAll('.map-state')){const entry=principal(path.dataset.uf),region=mapData.find(s=>s.uf===path.dataset.uf);path.setAttribute('fill',COLORS[level(entry.score)]);path.setAttribute('aria-pressed',String(path.dataset.uf===state.uf));path.setAttribute('aria-label',`${region.name}, ${TYPES[entry.type].name}, intensidade ${LEVELS[level(entry.score)]}, ${entry.score} de 100, simulado`);}
  const ranking=mapData.map(s=>({...s,...principal(s.uf)})).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name,'pt-BR'));
  $('stat-high').textContent=ranking.filter(s=>s.score>=55).length;$('stat-peak').textContent=ranking[0].score;$('stat-location').textContent=ranking[0].name;
  const counts={};ranking.forEach(s=>{counts[s.type]=(counts[s.type]||0)+1;});const frequent=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0];$('stat-event').textContent=TYPES[frequent].name;
  document.querySelectorAll('[data-event]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.event===state.event)));
  document.querySelectorAll('[data-horizon]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.horizon)===state.horizon)));
  drawChart(item,current.type);renderEventRows(state.uf);renderCards(ranking);
  $('status').textContent=`${item.name}: intensidade simulada ${LEVELS[index]}, ${current.score} de 100. Evento ${TYPES[current.type].name}. Cenário de ${state.horizon} horas.`;
}
select.addEventListener('change',()=>choose(select.value));
document.querySelectorAll('[data-event]').forEach(button=>button.addEventListener('click',()=>{state.event=button.dataset.event;render();}));
document.querySelectorAll('[data-horizon]').forEach(button=>button.addEventListener('click',()=>{state.horizon=Number(button.dataset.horizon);render();}));
$('reset').addEventListener('click',()=>{Object.assign(state,{uf:'MA',event:'all',horizon:24});$('map-tooltip').hidden=true;render();});
const dialog=$('about-dialog');let dialogTrigger;
for(const id of ['about-top','about-nav','about-bottom'])$(id).addEventListener('click',event=>{dialogTrigger=event.currentTarget;dialog.showModal();});
$('close-about').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>dialogTrigger?.focus());
dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});
render();
