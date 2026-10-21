'use strict';
(() => {
  const root=document.getElementById('explorer');
  const host=document.getElementById('space');
  const status=document.getElementById('scene-status');
  const menu=document.getElementById('portfolio-menu');
  const projectPanel=document.getElementById('project-panel');
  const destinationCopy=document.querySelector('.destination-copy');
  const back=document.getElementById('back');
  const pauseButton=document.getElementById('pause');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const projects=window.SOLAR_PROJECTS;
  const definitions=[
    {id:'mercurio',name:'Mercúrio',r:.48,orbit:6.4,angle:4.7,speed:.2,color:'#b4afa5',kind:'rock'},
    {id:'design',name:'Vênus',label:'Design',r:1.38,orbit:10,angle:3.65,speed:.1,color:'#aa90c7',kind:'venus',description:'Informação que ganha forma. Design editorial e diagramação.',projects:['editorial']},
    {id:'codigo',name:'Terra',label:'Desenvolvimento',r:1.65,orbit:15,angle:.4,speed:.07,color:'#508ab7',kind:'earth',description:'Sites, sistemas e ferramentas. Ideias transformadas em código.',projects:['orbita','nexo']},
    {id:'dados',name:'Marte',label:'Dados',r:1.24,orbit:20,angle:1.8,speed:.053,color:'#c0785a',kind:'mars',description:'Análises e consultas que transformam dados em respostas.',projects:['pulso','nexo']},
    {id:'jupiter',name:'Júpiter',r:2.15,orbit:25,angle:3.7,speed:.032,color:'#cfaf8c',kind:'gas'},
    {id:'sobre',name:'Saturno',label:'Sobre',r:1.9,orbit:30,angle:5.3,speed:.024,color:'#d2c19d',kind:'gas',ring:true,description:'Minha trajetória, experiência e ferramentas.'},
    {id:'urano',name:'Urano',r:1.04,orbit:34,angle:3.1,speed:.018,color:'#91bcc4',kind:'ice'},
    {id:'contato',name:'Netuno',label:'Contato',r:1.13,orbit:38,angle:5.95,speed:.014,color:'#5277bd',kind:'ice',description:'Vamos construir a próxima conexão?'}
  ];
  let mode='overview',selected=null,selectedProject=null,paused=reduced.matches,raf=0,last=0,elapsed=0,flight=null,hover=false;
  let renderer,scene,camera,lookTarget,starfield,sun,sunMaterial;
  const worlds=[],satellites=[],satelliteLabels=[];
  const planetLabels=document.getElementById('planet-labels');
  const satelliteLayer=document.getElementById('satellite-labels');
  const announcements=document.getElementById('announcements');
  let pointerStart=null,pointerMoved=false;
  const pointers=new Map();let pinchDistance=0;
  const menuProjects=document.getElementById('menu-projects');
  Object.entries(projects).forEach(([id,p])=>{
    const button=document.createElement('button');button.type='button';button.textContent=p.title;
    const label=document.createElement('span');label.textContent=p.type+' ↗';button.append(label);
    button.addEventListener('click',()=>{menu.close();openProject(id);});menuProjects.append(button);
  });
  document.getElementById('menu-open').addEventListener('click',()=>menu.showModal());
  document.getElementById('all-projects').addEventListener('click',()=>menu.showModal());
  document.getElementById('menu-close').addEventListener('click',()=>menu.close());
  menu.addEventListener('click',event=>{if(event.target===menu){const rect=menu.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)menu.close();}});
  document.getElementById('help-open').addEventListener('click',()=>{const help=document.getElementById('controls-help');help.hidden=!help.hidden;});
  document.querySelectorAll('[data-area]').forEach(button=>button.addEventListener('click',()=>{if(menu.open)menu.close();visit(button.dataset.area);}));
  document.getElementById('home').addEventListener('click',overview);
  back.addEventListener('click',()=>{if(mode==='project')visit(selected.id);else overview();});
  document.getElementById('project-close').addEventListener('click',()=>visit(selected.id));
  document.getElementById('about-contact').addEventListener('click',()=>visit('contato'));
  document.getElementById('view-reset').addEventListener('click',()=>{if(mode==='overview')fly(overviewView());else fly(planetView(selected,mode==='project'));});
  function syncPause(){pauseButton.setAttribute('aria-pressed',String(paused));pauseButton.setAttribute('aria-label',paused?'Ativar animações':'Pausar animações');pauseButton.innerHTML=paused?'▷ <span>Ativar</span>':'Ⅱ <span>Pausar</span>';last=0;schedule();}
  pauseButton.addEventListener('click',()=>{paused=!paused;syncPause();});
  reduced.addEventListener('change',()=>{paused=reduced.matches;syncPause();if(flight){camera.position.copy(flight.to);lookTarget.copy(flight.targetTo);flight=null;}});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!menu.open){document.getElementById('controls-help').hidden=true;if(mode==='project')visit(selected.id);else if(mode!=='overview')overview();}});
  function fallback(message){status.textContent=message;status.style.top='45%';document.getElementById('explore-instruction').textContent='Acesse os trabalhos pelo menu';document.querySelector('.overview-copy').hidden=true;pauseButton.hidden=true;menu.showModal();}
  if(!window.THREE){fallback('A cena 3D não carregou. Os projetos continuam disponíveis no menu.');return;}
  try{renderer=new THREE.WebGLRenderer({antialias:innerWidth>650,alpha:false,powerPreference:'high-performance'});}catch(error){fallback('Este navegador não ativou o 3D. Explore os projetos pelo menu.');return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,innerWidth<650?1.3:1.6));renderer.setClearColor('#030611',1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;host.append(renderer.domElement);
  const canvas=renderer.domElement;canvas.setAttribute('aria-label','Arraste para girar a visão. Use o menu ou os planetas para escolher uma área.');canvas.setAttribute('tabindex','0');
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(49,1,.08,2200);lookTarget=new THREE.Vector3();
  scene.add(new THREE.AmbientLight('#a5bce0',.65));
  const sunLight=new THREE.PointLight('#fff0d5',1500,190,1.7);sunLight.position.set(0,0,0);scene.add(sunLight);
  const fill=new THREE.DirectionalLight('#9abaff',.7);fill.position.set(20,20,35);scene.add(fill);
  const sphereGeometry=new THREE.SphereGeometry(1,innerWidth<650?48:80,innerWidth<650?32:48);
  let seed=27351;function random(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
  function noise(x,y,z){return Math.sin(x*1.7+Math.sin(z*2.1))*Math.cos(y*1.8+Math.sin(x*.9))*.5+Math.sin(z*2.7+y*1.1)*.25+Math.cos(x*4.1-y*2.3+z)*.13;}
  function textureFor(def){
    const c=document.createElement('canvas');c.width=768;c.height=384;const ctx=c.getContext('2d');const data=ctx.createImageData(c.width,c.height);
    const base=new THREE.Color(def.color);const rgb=[base.r*255,base.g*255,base.b*255];
    for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
      const u=x/c.width*Math.PI*2,v=y/c.height*Math.PI;const nx=Math.sin(v)*Math.cos(u),ny=Math.cos(v),nz=Math.sin(v)*Math.sin(u);
      let n=noise(nx*3,ny*3,nz*3)*.42+noise(nx*8,ny*8,nz*8)*.21+noise(nx*21,ny*21,nz*21)*.09+noise(nx*54,ny*54,nz*54)*.04;
      let shade=.62+n*.48;let values=rgb.map(value=>value*shade);
      if(def.kind==='gas'){const band=Math.sin(v*29+noise(nx*6,ny*5,nz*6)*1.5)*.12+Math.sin(v*79+nx*3)*.045;values=rgb.map((value,i)=>value*(.67+band+n*.2)+(i===0?8:0));}
      if(def.kind==='ice')values=rgb.map(value=>value*(.7+Math.sin(v*21+n*4)*.035+n*.08));
      if(def.kind==='venus'){const swirling=Math.sin(u*7+ny*12+n*7)*.04;values=rgb.map(value=>value*(.78+n*.25+swirling));}
      if(def.kind==='earth'){
        if(n>-.045){const h=Math.max(0,n+.045);values=[22+h*100,56+h*130,38+h*90];if(h>.3)values=[102+h*40,100+h*40,74+h*30];}
        else values=[10+n*10,38+n*35,80+n*70];
        if(Math.abs(ny)>.95)values=[194,211,218];
      }
      const grain=(random()-.5)*10;
      const i=(y*c.width+x)*4;data.data[i]=Math.max(0,Math.min(255,values[0]+grain));data.data[i+1]=Math.max(0,Math.min(255,values[1]+grain));data.data[i+2]=Math.max(0,Math.min(255,values[2]+grain));data.data[i+3]=255;
    }
    ctx.putImageData(data,0,0);
    if(def.kind==='rock'||def.kind==='mars')for(let i=0;i<140;i++){const x=random()*768,y=random()*384,r=1+random()*12;const g=ctx.createRadialGradient(x-r*.25,y-r*.2,0,x,y,r);g.addColorStop(0,'#00000022');g.addColorStop(.7,'#00000012');g.addColorStop(.85,'#ffffff16');g.addColorStop(1,'#ffffff00');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());return texture;
  }
  function cloudTexture(){const c=document.createElement('canvas');c.width=768;c.height=384;const ctx=c.getContext('2d');for(let i=0;i<360;i++){const x=random()*768,y=25+random()*334;ctx.save();ctx.translate(x,y);ctx.rotate((random()-.5)*1);const g=ctx.createRadialGradient(0,0,1,0,0,16);g.addColorStop(0,'#ffffff58');g.addColorStop(1,'#ffffff00');ctx.scale(2.5,.55);ctx.fillStyle=g;ctx.fillRect(-16,-16,32,32);ctx.restore();}return new THREE.CanvasTexture(c);}
  function haloTexture(color){const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');const g=ctx.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,color);g.addColorStop(.2,color);g.addColorStop(.48,'#ffb34722');g.addColorStop(1,'#ffb34700');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);}
  sunMaterial=new THREE.ShaderMaterial({uniforms:{uTime:{value:0}},vertexShader:'varying vec3 vPosition; varying vec3 vNormal; void main(){vPosition=position;vNormal=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform float uTime;varying vec3 vPosition;varying vec3 vNormal;float n(vec3 p){return sin(p.x*11.0+sin(p.y*9.0+uTime*.12))*cos(p.z*12.0+sin(p.x*7.0))+sin(p.y*23.0+p.z*13.0)*.3;}void main(){float f=n(vPosition)*.15+n(vPosition*2.7)*.08+n(vPosition*6.0)*.03;vec3 c=mix(vec3(1.0,.24,.025),vec3(1.0,.88,.34),.6+f);float edge=pow(max(0.0,vNormal.z),.2);gl_FragColor=vec4(c*(.7+edge*.6),1.0);}'});
  sun=new THREE.Mesh(sphereGeometry,sunMaterial);sun.scale.setScalar(3.65);scene.add(sun);
  const corona=new THREE.Sprite(new THREE.SpriteMaterial({map:haloTexture('#ffd779bb'),color:'#ffcf85',transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));corona.scale.set(25,25,1);scene.add(corona);
  const atmosphereVertex='varying vec3 vNormal;varying vec3 vView;void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);vNormal=normalize(normalMatrix*normal);vView=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}';
  function atmosphere(r,color){const mat=new THREE.ShaderMaterial({uniforms:{uColor:{value:new THREE.Color(color)}},vertexShader:atmosphereVertex,fragmentShader:'uniform vec3 uColor;varying vec3 vNormal;varying vec3 vView;void main(){float f=pow(1.0-abs(dot(normalize(vNormal),normalize(vView))),3.8);gl_FragColor=vec4(uColor,f*.6);}',transparent:true,depthWrite:false,side:THREE.FrontSide,blending:THREE.AdditiveBlending});const mesh=new THREE.Mesh(sphereGeometry,mat);mesh.scale.setScalar(r*1.045);return mesh;}
  definitions.forEach(def=>{
    const anchor=new THREE.Group();scene.add(anchor);
    const material=new THREE.MeshStandardMaterial({map:textureFor(def),roughness:def.kind==='earth'?.8:1,metalness:0,emissive:new THREE.Color(def.color).multiplyScalar(.035)});
    const mesh=new THREE.Mesh(sphereGeometry,material);mesh.scale.setScalar(def.r);mesh.rotation.z=def.kind==='earth'?.2:.08;anchor.add(mesh);
    let clouds;
    if(def.kind==='earth'){clouds=new THREE.Mesh(sphereGeometry,new THREE.MeshStandardMaterial({map:cloudTexture(),transparent:true,opacity:.63,depthWrite:false,roughness:1}));clouds.scale.setScalar(def.r*1.012);anchor.add(clouds);const loader=new THREE.TextureLoader();loader.load('/solar/textures/earth.jpg',texture=>{texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());material.map.dispose();material.map=texture;material.needsUpdate=true;schedule();},undefined,()=>{});loader.load('/solar/textures/clouds.png',texture=>{clouds.material.map.dispose();clouds.material.map=texture;clouds.material.opacity=.7;clouds.material.needsUpdate=true;schedule();},undefined,()=>{});anchor.add(atmosphere(def.r,'#50a9fa'));}
    else if(def.id==='design')anchor.add(atmosphere(def.r,'#9672d8'));else if(def.kind==='ice')anchor.add(atmosphere(def.r,'#76b5ef'));
    if(def.ring){const ringCanvas=document.createElement('canvas');ringCanvas.width=256;ringCanvas.height=1;const ctx=ringCanvas.getContext('2d');for(let x=0;x<256;x++){ctx.fillStyle=`rgba(${145+Math.round(random()*60)},${129+Math.round(random()*55)},${99+Math.round(random()*50)},${.25+random()*.55})`;ctx.fillRect(x,0,1,1);}const ringTex=new THREE.CanvasTexture(ringCanvas);ringTex.colorSpace=THREE.SRGBColorSpace;const ringGeo=new THREE.RingGeometry(def.r*1.35,def.r*2.15,100);const uv=ringGeo.attributes.uv,pos=ringGeo.attributes.position;for(let i=0;i<uv.count;i++){const radial=Math.hypot(pos.getX(i),pos.getY(i));uv.setXY(i,(radial-def.r*1.35)/(def.r*.8),0);}const ring=new THREE.Mesh(ringGeo,new THREE.MeshStandardMaterial({map:ringTex,side:THREE.DoubleSide,transparent:true,opacity:.85,roughness:1,depthWrite:false}));ring.rotation.x=-Math.PI/2+.28;ring.rotation.z=.2;anchor.add(ring);}
    const orbitPoints=[];for(let i=0;i<=180;i++){const a=i/180*Math.PI*2;orbitPoints.push(new THREE.Vector3(Math.cos(a)*def.orbit,0,Math.sin(a)*def.orbit));}const orbit=new THREE.Line(new THREE.BufferGeometry().setFromPoints(orbitPoints),new THREE.LineBasicMaterial({color:'#718daf',transparent:true,opacity:.17}));scene.add(orbit);
    const world={...def,anchor,mesh,clouds,orbitLine:orbit,angle:def.angle};mesh.userData.world=world;worlds.push(world);
    if(def.label){const label=document.createElement('button');label.type='button';label.className='planet-label';label.textContent=def.label;label.setAttribute('aria-label',`${def.name}: explorar ${def.label}`);label.addEventListener('click',()=>visit(def.id));label.addEventListener('pointerenter',()=>{hover=true;});label.addEventListener('pointerleave',()=>{hover=false;});label.addEventListener('focus',()=>{hover=true;});label.addEventListener('blur',()=>{hover=false;});planetLabels.append(label);world.labelElement=label;}
  });
  // A sparse star field and a softly painted galactic band, all generated locally.
  const starGeometry=new THREE.BufferGeometry(),starPositions=[],starColors=[];
  for(let i=0;i<4800;i++){const theta=random()*Math.PI*2,z=random()*2-1,r=220+random()*450,d=Math.sqrt(1-z*z);starPositions.push(r*d*Math.cos(theta),r*z,r*d*Math.sin(theta));const c=new THREE.Color().setHSL(.58+random()*.15,.12+random()*.22,.45+random()*.4);starColors.push(c.r,c.g,c.b);}
  starGeometry.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));starGeometry.setAttribute('color',new THREE.Float32BufferAttribute(starColors,3));starfield=new THREE.Points(starGeometry,new THREE.PointsMaterial({size:.42,vertexColors:true,transparent:true,opacity:.9,depthWrite:false}));scene.add(starfield);
  const skyCanvas=document.createElement('canvas');skyCanvas.width=1024;skyCanvas.height=512;const skyCtx=skyCanvas.getContext('2d');skyCtx.fillStyle='#030611';skyCtx.fillRect(0,0,1024,512);skyCtx.globalCompositeOperation='screen';for(let i=0;i<150;i++){const x=random()*1024,y=220+Math.sin(x*.007)*60+(random()-.5)*80,r=20+random()*90;const g=skyCtx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,i%3===0?'#6243720b':'#2a557f0d');g.addColorStop(1,'#00000000');skyCtx.fillStyle=g;skyCtx.fillRect(x-r,y-r,r*2,r*2);}const skyTex=new THREE.CanvasTexture(skyCanvas);skyTex.colorSpace=THREE.SRGBColorSpace;const sky=new THREE.Mesh(new THREE.SphereGeometry(850,40,24),new THREE.MeshBasicMaterial({map:skyTex,side:THREE.BackSide,depthWrite:false}));sky.rotation.set(.3,.8,-.4);scene.add(sky);
  // A subtle asteroid belt offers depth without obstructing navigation.
  const asteroidGeometry=new THREE.BufferGeometry(),asteroids=[];for(let i=0;i<650;i++){const a=random()*Math.PI*2,r=22+random()*1.2;asteroids.push(Math.cos(a)*r,(random()-.5)*.28,Math.sin(a)*r);}asteroidGeometry.setAttribute('position',new THREE.Float32BufferAttribute(asteroids,3));scene.add(new THREE.Points(asteroidGeometry,new THREE.PointsMaterial({color:'#aa9a88',size:.035,transparent:true,opacity:.44})));
  function positionWorlds(dt){worlds.forEach(world=>{if(mode==='overview'&&!paused&&!hover&&!pointerStart)world.angle+=dt*world.speed*.65;world.anchor.position.set(Math.cos(world.angle)*world.orbit,0,Math.sin(world.angle)*world.orbit);if(!paused){world.mesh.rotation.y+=dt*(world.kind==='earth'?.12:.08);if(world.clouds)world.clouds.rotation.y+=dt*.14;}});}
  positionWorlds(0);
  function overviewView(){const mobile=innerWidth<650;return {position:new THREE.Vector3(mobile?0:0,mobile?41:28,mobile?67:49),target:new THREE.Vector3(mobile?1:0,0,mobile?4:1)};}
  function planetView(world,project=false){const p=world.anchor.position.clone(),r=world.r,mobile=innerWidth<650;const offsetTarget=mobile?new THREE.Vector3(0,-r*.30,0):new THREE.Vector3(-r*.78,0,0);const target=p.add(offsetTarget);return {position:target.clone().add(new THREE.Vector3(r*.3,r*.4,r*(mobile?4.8:project?3.45:4.35))),target};}
  function fly(view){document.getElementById('controls-help').hidden=true;if(reduced.matches){camera.position.copy(view.position);lookTarget.copy(view.target);flight=null;}else flight={from:camera.position.clone(),to:view.position.clone(),targetFrom:lookTarget.clone(),targetTo:view.target.clone(),start:performance.now(),duration:1450};schedule();}
  function changeMode(next){sun.visible=next==='overview';corona.visible=next==='overview';mode=next;root.dataset.mode=mode;projectPanel.hidden=next!=='project';document.getElementById('about-panel').hidden=next!=='about';document.getElementById('contact-panel').hidden=next!=='contact';destinationCopy.hidden=next!=='planet';back.hidden=next==='overview';back.textContent=next==='project'?'← Voltar ao planeta':'← Sistema solar';document.getElementById('explore-instruction').textContent=next==='overview'?'Escolha um planeta para explorar':next==='planet'?'Escolha um trabalho em órbita':'';worlds.forEach(w=>{if(w.labelElement)w.labelElement.hidden=next!=='overview';w.orbitLine.visible=next==='overview';});document.querySelectorAll('#area-navigation [data-area]').forEach(button=>{if(selected&&button.dataset.area===selected.id)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});}
  function clearSatellites(){satellites.splice(0).forEach(object=>{scene.remove(object);if(object.geometry)object.geometry.dispose();if(object.material)object.material.dispose();});satelliteLabels.splice(0).forEach(label=>label.remove());}
  function createSatellites(world){
    clearSatellites();const ids=world.projects||[];const r=world.r;
    ids.forEach((id,index)=>{
      const a=index===0?2.65:3.9;const marker=new THREE.Mesh(new THREE.SphereGeometry(r*.027,12,8),new THREE.MeshBasicMaterial({color:'#b6edff'}));marker.position.copy(world.anchor.position).add(new THREE.Vector3(Math.cos(a)*r*1.7,Math.sin(a)*r*1.1,r*.3));scene.add(marker);satellites.push(marker);
      const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:haloTexture('#9eeaffbb'),color:'#9eeaff',transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));halo.scale.set(r*.3,r*.3,1);halo.position.copy(marker.position);scene.add(halo);satellites.push(halo);
      const label=document.createElement('button');label.type='button';label.className='satellite-label';label.textContent=projects[id].title;label.addEventListener('click',()=>openProject(id));satelliteLayer.append(label);satelliteLabels.push(label);label.worldPoint=marker.position;label.projectId=id;
    });
    if(ids.length){const linePoints=[];for(let i=0;i<=90;i++){const a=i/90*Math.PI*2;linePoints.push(world.anchor.position.clone().add(new THREE.Vector3(Math.cos(a)*r*1.7,Math.sin(a)*r*1.1,r*.3)));}const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(linePoints),new THREE.LineBasicMaterial({color:'#8acbff',transparent:true,opacity:.24}));scene.add(line);satellites.push(line);}
  }
  function visit(id){
    if(!camera)return;
    selected=worlds.find(world=>world.id===id)||worlds.find(world=>world.id==='codigo');selectedProject=null;
    const next=id==='sobre'?'about':id==='contato'?'contact':'planet';changeMode(next);createSatellites(selected);
    document.getElementById('destination-eyebrow').textContent=`${selected.name.toUpperCase()} / ${selected.projects?.length||0} ${(selected.projects?.length||0)===1?'PROJETO':'PROJETOS'}`;
    document.getElementById('destination-title').textContent=selected.label;
    document.getElementById('destination-description').textContent=selected.description;
    const chips=document.getElementById('destination-projects');chips.replaceChildren();(selected.projects||[]).forEach(project=>{const button=document.createElement('button');button.type='button';button.className='project-chip';button.textContent=projects[project].title+' ↗';button.addEventListener('click',()=>openProject(project));chips.append(button);});
    fly(planetView(selected));announcements.textContent=`Explorando ${selected.label}. ${selected.description}`;
  }
  function openProject(id){
    if(!camera){location.href=projects[id].href;return;}
    const project=projects[id];if(!selected||!selected.projects?.includes(id)){const owner=worlds.find(world=>world.projects?.includes(id));selected=owner;createSatellites(selected);}
    selectedProject=id;changeMode('project');
    document.getElementById('project-breadcrumb').textContent=`Sistema solar / ${selected.label}`;
    document.getElementById('project-category').textContent=project.type;
    document.getElementById('project-title').textContent=project.title;
    document.getElementById('project-description').textContent=project.description;
    document.getElementById('project-visual').innerHTML=project.visual;
    const demo=document.getElementById('project-demo');demo.href=project.href;demo.textContent=id==='editorial'?'Abrir galeria ↗':'Abrir demonstração ↗';
    const code=document.getElementById('project-code');code.hidden=!project.code;if(project.code)code.href=project.code;
    document.getElementById('project-preview-note').textContent=id==='editorial'?'Design e diagramação · créditos originais preservados':'Prévia ilustrativa · demonstração com dados fictícios';
    projectPanel.scrollTop=0;satelliteLabels.forEach(label=>label.dataset.selected=String(label.projectId===id));fly(planetView(selected,true));announcements.textContent=`Projeto ${project.title}. ${project.description}`;
    document.getElementById('project-close').focus({preventScroll:true});
  }
  function overview(){if(!camera)return;selected=null;selectedProject=null;clearSatellites();changeMode('overview');document.querySelectorAll('#area-navigation [data-area]').forEach(button=>button.removeAttribute('aria-current'));fly(overviewView());announcements.textContent='Visão geral do sistema solar. Escolha um planeta ou use o menu.';}
  const projected=new THREE.Vector3();
  function labelAt(label,point,offsetX=0,offsetY=0){projected.copy(point).project(camera);const x=(projected.x*.5+.5)*host.clientWidth+offsetX,y=(-projected.y*.5+.5)*host.clientHeight+offsetY;const isVisible=projected.z>-1&&projected.z<1&&x>25&&x<host.clientWidth-25&&y>130&&y<host.clientHeight-90;label.style.visibility=isVisible?'visible':'hidden';const halfWidth=label.offsetWidth/2;const safeX=Math.max(halfWidth+14,Math.min(host.clientWidth-halfWidth-14,x));label.style.left=`${safeX}px`;label.style.top=`${y}px`;}
  function labels(){worlds.forEach(world=>{if(world.labelElement&&mode==='overview'){const point=world.anchor.position.clone().add(new THREE.Vector3(0,world.r*1.4,0));labelAt(world.labelElement,point,0,-12);}});satelliteLabels.forEach(label=>labelAt(label,label.worldPoint,0,-17));}
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  function hit(event){const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);return raycaster.intersectObjects(worlds.filter(w=>w.label).map(w=>w.mesh),false)[0]?.object.userData.world;}
  function rotate(dx,dy){flight=null;const spherical=new THREE.Spherical().setFromVector3(camera.position.clone().sub(lookTarget));spherical.theta-=dx*.004;spherical.phi=Math.max(.15,Math.min(Math.PI-.15,spherical.phi-dy*.004));camera.position.copy(lookTarget).add(new THREE.Vector3().setFromSpherical(spherical));schedule();}
  function zoom(factor){flight=null;const offset=camera.position.clone().sub(lookTarget);const r=selected?selected.r:1,min=selected?r*2.5:26,max=selected?r*12:130;offset.setLength(Math.max(min,Math.min(max,offset.length()*factor)));camera.position.copy(lookTarget).add(offset);schedule();}
  canvas.addEventListener('wheel',event=>{event.preventDefault();zoom(Math.exp(Math.max(-90,Math.min(90,event.deltaY))*.002));},{passive:false});
  canvas.addEventListener('pointerdown',event=>{if(event.button!==0)return;canvas.setPointerCapture(event.pointerId);pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});pointerStart={x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY};pointerMoved=false;if(pointers.size===2){const p=[...pointers.values()];pinchDistance=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);}canvas.classList.add('dragging');});
  canvas.addEventListener('pointermove',event=>{if(!pointers.has(event.pointerId)){if(mode==='overview'){const target=hit(event);canvas.style.cursor=target?'pointer':'grab';hover=!!target;}return;}pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(pointers.size===2){const p=[...pointers.values()],distance=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);if(pinchDistance>0&&distance>1)zoom(pinchDistance/distance);pinchDistance=distance;pointerMoved=true;return;}if(!pointerStart)return;const dx=event.clientX-pointerStart.lastX,dy=event.clientY-pointerStart.lastY;if(Math.hypot(event.clientX-pointerStart.x,event.clientY-pointerStart.y)>5)pointerMoved=true;if(pointerMoved)rotate(dx,dy);pointerStart.lastX=event.clientX;pointerStart.lastY=event.clientY;});
  function release(event,cancel=false){const click=pointerStart&&!pointerMoved&&!cancel&&pointers.size===1;const target=click&&mode==='overview'?hit(event):null;pointers.delete(event.pointerId);if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);if(pointers.size===0){pointerStart=null;canvas.classList.remove('dragging');pinchDistance=0;}else{const p=[...pointers.values()][0];pointerStart={x:p.x,y:p.y,lastX:p.x,lastY:p.y};pointerMoved=true;}if(target)visit(target.id);}
  canvas.addEventListener('pointerup',event=>release(event));canvas.addEventListener('pointercancel',event=>release(event,true));canvas.addEventListener('pointerleave',()=>{hover=false;});
  canvas.addEventListener('keydown',event=>{if(event.key==='ArrowLeft')rotate(-25,0);else if(event.key==='ArrowRight')rotate(25,0);else if(event.key==='ArrowUp')rotate(0,-25);else if(event.key==='ArrowDown')rotate(0,25);else if(event.key==='+'||event.key==='=')zoom(.9);else if(event.key==='-')zoom(1.1);else return;event.preventDefault();});
  function frame(now){raf=0;const dt=last?Math.min((now-last)/1000,.05):0;last=now;if(!paused)elapsed+=dt;positionWorlds(dt);sunMaterial.uniforms.uTime.value=elapsed;if(!paused)sun.rotation.y+=dt*.025;if(flight){const t=Math.min(1,(now-flight.start)/flight.duration),e=t*t*(3-2*t);camera.position.lerpVectors(flight.from,flight.to,e);lookTarget.lerpVectors(flight.targetFrom,flight.targetTo,e);if(t===1)flight=null;}camera.lookAt(lookTarget);labels();renderer.render(scene,camera);if(!document.hidden&&(!paused||flight))raf=requestAnimationFrame(frame);}
  function schedule(){if(!raf&&!document.hidden)raf=requestAnimationFrame(frame);}
  function resize(){const width=host.clientWidth,height=host.clientHeight;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();const view=mode==='overview'?overviewView():planetView(selected,mode==='project');if(flight){flight={from:camera.position.clone(),to:view.position.clone(),targetFrom:lookTarget.clone(),targetTo:view.target.clone(),start:performance.now(),duration:700};}else{camera.position.copy(view.position);lookTarget.copy(view.target);}schedule();}
  document.addEventListener('visibilitychange',()=>{last=0;if(document.hidden){if(raf)cancelAnimationFrame(raf);raf=0;}else schedule();});
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();if(raf)cancelAnimationFrame(raf);raf=0;status.hidden=false;status.textContent='Cena pausada. Recarregue a página ou use o menu para ver os projetos.';});
  canvas.addEventListener('webglcontextrestored',()=>{status.hidden=true;resize();});
  new ResizeObserver(resize).observe(host);resize();syncPause();status.hidden=true;schedule();
})();
