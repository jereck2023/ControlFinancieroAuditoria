// Directed real O6 boundary validation. All credentials/JWT remain only in memory.
import { execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import http from 'node:http';
import { verifyTestDatabase, hiddenLines } from './testing/test-environment.mjs';
import { makeXlsx } from './testing/xlsx-fixture.mjs';
import { xlsxEntries } from './testing/xlsx-inspection.mjs';

const resume=process.argv.find(x=>x.startsWith('--resume='))?.slice(9);
if(resume&&!/^QA_O6_\d{14}$/.test(resume))throw new Error('Invalid resume run');
const run=resume??`QA_O6_${new Date().toISOString().replace(/\D/g,'').slice(0,14)}`;
const directory=new URL(`../docs/evidencias-o6/${run}/`,import.meta.url);
mkdirSync(directory,{recursive:true});
const input=hiddenLines();
let admin='',qa='',adminSecret='',qaSecret='',qaId=0,relay,phase='preflight',originalHash='',usersBefore='',expected=new Map();
const evidence=resume?JSON.parse(readFileSync(new URL('resultado.json',directory),'utf8')):{run,database:'ControlFinancieroDB_Pruebas',areaId:24,originalDocument:12,events:[],imports:[],phase};
function save(){evidence.phase=phase;writeFileSync(new URL('resultado.json',directory),JSON.stringify(evidence,null,2)+'\n');}
function record(type,details){evidence.events.push({utc:new Date().toISOString(),type,...details});save();}
function must(value,message){if(!value)throw new Error(message);}
function sql(query){
  verifyTestDatabase();
  return execFileSync('sqlcmd',['-S','localhost','-E','-d','ControlFinancieroDB_Pruebas','-b','-f','65001','-h','-1','-y','4000','-Q',`SET NOCOUNT ON; ${query}`],{encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024}).trim();
}
function originalDigest(){return sql(`SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',STRING_AGG(CONVERT(nvarchar(max),CONCAT(RegistroFinancieroId,';',TipoOperacion,';',Descripcion,';',CONVERT(varchar(10),FechaOperacion,23),';',Monto,';',AreaId,';',UsuarioId,';',DocumentoFinancieroId,';',CONVERT(varchar(32),RowVersion,2))),N'|') WITHIN GROUP(ORDER BY RegistroFinancieroId)),2) FROM RegistrosFinancieros WHERE DocumentoFinancieroId=12;`);}
function oldUsers(){return sql(`SELECT Id,UserName,Activo,AreaId FROM AspNetUsers WHERE Id IN (1027,1028,1029) ORDER BY Id FOR JSON PATH;`);}
function count(){return Number(sql(`SELECT COUNT(*) FROM RegistrosFinancieros WHERE AreaId=24 AND FechaOperacion='20261112';`));}
async function request(method,path,token,body,expectedStatus){
  verifyTestDatabase();
  if(method!=='GET'){
    const allowed=path.startsWith('/auth/') || (path==='/usuarios'&&body?.areaId===24&&body?.nombreUsuario===run.toLowerCase()+'.operador') ||
      path===`/usuarios/${qaId}/desactivar` || /^\/areas\/24\/(activar|desactivar)$/.test(path) ||
      /^\/registros-financieros\/importar\/(vista-previa|confirmar)$/.test(path) ||
      (path==='/registros-financieros'&&body?.descripcion===`${run} FRONTERA_10001`);
    must(allowed,'Blocked non-QA write');
  }
  const isForm=body instanceof FormData;
  const response=await fetch(`http://localhost:4200/api${path}`,{method,headers:{...(token?{Authorization:`Bearer ${token}`} :{}),...(body&&!isForm?{'Content-Type':'application/json'}:{})},...(body?{body:isForm?body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(90000)});
  const type=response.headers.get('content-type')||'';
  const bytes=Buffer.from(await response.arrayBuffer());
  const data=type.includes('json')?JSON.parse(bytes.toString('utf8')):null;
  record('http',{method,path,status:response.status,message:path.startsWith('/auth/')?undefined:data?.mensaje});
  must(response.status===expectedStatus,`Unexpected HTTP ${response.status} at ${method} ${path}; expected ${expectedStatus}. No retry.`);
  return {data,bytes,status:response.status,type};
}
async function login(username,password){return (await request('POST','/auth/login',null,{username,password},200)).data.token;}
const filter='fechaDesde=2026-11-12&fechaHasta=2026-11-12&areaId=24';
const exportPath=`/reportes-financieros/detalle/exportar?${filter}`;
function multipart(bytes,name,hash){const f=new FormData();f.append('archivo',new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),name);if(hash)f.append('hashArchivo',hash);return f;}
const decode=s=>s.replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n)).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
function checkWorkbook(bytes){
  const files=xlsxEntries(bytes), stripPrefixes=xml=>xml.replace(/(<\/?)[A-Za-z_][\w.-]*:/g,'$1');
  const sheet=stripPrefixes(files.get('xl/worksheets/sheet1.xml')||'');must(sheet,'Missing worksheet');
  const shared=[...stripPrefixes(files.get('xl/sharedStrings.xml')||'').matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map(x=>[...x[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(t=>decode(t[1])).join(''));
  let rows=0;const ids=[];
  for(const match of sheet.matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)){
    if(+match[1]<13)continue;
    const cells={};for(const c of match[2].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)){
      const col=c[1].match(/\br="([A-Z]+)\d+"/)?.[1];const value=c[2].match(/<v>([\s\S]*?)<\/v>/)?.[1];
      cells[col]=/\bt="s"/.test(c[1])?shared[Number(value)]:/\bt="inlineStr"/.test(c[1])?decode(c[2].match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1]||''):value;
    }
    const id=Number(cells.A), item=expected.get(id);must(item,`Unexpected exported ID ${id}`);
    must(Number(cells.B)===(Date.UTC(2026,10,12)/86400000+25569)&&cells.C===item.tipo&&cells.D===item.descripcion&&Number(cells.E).toFixed(2)===Number(item.monto).toFixed(2)&&cells.F==='QA_B2_20261112095714_A'&&cells.G===item.usuario&&cells.H===item.documento,`Exported content mismatch ID ${id}`);
    ids.push(id);rows++;
  }
  must(rows===10000&&new Set(ids).size===10000&&expected.size===10000,`Export count mismatch: rows=${rows}, unique=${new Set(ids).size}, expected=${expected.size}`);
  return {rows,uniqueIds:10000,allFinancialFieldsMatched:true,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
}
function startRelay(){
  relay=http.createServer((incoming,outgoing)=>{
    const options={hostname:'127.0.0.1',port:4200,path:incoming.url,method:incoming.method,headers:{...incoming.headers,host:'localhost:4200'}};
    // Do not inspect, log or persist Authorization, login bodies or tokens.
    const upstream=http.request(options,response=>{
      outgoing.writeHead(response.statusCode,response.headers);
      const isExport=incoming.url?.startsWith('/api/reportes-financieros/detalle/exportar');
      const captured=[];response.on('data',chunk=>{outgoing.write(chunk);if(isExport)captured.push(chunk);});
      response.on('end',()=>{
        outgoing.end();if(isExport){
          const bytes=Buffer.concat(captured);let message;
          if((response.headers['content-type']||'').includes('json')){try{message=JSON.parse(bytes.toString()).mensaje;}catch{message='Unparsed response';}}
          const event={path:incoming.url,status:response.statusCode,bytes:bytes.length,message};
          if(response.statusCode===200){const name=`ui-export-${Date.now()}.xlsx`;writeFileSync(new URL(name,directory),bytes);event.file=name;}
          record('browser-real-export',event);
        }
      });
    });
    upstream.on('error',()=>{outgoing.writeHead(502);outgoing.end();record('relay-error',{message:'Real upstream connection error; no request retry'});});
    incoming.pipe(upstream);
  });
  return new Promise((resolve,reject)=>{relay.once('error',reject);relay.listen(4306,'127.0.0.1',resolve);});
}
async function prepare(){
  must(sql(`SELECT CONCAT(Nombre,'|',Activo) FROM Areas WHERE AreaId=24;`)==='QA_B2_20261112095714_A|0','Area 24 identity/state changed');
  must(Number(sql(`SELECT COUNT(*) FROM AspNetUsers WHERE AreaId=24 AND (UserName NOT LIKE 'qa_b2_20261112095714.%' OR Activo=1);`))===0,'Area has unrelated or active users');
  must(Number(sql(`SELECT COUNT(*) FROM RegistrosFinancieros WHERE AreaId=24 AND (DocumentoFinancieroId IS NULL OR DocumentoFinancieroId<>12 OR FechaOperacion<>'20261112' OR Descripcion NOT LIKE 'QA_B2_20261112095714 O5 FILA[_]%');`))===0&&count()===500,'Unexpected original data');
  const originals=sql(`SELECT CONCAT(r.RegistroFinancieroId,CHAR(9),r.TipoOperacion,CHAR(9),r.Descripcion,CHAR(9),r.Monto,CHAR(9),u.NombreCompleto,CHAR(9),d.NombreArchivo) FROM RegistrosFinancieros r JOIN AspNetUsers u ON u.Id=r.UsuarioId JOIN DocumentosFinancieros d ON d.DocumentoFinancieroId=r.DocumentoFinancieroId WHERE r.AreaId=24 ORDER BY r.RegistroFinancieroId;`);
  for(const line of originals.split(/\r?\n/)){const [id,tipo,descripcion,monto,usuario,documento]=line.trim().split('\t');expected.set(Number(id),{tipo,descripcion,monto,usuario,documento});}
  must(expected.size===500,'Expected 500 originals');originalHash=originalDigest();usersBefore=oldUsers();
  record('baseline',{originalOperations:500,originalDigest:originalHash,oldUsers:JSON.parse(usersBefore),areaInitiallyInactive:true});
  phase='prepare';save();
  admin=await login('admin',adminSecret);
  await request('PATCH','/areas/24/activar',admin,null,200);
  const initial=`Aa1!${randomUUID()}`, username=run.toLowerCase()+'.operador';
  const created=await request('POST','/usuarios',admin,{nombreUsuario:username,nombreCompleto:`${run} operador`,passwordInicial:initial,areaId:24,roles:['PersonalArea','Auditor']},201);
  qaId=created.data.usuario.id;evidence.qaId=qaId;evidence.username=username;save();
  const first=await login(username,initial);
  await request('POST','/auth/cambiar-password',first,{passwordActual:initial,passwordNueva:qaSecret},200);
  qa=await login(username,qaSecret);
  for(let batch=0;batch<19;batch++){
    const rows=Array.from({length:500},(_,j)=>[j%2===0?'Ingreso':'Egreso',`${run} FILA_${String(batch*500+j+1).padStart(5,'0')}`,'12/11/2026',1]);
    const filename=`${run}_${String(batch+1).padStart(2,'0')}.xlsx`, bytes=makeXlsx(rows);
    must(bytes.length<2*1024*1024,'Fixture exceeds 2 MiB');writeFileSync(new URL(filename,directory),bytes);
    const preview=await request('POST','/registros-financieros/importar/vista-previa',qa,multipart(bytes,filename),200);
    must(preview.data.esValido===true&&preview.data.totalFilas===500&&preview.data.errores.length===0,'Invalid preview; no confirmation attempted');
    const imported=await request('POST','/registros-financieros/importar/confirmar',qa,multipart(bytes,filename,preview.data.hashArchivo),200);
    must(imported.data.totalImportados===500&&imported.data.registrosIds.length===500,'Unexpected persisted import count');
    const documentId=imported.data.documentoFinancieroId;
    imported.data.registrosIds.forEach((id,j)=>{must(!expected.has(id),'Duplicate imported ID');expected.set(id,{tipo:rows[j][0],descripcion:rows[j][1],monto:1,usuario:`${run} operador`,documento:filename});});
    must(Number(sql(`SELECT COUNT(*) FROM RegistrosFinancieros WHERE DocumentoFinancieroId=${documentId} AND AreaId=24 AND UsuarioId=${qaId} AND Descripcion LIKE '${run} FILA[_]%' AND Monto=1 AND FechaOperacion='20261112';`))===500,'SQL import mismatch');
    must(Number(sql(`SELECT COUNT(*) FROM HistorialesAuditoria h JOIN RegistrosFinancieros r ON r.RegistroFinancieroId=h.RegistroFinancieroId WHERE r.DocumentoFinancieroId=${documentId} AND h.TipoAccion='Creacion';`))===500,'Missing creation audit');
    evidence.imports.push({batch:batch+1,documentId,filename,rows:500,hash:preview.data.hashArchivo,firstId:imported.data.registrosIds[0],lastId:imported.data.registrosIds.at(-1)});save();
    console.log(`O6 importacion ${batch+1}/19 acreditada; acumulado ${500+(batch+1)*500}.`);
  }
  await boundaries();
}
async function resumePrepared(){
  must(evidence.run===run&&evidence.imports.length===19&&!evidence.extraRecord,'Resume requires exactly 19 completed imports and no extra record');
  qaId=evidence.qaId;must(Number.isInteger(qaId)&&evidence.username===run.toLowerCase()+'.operador','Wrong QA account');
  const baseline=evidence.events.find(x=>x.type==='baseline');must(baseline,'Missing original baseline');
  originalHash=baseline.originalDigest;usersBefore=JSON.stringify(baseline.oldUsers);
  must(sql(`SELECT CONCAT(Nombre,'|',Activo) FROM Areas WHERE AreaId=24;`)==='QA_B2_20261112095714_A|1','Unexpected area state');
  must(count()===10000&&originalDigest()===originalHash&&oldUsers()===usersBefore,'Prepared scope changed');
  const lines=sql(`SELECT CONCAT(r.RegistroFinancieroId,CHAR(9),r.TipoOperacion,CHAR(9),r.Descripcion,CHAR(9),r.Monto,CHAR(9),u.NombreCompleto,CHAR(9),d.NombreArchivo) FROM RegistrosFinancieros r JOIN AspNetUsers u ON u.Id=r.UsuarioId JOIN DocumentosFinancieros d ON d.DocumentoFinancieroId=r.DocumentoFinancieroId WHERE r.AreaId=24 AND r.FechaOperacion='20261112' ORDER BY r.RegistroFinancieroId;`);
  for(const line of lines.split(/\r?\n/)){const[id,tipo,descripcion,monto,usuario,documento]=line.trim().split('\t');must(descripcion.startsWith(run)||descripcion.startsWith('QA_B2_20261112095714 O5 FILA_'),'Unrelated row in prepared scope');expected.set(Number(id),{tipo,descripcion,monto,usuario,documento});}
  must(expected.size===10000,'Cannot reconstruct exact expected set');
  admin=await login('admin',adminSecret);qa=await login(evidence.username,qaSecret);
  record('resume-without-reimport',{originalImports:19,existingOperations:10000,parserCorrection:'Namespace-prefixed XML tags supported; no production/frontend/backend change'});
  await boundaries();
}
async function boundaries(){
  must(count()===10000&&originalDigest()===originalHash&&oldUsers()===usersBefore,'10000 scope or original data changed');
  const exported=await request('GET',exportPath,qa,null,200);must(exported.type.includes('spreadsheetml'),'Wrong export MIME');
  writeFileSync(new URL('detalle-10000.xlsx',directory),exported.bytes);
  const proof=checkWorkbook(exported.bytes);record('boundary-10000-passed',{http:200,...proof});
  const extra=await request('POST','/registros-financieros',qa,{tipoOperacion:'Ingreso',descripcion:`${run} FRONTERA_10001`,fechaOperacion:'2026-11-12',monto:1},201);
  evidence.extraRecord=extra.data?.registroId??null;must(Number.isInteger(evidence.extraRecord),'Missing extra record ID');
  must(count()===10001&&originalDigest()===originalHash,'10001 scope or original data changed');
  const rejected=await request('GET',exportPath,qa,null,400);
  must(rejected.data?.mensaje==='La exportación supera el límite de 10000 operaciones. Reduzca el período o los filtros.','Wrong rejection message');
  record('boundary-10001-passed',{http:400,message:rejected.data.mensaje,originalDigestUnchanged:true});
  must(Number(sql(`SELECT COUNT(*) FROM BitacorasActividades WHERE UsuarioId=${qaId} AND TipoActividad='ImportacionExcel' AND Resultado='Exitoso';`))===19,'Missing import activities');
  await startRelay();phase='await-browser';save();
  console.log(JSON.stringify({run,username:evidence.username,qaId,areaId:24,operations:10001,browser:'http://localhost:4306/login',evidence:new URL('resultado.json',directory).pathname}));
}
async function cleanup(){
  must(evidence.events.some(x=>x.type==='browser-real-export'&&x.status===400)&&evidence.events.some(x=>x.type==='browser-real-export'&&x.status===200&&x.path.includes('tipoOperacion=Egreso')),'UI export/recovery HTTP evidence missing');
  must(originalDigest()===originalHash&&oldUsers()===usersBefore,'Original records/accounts changed');
  await request('PUT',`/usuarios/${qaId}/desactivar`,admin,null,200);
  await request('PATCH','/areas/24/desactivar',admin,null,200);
  must(sql('SELECT Activo FROM Areas WHERE AreaId=24;')==='0','Area not restored inactive');
  must(sql(`SELECT Activo FROM AspNetUsers WHERE Id=${qaId};`)==='0','QA user not inactive');
  const result={totalOperations:count(),newOperations:9501,documentsRetained:19,creationAudit:Number(sql(`SELECT COUNT(*) FROM HistorialesAuditoria WHERE UsuarioId=${qaId} AND TipoAccion='Creacion';`)),importActivities:19,originalHashUnchanged:originalDigest()===originalHash,oldUsersUnchanged:oldUsers()===usersBefore,areaInactive:true,qaInactive:true};
  must(result.creationAudit===9501&&result.totalOperations===10001,'Final trace count mismatch');
  phase='completed';record('cleanup-and-trace-passed',result);evidence.passed=true;save();relay.closeAllConnections();await new Promise(r=>relay.close(r));
  console.log('O6: evidencia API/SQL y restauracion QA completadas.');
}
try{
  console.log('Esperando dos credenciales por entrada oculta; no se guardan ni muestran.');
  adminSecret=await input.read();qaSecret=await input.read();if(resume)await resumePrepared();else await prepare();
  while(true){const command=await input.read();if(command==='cleanup'){await cleanup();break;}if(command==='status')console.log(JSON.stringify({phase,run,qaId,imports:evidence.imports.length,uiExports:evidence.events.filter(x=>x.type==='browser-real-export')}));}
}catch(error){phase='stopped-on-error';record('preparation-or-test-error',{message:error.message});console.log('O6 DETENIDA: '+error.message+'; no nuevas escrituras ni reintentos automaticos.');process.exitCode=1;}
finally{if(relay?.listening){relay.closeAllConnections();relay.close();}input.close();admin='';qa='';adminSecret='';qaSecret='';}
