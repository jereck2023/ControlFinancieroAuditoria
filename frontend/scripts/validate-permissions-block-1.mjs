// Isolated API process, existing test DB only. No credentials/JWT written or printed.
import {spawn,execFileSync} from 'node:child_process';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import {hiddenLines} from './testing/test-environment.mjs';
const run=`QA_PERM_B1_${new Date().toISOString().replace(/\D/g,'').slice(0,14)}`;
const directory=new URL(`../docs/evidencias-permisos-bloque-1/${run}/`,import.meta.url);mkdirSync(directory,{recursive:true});
const input=hiddenLines(),users=[],areas=[];let api,relay,admin='',qaSecret='',adminSecret='',failed=false;
const evidence={run,database:'ControlFinancieroDB_Pruebas',apiPort:7294,events:[],users,areas};
const save=()=>writeFileSync(new URL('resultado.json',directory),JSON.stringify(evidence,null,2));
function record(type,data){evidence.events.push({utc:new Date().toISOString(),type,...data});save();}
function must(ok,message){if(!ok)throw new Error(message);}
function sql(query){return execFileSync('sqlcmd',['-S','localhost','-E','-d','ControlFinancieroDB_Pruebas','-b','-h','-1','-y','4000','-f','65001','-Q',`SET NOCOUNT ON; ${query}`],{encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024}).trim();}
function verify(){
 must(api&&!api.killed&&api.exitCode===null,'Isolated API not running');
 const rows=JSON.parse(sql(`SELECT DISTINCT DB_NAME(database_id) AS db,program_name AS app FROM sys.dm_exec_sessions WHERE is_user_process=1 AND host_process_id=${api.pid} FOR JSON PATH;`));
 must(rows.length>0&&rows.every(r=>r.db==='ControlFinancieroDB_Pruebas'&&r.app===run),'API connection scope mismatch');
 record('connection-verified',{pid:api.pid,database:'ControlFinancieroDB_Pruebas'});
}
function raw(method,path,token,body){return new Promise((resolve,reject)=>{
 const bytes=body?Buffer.from(JSON.stringify(body)):null;
 const req=https.request({hostname:'localhost',port:7294,path:'/api'+path,method,rejectUnauthorized:false,headers:{...(token?{Authorization:`Bearer ${token}`} :{}),...(bytes?{'Content-Type':'application/json','Content-Length':bytes.length}:{})}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>{const text=Buffer.concat(chunks).toString();let data=null;if(text&&(res.headers['content-type']||'').includes('json'))data=JSON.parse(text);resolve({status:res.statusCode,data});});});req.on('error',reject);req.setTimeout(30000,()=>req.destroy(new Error('Request timeout')));req.end(bytes);
});}
async function request(method,path,token,body,expected){
 verify();
 if(method!=='GET'&&!path.startsWith('/auth/')){
  const area=path.match(/^\/areas\/(\d+)(?:\/(activar|desactivar))?$/),user=path.match(/^\/usuarios\/(\d+)(?:\/(activar|desactivar|roles|restablecer-password))?$/);
  must((path==='/areas'&&body.nombre.startsWith(run))||(path==='/usuarios'&&body.nombreUsuario.startsWith(run.toLowerCase()))||(area&&areas.includes(+area[1]))||(user&&users.some(u=>u.id===+user[1])),'Non-QA mutation blocked');
 }
 const r=await raw(method,path,token,body);record('http',{method,path,status:r.status,expected});must(r.status===expected,`Unexpected HTTP ${r.status} at ${method} ${path}; expected ${expected}`);return r.data;
}
async function login(username,password){return (await request('POST','/auth/login',null,{username,password},200)).token;}
async function createUser(label,roles,areaId,active=true){
 const username=`${run.toLowerCase()}.${label}`,initial='Aa1!'+randomUUID();
 const made=await request('POST','/usuarios',admin,{nombreUsuario:username,nombreCompleto:`${run} ${label}`,passwordInicial:initial,areaId,roles},201);
 const user={label,id:made.usuario.id,username,roles,areaId,active};users.push(user);save();
 const first=await login(username,initial);await request('POST','/auth/cambiar-password',first,{passwordActual:initial,passwordNueva:qaSecret},200);
 const token=await login(username,qaSecret);if(!active)await request('PUT',`/usuarios/${user.id}/desactivar`,admin,null,200);
 return {...user,token};
}
const cases=[['personal',['PersonalArea']],['jefe',['JefeArea']],['auditor',['Auditor']],['administrador',['Administrador']],['jefe_auditor',['JefeArea','Auditor']],['administrador_jefe',['Administrador','JefeArea']],['administrador_auditor',['Administrador','Auditor']],['personal_jefe',['PersonalArea','JefeArea']]];
let sessions=[];
async function runChecks(){
 must(Number(sql("SELECT COUNT(*) FROM AspNetRoles WHERE Name IN ('Administrador','Auditor','JefeArea','PersonalArea');"))===4,'Existing roles incomplete; no seeding allowed');
 must(Number(sql("SELECT COUNT(*) FROM AspNetUsers WHERE UserName='admin' AND Activo=1;"))===1,'Existing test admin unavailable');
 await new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(7294,'127.0.0.1',()=>s.close(resolve));});
 const env={...process.env};for(const k of Object.keys(env))if(/^(ConnectionStrings|Jwt|AdminInicial|ASPNETCORE_|DOTNET_ENVIRONMENT)/i.test(k))delete env[k];
 Object.assign(env,{ConnectionStrings__DefaultConnection:`Server=localhost;Database=ControlFinancieroDB_Pruebas;Trusted_Connection=True;TrustServerCertificate=True;Application Name=${run}`,Jwt__Key:randomBytes(48).toString('hex'),Jwt__Issuer:run,Jwt__Audience:run,Jwt__ExpirationMinutes:'30',AdminInicial__Username:'admin',AdminInicial__Password:adminSecret,ASPNETCORE_URLS:'https://localhost:7294',ASPNETCORE_ENVIRONMENT:'Production',DOTNET_ENVIRONMENT:'Production',Logging__LogLevel__Default:'None'});
 api=spawn('dotnet',['bin/Release/net9.0/ControlFinanciero.API.dll'],{cwd:new URL('../../backend/ControlFinanciero.API/ControlFinanciero.API/',import.meta.url),env,windowsHide:true,stdio:'ignore'});
 let listening=false;for(let i=0;i<100;i++){must(api.exitCode===null,'API startup exited');listening=await new Promise(r=>{const s=net.connect(7294,'127.0.0.1');s.once('connect',()=>{s.destroy();r(true);});s.once('error',()=>r(false));});if(listening)break;await new Promise(r=>setTimeout(r,100));}must(listening,'API did not listen');verify();
 admin=await login('admin',adminSecret);
 const areaA=await request('POST','/areas',admin,{nombre:run+'_A'},201);areas.push(areaA.areaId);
 const areaB=await request('POST','/areas',admin,{nombre:run+'_B'},201);areas.push(areaB.areaId);
 await request('PUT',`/areas/${areas[1]}`,admin,{nombre:run+'_B_EDITADA'},200);
 await request('PATCH',`/areas/${areas[1]}/desactivar`,admin,null,200);await request('PATCH',`/areas/${areas[1]}/activar`,admin,null,200);
 record('admin-area-management-passed',{areas:[...areas],operations:['crear','modificar','desactivar','activar']});
 for(const[label,roles]of cases)sessions.push(await createUser(label,roles,areas[0]));
 const foreign=await createUser('otra_area',['PersonalArea'],areas[1]);await createUser('inactivo',['PersonalArea'],areas[0],false);
 const expectedIds=users.filter(u=>u.areaId===areas[0]).map(u=>u.id).sort((a,b)=>a-b);
 for(const session of sessions){
  const isAdmin=session.roles.includes('Administrador'),canAreas=isAdmin||session.roles.includes('Auditor'),isJefe=session.roles.includes('JefeArea');
  const catalog=await request('GET','/areas',session.token,null,canAreas?200:403);if(canAreas)must(areas.every(id=>catalog.some(a=>a.areaId===id)),'Catalog missing own QA areas');
  const own=await request('GET','/usuarios/mi-area',session.token,null,isJefe?200:403);
  if(isJefe){must(JSON.stringify(own.map(u=>u.id).sort((a,b)=>a-b))===JSON.stringify(expectedIds),'Wrong own-area scope');must(own.every(u=>Object.keys(u).sort().join(',')==='activo,id,nombreCompleto,roles,userName'),'Sensitive or extra fields');must(own.some(u=>!u.activo),'Inactive users omitted');const manipulated=await request('GET',`/usuarios/mi-area?areaId=${areas[1]}&id=${foreign.id}`,session.token,null,200);must(!manipulated.some(u=>u.id===foreign.id)&&manipulated.length===own.length,'Query parameter escaped area scope');}
  const global=await request('GET','/usuarios',session.token,null,isAdmin?200:403);if(isAdmin)must(global.some(u=>u.id===foreign.id),'Administrator global access regressed');
  if(!isAdmin){
   await request('POST','/areas',session.token,{nombre:run+'_PROHIBIDA'},403);
   await request('PUT',`/areas/${areas[0]}`,session.token,{nombre:run+'_PROHIBIDA'},403);
   await request('PATCH',`/areas/${areas[0]}/desactivar`,session.token,null,403);
   await request('PATCH',`/areas/${areas[0]}/activar`,session.token,null,403);
  }
  if(isJefe&&!isAdmin){
   await request('POST','/usuarios',session.token,{nombreUsuario:run.toLowerCase()+'.prohibido',nombreCompleto:'QA prohibido',passwordInicial:'Aa1!'+randomUUID(),areaId:areas[0],roles:['PersonalArea']},403);
   await request('GET',`/usuarios/${foreign.id}`,session.token,null,403);
   await request('PUT',`/usuarios/${foreign.id}`,session.token,{nombreUsuario:foreign.username,nombreCompleto:'QA no cambiar',areaId:areas[1]},403);
   for(const action of ['activar','desactivar','roles','restablecer-password'])await request('PUT',`/usuarios/${foreign.id}/${action}`,session.token,action==='roles'?{roles:['Auditor']}:action==='restablecer-password'?{passwordNueva:'Aa1!'+randomUUID()}:null,403);
  }
  record('role-case-passed',{label:session.label,roles:session.roles,canAreas,isJefe,globalUsers:isAdmin});
 }
 for(const label of ['personal','jefe','auditor','jefe_auditor','administrador_jefe']){
  const s=sessions.find(u=>u.label===label);await request('GET','/documentos-financieros',s.token,null,200);await request('GET','/registros-financieros',s.token,null,200);
  if(s.roles.includes('Auditor')||s.roles.includes('JefeArea'))await request('GET',`/reportes-financieros/detalle?fechaDesde=2026-11-14&fechaHasta=2026-11-14${s.roles.includes('Auditor')?'&areaId='+areas[0]:''}`,s.token,null,200);
 }
 await request('PATCH',`/areas/${areas[0]}/desactivar`,admin,null,200);
 await request('GET','/usuarios/mi-area',sessions.find(s=>s.label==='jefe').token,null,403);
 await request('GET','/usuarios/mi-area',sessions.find(s=>s.label==='jefe_auditor').token,null,403);
 await request('PATCH',`/areas/${areas[0]}/activar`,admin,null,200);
 must(Number(sql(`SELECT COUNT(*) FROM Areas WHERE Nombre='${run}_PROHIBIDA';`))===0,'Denied area persisted');
 must(Number(sql(`SELECT COUNT(*) FROM AspNetUsers WHERE UserName='${run.toLowerCase()}.prohibido';`))===0,'Denied user persisted');
 record('api-checks-completed',{roleCases:cases.length,areaScopeBySql:sql(`SELECT AreaId,COUNT(*) AS usuarios FROM AspNetUsers WHERE AreaId IN (${areas.join(',')}) GROUP BY AreaId FOR JSON PATH;`)});
 relay=http.createServer((incoming,outgoing)=>{
  const isApi=incoming.url.startsWith('/api/');if(isApi){try{verify();}catch{outgoing.writeHead(503);outgoing.end();return;}}
  const forward=(isApi?https:http).request({hostname:'localhost',port:isApi?7294:4200,path:incoming.url,method:incoming.method,rejectUnauthorized:isApi?false:undefined,headers:{...incoming.headers,host:isApi?'localhost:7294':'localhost:4200'}},response=>{outgoing.writeHead(response.statusCode,response.headers);response.pipe(outgoing);if(isApi)record('browser-http',{path:incoming.url,status:response.statusCode});});forward.on('error',()=>{outgoing.writeHead(502);outgoing.end();});incoming.pipe(forward);
 });await new Promise((resolve,reject)=>{relay.once('error',reject);relay.listen(4307,'127.0.0.1',resolve);});
 console.log(JSON.stringify({readyForBrowser:true,run,users:sessions.map(({label,username,roles})=>({label,username,roles})),browser:'http://localhost:4307/login'}));
}
async function cleanup(){
 for(const user of users.filter(u=>u.active))await request('PUT',`/usuarios/${user.id}/desactivar`,admin,null,200);
 for(const id of areas)await request('PATCH',`/areas/${id}/desactivar`,admin,null,200);
 verify();must(Number(sql(`SELECT COUNT(*) FROM AspNetUsers WHERE Id IN (${users.map(u=>u.id).join(',')}) AND Activo=1;`))===0,'QA users remain active');must(Number(sql(`SELECT COUNT(*) FROM Areas WHERE AreaId IN (${areas.join(',')}) AND Activo=1;`))===0,'QA areas remain active');record('cleanup-passed',{usersInactive:users.length,areasInactive:areas.length});
}
try{console.log('Dos credenciales por entrada oculta: admin y QA.');adminSecret=await input.read();qaSecret=await input.read();await runChecks();while(true){const command=await input.read();if(command==='cleanup'){await cleanup();evidence.passed=true;save();break;}}}
catch(error){failed=true;record('error',{message:error.message});console.log('DETENIDO: '+error.message);process.exitCode=1;}
finally{if(relay?.listening){relay.closeAllConnections();relay.close();}if(api&&!api.killed)api.kill();input.close();admin='';adminSecret='';qaSecret='';sessions=[];record('isolated-process-stopped',{pid:api?.pid,failed});}
