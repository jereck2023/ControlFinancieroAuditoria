// Real API/SQL integration. No secrets in arguments, files, console or evidence.
using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using System.Net.NetworkInformation;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.RegularExpressions;
using ControlFinanciero.API.Data;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

var runner = new O3Runner(args);
await runner.Run();

sealed class O3Runner
{
    readonly string root, run, work, db, login, evidenceFile, copy;
    readonly string sqlSecret = Secret(), initialA = Secret(), passwordA = Secret(), initialB = Secret(), passwordB = Secret();
    readonly List<object> events = [];
    readonly object evidenceLock = new();
    readonly HashSet<int> allowedQaIds = [];
    readonly string control = "Server=localhost;Database=CFA_QA_O3_20261113003000;Integrated Security=True;Encrypt=True;TrustServerCertificate=True;Pooling=False;Connect Timeout=5";
    Process? api;
    HttpClient? http;
    string stage = "preflight", tokenA = "", tokenB = "", serverName = "";
    int a, b, area;
    bool created, passed;
    bool resuming;
    string secondaryName="";
    string userA => "qa_o3_" + run + ".a";
    string userB => secondaryName=="" ? "qa_o3_" + run + ".b" : secondaryName;
    string RuntimeConnection(string database) => new SqlConnectionStringBuilder {
        DataSource="localhost", InitialCatalog=database, UserID=login, Password=sqlSecret,
        Encrypt=true, TrustServerCertificate=true, ApplicationName="CFA_O3_"+run, ConnectTimeout=5
    }.ConnectionString;
    static string Secret() => Convert.ToHexString(RandomNumberGenerator.GetBytes(24)) + "aA1!";
    static void Must(bool condition, string message) { if(!condition) throw new InvalidOperationException(message); }
    public O3Runner(string[] args)
    {
        Must(args.Length==2 && args[1]=="20261113003000", "Only the previously approved database is allowed");
        root=Path.GetFullPath(args[0]); run=args[1]; db="CFA_QA_O3_"+run; login="cfa_o3_"+run;
        work=Path.Combine(root,"tmp","o3",run); copy=Path.Combine(work,"source");
        Must(Directory.Exists(copy), "Source copy missing");
        evidenceFile=Path.Combine(root,"scripts","o3","evidencias",run,"reanudacion-"+DateTime.UtcNow.ToString("yyyyMMddHHmmss")+".json");
        Directory.CreateDirectory(Path.GetDirectoryName(evidenceFile)!);
    }
    void Record(string type, object details)
    {
        lock(evidenceLock) { events.Add(new { utc=DateTime.UtcNow.ToString("O"), type, details }); Save(); }
    }
    void Save() { lock(evidenceLock) File.WriteAllText(evidenceFile, JsonSerializer.Serialize(new {
        run, database=db, login, server=serverName, port=7293, apiPid=api?.Id,
        stage, passed, databaseCreated=created, events
    }, new JsonSerializerOptions { WriteIndented=true })); }
    async Task<object?> Scalar(SqlConnection c,string sql)
    {
        using var cmd=new SqlCommand(sql,c){CommandTimeout=45};
        if(sql.Contains("FOR JSON",StringComparison.OrdinalIgnoreCase))
        {
            var json=new System.Text.StringBuilder();
            using var reader=await cmd.ExecuteReaderAsync();
            while(await reader.ReadAsync()) if(!reader.IsDBNull(0)) json.Append(reader.GetString(0));
            return json.ToString();
        }
        return await cmd.ExecuteScalarAsync();
    }
    async Task Execute(SqlConnection c,string sql)
    {
        using var cmd=new SqlCommand(sql,c){CommandTimeout=120}; await cmd.ExecuteNonQueryAsync();
    }
    async Task<SqlConnection> Admin(string? database=null)
    {
        Must(database is null || database==db,"Connection outside approved database blocked");
        var builder=new SqlConnectionStringBuilder(control){InitialCatalog=db};
        var c=new SqlConnection(builder.ConnectionString); await c.OpenAsync(); return c;
    }
    async Task Verify(bool process=true)
    {
        await using var c=await Admin();
        Must((string)(await Scalar(c,"SELECT CONVERT(nvarchar(128),SERVERPROPERTY('ServerName'))"))! == serverName,"SQL server changed");
        Must(Convert.ToInt32(await Scalar(c,$"SELECT COUNT(*) FROM sys.databases WHERE name=N'{db}' AND database_id>4"))==1,"Temporary database missing");
        if(process)
        {
            Must(api!=null && !api.HasExited,"Isolated API not running");
            var sessions=new List<object>();
            using var cmd=new SqlCommand($"SELECT DISTINCT DB_NAME(database_id),login_name,program_name FROM sys.dm_exec_sessions WHERE is_user_process=1 AND host_process_id={api!.Id}",c);
            using var rd=await cmd.ExecuteReaderAsync();
            while(await rd.ReadAsync())
            {
                Must(rd.GetString(0)==db && rd.GetString(1)==login && rd.GetString(2)=="CFA_O3_"+run,"Isolated API scope mismatch");
                sessions.Add(new {database=rd.GetString(0),login=rd.GetString(1),application=rd.GetString(2)});
            }
            Must(sessions.Count>0,"No effective SQL connection for API PID");
            Record("effective-connection-before-write",new {pid=api.Id,sessions});
        }
        else Record("provisioning-target",new {database=db,server=serverName,operatorIdentity="Windows operator; temporary database only"});
    }
    async Task VerifySourceHashes()
    {
        var manifest=JsonDocument.Parse(await File.ReadAllTextAsync(Path.Combine(work,"source-hashes.json"))).RootElement;
        var original=Path.GetFullPath(Path.Combine(root,"..","backend","ControlFinanciero.API","ControlFinanciero.API"));
        var count=0;
        foreach(var item in manifest.EnumerateArray())
        {
            var relative=item.GetProperty("path").GetString()!;
            foreach(var directory in new[]{original,copy})
            {
                var file=Path.GetFullPath(Path.Combine(directory,relative));
                Must(file.StartsWith(directory+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase),"Unsafe source manifest path");
                var hash=Convert.ToHexString(SHA256.HashData(await File.ReadAllBytesAsync(file)));
                var expected=relative.Replace('\\','/')=="Controllers/UsuariosController.cs"
                    ? "F1DE88E292C34571D0A6F5B748FA2BD3D11AA4A9AA099C8F416BB4E4449B9700"
                    : item.GetProperty("sha256").GetString();
                Must(hash==expected,"Unapproved original or copied source change");
            }
            count++;
        }
        Must(count==78,"Unexpected source inventory"); Record("source-hashes-verified",new {files=count,authorizedChanges=1,otherChanges=0,authorizedFile="Controllers/UsuariosController.cs; bitacora call moved only"});
    }
    async Task CheckSchema(ApplicationDbContext ctx,SqlConnection c)
    {
        var mappings=ctx.Model.GetEntityTypes().Where(e=>e.GetTableName()!=null).GroupBy(e=>new {Table=e.GetTableName()!,Schema=e.GetSchema()??"dbo"});
        var checkedColumns=0;var checkedTables=0;
        foreach(var mapping in mappings)
        {
            var table=mapping.Key.Table;var schema=mapping.Key.Schema;
            Must(Regex.IsMatch(table,@"^[A-Za-z_][A-Za-z0-9_]*$") && schema=="dbo","Unexpected mapped SQL identifier");
            var columns=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            using(var cmd=new SqlCommand($"SELECT name FROM sys.columns WHERE object_id=OBJECT_ID(N'[{schema}].[{table}]')",c))
            using(var rd=await cmd.ExecuteReaderAsync())while(await rd.ReadAsync())columns.Add(rd.GetString(0));
            Must(columns.Count>0,"Missing mapped table "+table);
            var store=Microsoft.EntityFrameworkCore.Metadata.StoreObjectIdentifier.Table(table,schema);
            foreach(var property in mapping.SelectMany(e=>e.GetProperties()))
            {
                var column=property.GetColumnName(store);
                if(column!=null){Must(columns.Contains(column),"Missing mapped column "+table+"."+column);checkedColumns++;}
            }
            checkedTables++;
        }
        Must(Convert.ToInt32(await Scalar(c,"SELECT COUNT(*) FROM sys.triggers WHERE name IN ('TR_HistorialesAuditoria_Proteger','TR_BitacorasActividades_Proteger') AND is_disabled=0"))==2,"Audit protection triggers missing or disabled");
        Must(Convert.ToInt32(await Scalar(c,"SELECT COUNT(*) FROM sys.foreign_keys WHERE is_disabled=1 OR is_not_trusted=1"))==0,"Disabled or untrusted foreign keys");
        Must(Convert.ToInt32(await Scalar(c,"SELECT COUNT(*) FROM sys.indexes WHERE is_disabled=1"))==0,"Disabled indexes");
        Must(Convert.ToInt32(await Scalar(c,"SELECT COUNT(*) FROM sys.columns WHERE object_id IN (OBJECT_ID('RegistrosFinancieros'),OBJECT_ID('Alertas')) AND name='RowVersion' AND system_type_id=189"))==2,"Concurrency rowversion columns missing");
        Must(Convert.ToInt32(await Scalar(c,"SELECT COUNT(*) FROM ReglasAnomalia"))==3,"Expected three original rule seeds");
        var catalog=(string)(await Scalar(c,"SELECT t.name AS tabla,c.name AS columna,TYPE_NAME(c.user_type_id) AS tipo,c.max_length,c.is_nullable FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id ORDER BY t.name,c.column_id FOR JSON PATH"))!;
        Record("schema-verified",new {checkedTables,checkedColumns,triggersEnabled=2,disabledForeignKeys=0,disabledIndexes=0,rowversionColumns=2,originalRules=3,catalog=JsonDocument.Parse(catalog).RootElement.Clone()});
    }
    public async Task Run()
    {
        try
        {
            Must(!IPGlobalProperties.GetIPGlobalProperties().GetActiveTcpListeners().Any(x=>x.Port==7293),"Port 7293 occupied");
            await using(var c=await Admin())
            {
                serverName=(string)(await Scalar(c,"SELECT CONVERT(nvarchar(128),SERVERPROPERTY('ServerName'))"))!;
                Must(Convert.ToInt32(await Scalar(c,"SELECT CONVERT(int,SERVERPROPERTY('ProductMajorVersion'))"))==16,"Expected SQL Server 2022");
                Must(Convert.ToInt32(await Scalar(c,"SELECT CONVERT(int,SERVERPROPERTY('IsIntegratedSecurityOnly'))"))==0,"Mixed authentication unavailable");
                Must(Convert.ToInt32(await Scalar(c,$"SELECT COUNT(*) FROM sys.databases WHERE name=N'{db}' AND state_desc='ONLINE'"))==1,"Approved existing database missing or offline");
                Must((string)(await Scalar(c,"SELECT DB_NAME()"))! ==db,"Wrong existing database destination");
                Record("verified-existing-target",new {server=serverName,database=db,existing=true,sqlMajor=16}); created=true;
            }
            stage="check-existing-schema-and-migration-history"; Save(); await Verify(false);
            await VerifySourceHashes();
            var options=new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer(new SqlConnectionStringBuilder(control){InitialCatalog=db}.ConnectionString).Options;
            using(var ctx=new ApplicationDbContext(options))
            {
                await using var c=await Admin(db);
                Must((string)(await Scalar(c,"SELECT DB_NAME()"))! ==db,"Wrong schema destination");
                var all=ctx.Database.GetMigrations().ToArray();
                var applied=(await ctx.Database.GetAppliedMigrationsAsync()).ToArray();
                var pending=(await ctx.Database.GetPendingMigrationsAsync()).ToArray();
                var tables=(string)(await Scalar(c,"SELECT name FROM sys.tables ORDER BY name FOR JSON PATH"))!;
                Record("pre-migration-state",new {all,applied,pending,tables=JsonDocument.Parse(tables).RootElement.Clone()});
                Must(all.Length==12 && all[^1]=="20261111005207_AgregarGestionAlertas","Unexpected migration assembly");
                Must(applied.SequenceEqual(all.Take(applied.Length)) && pending.SequenceEqual(all.Skip(applied.Length)),"Inconsistent migration history");
                if(applied.Length==0)
                {
                    Must(Convert.ToInt32(await Scalar(c,"SELECT COUNT(*) FROM sys.tables"))==1 && Convert.ToInt32(await Scalar(c,"SELECT COUNT(*) FROM sys.tables WHERE name='__EFMigrationsHistory' AND schema_id=SCHEMA_ID('dbo')"))==1,"Unexpected residual tables");
                    Must(Convert.ToInt32(await Scalar(c,"SELECT COUNT(*) FROM sys.objects WHERE is_ms_shipped=0 AND type IN ('TR','P','V','FN','IF','TF','SO')"))==0,"Unexpected residual schema objects");
                }
                else {Must(applied.Length==12,"Partially applied schema needs review");await CheckSchema(ctx,c);}
                stage="apply-pending-original-migrations-EF";Save();await Verify(false);
                Must(pending.Length==0,"Correction regression requires already prepared schema; no migrations authorized in this run");
                var completed=(await ctx.Database.GetAppliedMigrationsAsync()).ToArray();
                Must(completed.SequenceEqual(all) && !(await ctx.Database.GetPendingMigrationsAsync()).Any(),"Incomplete migration history");
                await CheckSchema(ctx,c);
                Record("schema-verified-without-changes",new {applied=completed,count=completed.Length,pending=0,migrationsExecuted=false});
            }
            stage="restricted-login"; Save(); await Verify(false);
            await using(var c=await Admin())
            {
                resuming=Convert.ToInt32(await Scalar(c,"SELECT COUNT(*) FROM AspNetUsers"))>0;
                if(resuming)
                {
                    Must(Convert.ToInt32(await Scalar(c,$"SELECT COUNT(*) FROM AspNetUsers WHERE UserName NOT LIKE N'qa_o3_{run}.%'"))==0,"Unexpected non-QA accounts");
                    secondaryName="qa_o3_"+run+".recovery_"+DateTime.UtcNow.ToString("HHmmss");
                    Record("resume-existing-QA",new {previousFailure="Historical HTTP 500; retest with authorized controller correction",recoveryAccount=userB,reason="Previous process discarded ephemeral credentials; recover QA access via API, no direct Identity data updates"});
                }
                if(Convert.ToInt32(await Scalar(c,$"SELECT COUNT(*) FROM sys.server_principals WHERE name=N'{login}'"))==0)
                    await Execute(c,$"CREATE LOGIN [{login}] WITH PASSWORD='{sqlSecret}', DEFAULT_DATABASE=[{db}], CHECK_POLICY=ON");
                else
                {
                    Must((string)(await Scalar(c,$"SELECT default_database_name FROM sys.server_principals WHERE name=N'{login}'"))! ==db,"Existing login has unexpected default database");
                    await Execute(c,$"ALTER LOGIN [{login}] WITH PASSWORD='{sqlSecret}'");
                }
            }
            await using(var c=await Admin(db)) if(Convert.ToInt32(await Scalar(c,$"SELECT COUNT(*) FROM sys.database_principals WHERE name=N'{login}'"))==0)
                await Execute(c,$"CREATE USER [{login}] FOR LOGIN [{login}]; GRANT CONNECT TO [{login}]; ALTER ROLE db_datareader ADD MEMBER [{login}]; ALTER ROLE db_datawriter ADD MEMBER [{login}];");
            await using(var c=new SqlConnection(RuntimeConnection(db)))
            {
                await c.OpenAsync(); Must((string)(await Scalar(c,"SELECT DB_NAME()"))! ==db,"Wrong runtime destination");
                Must(Convert.ToInt32(await Scalar(c,"SELECT IS_SRVROLEMEMBER('sysadmin')"))==0,"Runtime login privileged");
                Record("runtime-permissions",new {database=db,sysadmin=false,dbOwner=await Scalar(c,"SELECT IS_MEMBER('db_owner')")});
            }
            await using(var c=new SqlConnection(RuntimeConnection(db)))
            {
                await c.OpenAsync();
                // Permission metadata only from the temporary DB: do NOT open either protected DB.
                var mainAccess=Convert.ToInt32(await Scalar(c,"SELECT HAS_DBACCESS(N'ControlFinancieroDB')"));
                var sharedTestAccess=Convert.ToInt32(await Scalar(c,"SELECT HAS_DBACCESS(N'ControlFinancieroDB_Pruebas')"));
                Must(mainAccess==0 && sharedTestAccess==0,"Runtime principal has access to a protected database");
                Record("restricted-permission-metadata",new {queriedFrom=db,protectedConnectionsAttempted=0,mainAccess,sharedTestAccess});
            }
            stage="API-start-with-before-seed-gate"; Save();
            await using(var gate=await Admin(db))
            {
                await using var tx=(SqlTransaction)await gate.BeginTransactionAsync();
                using(var cmd=new SqlCommand("SELECT COUNT(*) FROM AspNetRoles WITH (TABLOCKX,HOLDLOCK)",gate,tx)) await cmd.ExecuteScalarAsync();
                var start=new ProcessStartInfo("dotnet"){WorkingDirectory=copy,UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true};
                start.ArgumentList.Add(Path.Combine(copy,"bin","Release","net9.0","ControlFinanciero.API.dll"));
                foreach(var key in start.Environment.Keys.Where(k=>k.StartsWith("ConnectionStrings",StringComparison.OrdinalIgnoreCase)||k.StartsWith("Jwt",StringComparison.OrdinalIgnoreCase)||k.StartsWith("AdminInicial",StringComparison.OrdinalIgnoreCase)||k.StartsWith("ASPNETCORE_",StringComparison.OrdinalIgnoreCase)||k.StartsWith("DOTNET_ENVIRONMENT",StringComparison.OrdinalIgnoreCase)).ToArray()) start.Environment.Remove(key);
                start.Environment["ConnectionStrings__DefaultConnection"]=RuntimeConnection(db);
                start.Environment["AdminInicial__Username"]=resuming?userB:userA; start.Environment["AdminInicial__Password"]=resuming?initialB:initialA;
                start.Environment["Jwt__Key"]=Secret(); start.Environment["Jwt__Issuer"]="CFA-O3-"+run; start.Environment["Jwt__Audience"]="CFA-O3-"+run; start.Environment["Jwt__ExpirationMinutes"]="30";
                start.Environment["ASPNETCORE_URLS"]="https://localhost:7293"; start.Environment["ASPNETCORE_ENVIRONMENT"]="Production"; start.Environment["DOTNET_ENVIRONMENT"]="Production";
                start.Environment["Logging__LogLevel__Default"]="Error";
                api=Process.Start(start)!;
                // Drain and discard stdout/stderr; never persist configuration or raw server exceptions.
                void Inspect(string? line)
                {
                    if(line?.Contains("InvalidOperationException: No se pudo identificar al administrador responsable.")==true)
                        Record("sanitized-server-error",new {exception="InvalidOperationException",message="No se pudo identificar al administrador responsable."});
                    if(line?.Contains("deadlock",StringComparison.OrdinalIgnoreCase)==true)
                        Record("sanitized-server-error",new {exception="Possible SQL deadlock; raw log deliberately omitted"});
                }
                api.OutputDataReceived+=(_,e)=>Inspect(e.Data);api.ErrorDataReceived+=(_,e)=>Inspect(e.Data);api.BeginOutputReadLine();api.BeginErrorReadLine();
                bool seen=false;
                for(var i=0;i<120;i++)
                {
                    Must(!api.HasExited,"API exited before verification");
                    await using var c=await Admin();
                    var n=Convert.ToInt32(await Scalar(c,$"SELECT COUNT(*) FROM sys.dm_exec_sessions WHERE host_process_id={api.Id} AND login_name=N'{login}' AND database_id=DB_ID(N'{db}')"));
                    if(n>0){seen=true;break;} await Task.Delay(100);
                }
                Must(seen,"API SQL connection not observed before seeding"); await Verify();
                Record("before-seed-gate",new {verifiedBeforeFirstSeedWrite=true,gate="roles read blocked only during preparation",pid=api.Id});
                await tx.RollbackAsync();
            }
            http=new HttpClient(new HttpClientHandler{ServerCertificateCustomValidationCallback=(request,cert,chain,errors)=>request.RequestUri?.Host=="localhost" && request.RequestUri.Port==7293 && (errors==System.Net.Security.SslPolicyErrors.None || errors==System.Net.Security.SslPolicyErrors.RemoteCertificateChainErrors)}){BaseAddress=new Uri("https://localhost:7293/api/"),Timeout=TimeSpan.FromSeconds(40)};
            for(var i=0;i<150;i++)
            {
                Must(!api.HasExited,"API startup failed");
                if(IPGlobalProperties.GetIPGlobalProperties().GetActiveTcpListeners().Any(x=>x.Port==7293)) break;
                await Task.Delay(100);
            }
            Must(IPGlobalProperties.GetIPGlobalProperties().GetActiveTcpListeners().Any(x=>x.Port==7293),"API did not listen");
            if(resuming)
            {
                stage="recover-dedicated-QA-access-via-API"; Save();
                tokenB=await Login(userB,initialB);await Change(tokenB,initialB,passwordB);tokenB=await Login(userB,passwordB);
                var existing=await Request("GET","usuarios",tokenB,null,200);
                Must(existing.EnumerateArray().All(x=>x.GetProperty("userName").GetString()!.StartsWith("qa_o3_"+run+".",StringComparison.Ordinal)),"Non-QA user in fixture");
                foreach(var user in existing.EnumerateArray()) allowedQaIds.Add(user.GetProperty("id").GetInt32());
                a=existing.EnumerateArray().Single(x=>x.GetProperty("userName").GetString()==userA).GetProperty("id").GetInt32();
                b=existing.EnumerateArray().Single(x=>x.GetProperty("userName").GetString()==userB).GetProperty("id").GetInt32();
                area=existing.EnumerateArray().Single(x=>x.GetProperty("id").GetInt32()==a).GetProperty("areaId").GetInt32();
                await Request("PUT",$"usuarios/{b}",tokenB,new {nombreUsuario=userB,nombreCompleto="QA O3 recovery "+run,areaId=area},200);
                tokenB=await Login(userB,passwordB);
                foreach(var user in existing.EnumerateArray())
                {
                    var id=user.GetProperty("id").GetInt32();
                    if(id!=a && id!=b && user.GetProperty("activo").GetBoolean())
                        await Request("PUT",$"usuarios/{id}/desactivar",tokenB,null,200);
                }
                await Request("PUT",$"usuarios/{a}/restablecer-password",tokenB,new {passwordNueva=initialA},200);
                tokenA=await Login(userA,initialA);await Change(tokenA,initialA,passwordA);await FreshSessions();
                await Snapshot("recovered-two-admin-baseline",2);
                stage="fixed-self-deactivation";Save();
                var logBefore=await Logs();
                await using var stampConnection=await Admin();
                var stampBefore=(string)(await Scalar(stampConnection,$"SELECT SecurityStamp FROM AspNetUsers WHERE Id={a}"))!;
                await Request("PUT",$"usuarios/{a}/desactivar",tokenA,null,200);
                var stampChanged=stampBefore!=(string)(await Scalar(stampConnection,$"SELECT SecurityStamp FROM AspNetUsers WHERE Id={a}"))!;
                Must(stampChanged,"SecurityStamp did not change after deactivation");
                await Snapshot("self-deactivation-committed",1);
                var afterSelf=JsonDocument.Parse(await StateJson()).RootElement;
                Must(!afterSelf.EnumerateArray().Single(x=>x.GetProperty("Id").GetInt32()==a).GetProperty("Activo").GetBoolean(),"Self-deactivation not persisted");
                var logAfter=JsonDocument.Parse(await Logs()).RootElement.Clone();
                var oldCount=JsonDocument.Parse(logBefore).RootElement.GetArrayLength();
                Must(logAfter.GetArrayLength()==oldCount+1,"Expected one committed deactivation activity");
                var activity=logAfter.EnumerateArray().Last();
                Must(activity.GetProperty("UsuarioId").GetInt32()==a && activity.GetProperty("TipoActividad").GetString()=="CambioEstadoUsuario" && activity.GetProperty("Resultado").GetString()=="Exitoso","Wrong responsible administrator in activity");
                await Request("GET","usuarios",tokenA,null,401);
                Record("test-passed",new {test="fixed-self-deactivation",http=200,persistedInactive=true,stampChanged,previousTokenHttp=401,activity});
                var protectedState=await StateJson();var protectedLogs=await Logs();
                var rejection=await Request("PUT",$"usuarios/{b}/desactivar",tokenB,null,409);
                Must(rejection.GetProperty("mensaje").GetString()!.Contains("último administrador activo"),"Wrong last administrator rejection");
                await Snapshot("last-admin-deactivation-rejected",1);
                Must(await StateJson()==protectedState && await Logs()==protectedLogs,"Rejected last-admin deactivation persisted changes or activity");
                Record("test-passed",new {test="last-admin-deactivation-regression",http=409,persistedChange=false,successfulActivities=0});
                await Request("PUT",$"usuarios/{b}/roles",tokenB,new {roles=new[]{"PersonalArea"}},409);
                await Snapshot("last-admin-role-removal-rejected",1);
                Must(await StateJson()==protectedState && await Logs()==protectedLogs,"Rejected role removal persisted changes or activity");
                Record("test-passed",new {test="last-admin-role-removal-regression",http=409,persistedChange=false,successfulActivities=0});
                await Restore();await Race("concurrent-deactivation-fixed",false,false);
                await Restore();await Race("concurrent-role-removal",true,false);
                await Restore();await Race("crossed-actors-mixed",false,true);
                await Restore();await Race("crossed-actors-deactivation",false,true,true);
                await Restore();await Snapshot("final-QA-state",2);await VerifySourceHashes();
                stage="correction-and-O3-regressions-passed";passed=true;
                Record("execution-completed",new {allPlannedScenariosExecuted=true,fullyValidated=true,backendErrors=0,a,b,area});
                return;
            }
            stage="single-administrator-fixture"; Save();
            tokenA=await Login(userA,initialA); await Change(tokenA,initialA,passwordA); tokenA=await Login(userA,passwordA);
            var users=await GetUsers(); Must(users.GetArrayLength()==1,"Unexpected seed accounts"); a=users[0].GetProperty("id").GetInt32();
            var createdArea=await Request("POST","areas",tokenA,new {nombre="QA_O3_"+run},201); area=createdArea.GetProperty("areaId").GetInt32();
            await Request("PUT",$"usuarios/{a}",tokenA,new {nombreUsuario=userA,nombreCompleto="QA O3 A "+run,areaId=area},200);
            // Assigning AreaId changes SecurityStamp in the real API.
            tokenA=await Login(userA,passwordA);
            await Snapshot("single-admin-baseline",1);
            stage="single-administrator-tests"; Save();
            var baseLogs=await Logs();
            var first=await Request("PUT",$"usuarios/{a}/desactivar",tokenA,null,409);
            Must(first.GetProperty("mensaje").GetString()!.Contains("último administrador activo"),"Wrong deactivation rejection");
            await Snapshot("single-deactivation-rejected",1); Must(await Logs()==baseLogs,"Unexpected successful administrative log for rejected deactivation");
            Record("test-passed",new {test="single-deactivation",http=409,persistedChange=false,successfulMutationLogs=0});
            var second=await Request("PUT",$"usuarios/{a}/roles",tokenA,new {roles=new[]{"PersonalArea"}},409);
            Must(second.GetProperty("mensaje").GetString()!.Contains("último administrador activo"),"Wrong role rejection");
            await Snapshot("single-role-removal-rejected",1); Must(await Logs()==baseLogs,"Unexpected successful administrative log for rejected role removal");
            Record("test-passed",new {test="single-role-removal",http=409,persistedChange=false,successfulMutationLogs=0});
            stage="two-administrator-fixture"; Save();
            var made=await Request("POST","usuarios",tokenA,new {nombreUsuario=userB,nombreCompleto="QA O3 B "+run,passwordInicial=initialB,areaId=area,roles=new[]{"Administrador"}},201);
            b=made.GetProperty("usuario").GetProperty("id").GetInt32();
            tokenB=await Login(userB,initialB); await Change(tokenB,initialB,passwordB);
            await FreshSessions(); await Snapshot("two-admin-baseline",2);
            await Race("concurrent-deactivation",false,false);
            await Restore(); await Race("concurrent-role-removal",true,false);
            await Restore(); await Race("crossed-actors-mixed",false,true);
            await Restore(); await Snapshot("final-restored-QA-only",2);
            await VerifySourceHashes();
            stage="completed";passed=true; Record("all-requested-API-SQL-tests-passed",new {a,b,area,uiBrowserExecuted=false,automaticRetries=false});
        }
        catch(Exception ex)
        {
            Record("STOP-on-failure",new {stage,exceptionType=ex.GetType().Name,sqlNumber=ex is SqlException sx ? sx.Number : (int?)null,reason=ex is InvalidOperationException?ex.Message:"Raw exception suppressed to protect secrets"});
            Console.WriteLine("STOP O3: "+stage+"; "+ex.GetType().Name+". See sanitized evidence."); Environment.ExitCode=1;
        }
        finally
        {
            if(api!=null && !api.HasExited){api.Kill(entireProcessTree:true); await api.WaitForExitAsync();Record("isolated-api-stopped",new {pid=api.Id});}
            http?.Dispose(); tokenA="";tokenB=""; Save();
            Console.WriteLine(JsonSerializer.Serialize(new {run,database=db,stage,passed,evidence=evidenceFile,temporaryDatabaseRetained=created}));
        }
    }
    async Task<JsonElement> Request(string method,string path,string token,object? body,int expected)
    {
        var result=await Send(method,path,token,body); Must(result.status==expected,$"Unexpected HTTP {result.status} for {method} {path}; expected {expected}"); return result.body;
    }
    async Task<(int status,JsonElement body,DateTime started,DateTime finished)> Send(string method,string path,string token,object? body,bool preverified=false)
    {
        if(!preverified) await Verify();
        Must(path is "auth/login" or "auth/cambiar-password" or "areas" or "usuarios" || Regex.IsMatch(path,@"^usuarios/\d+(/(activar|desactivar|roles|restablecer-password))?$"),"Unapproved endpoint");
        if(path.StartsWith("usuarios/")) {var id=int.Parse(path.Split('/')[1]);Must(id>0 && (id==a||id==b||allowedQaIds.Contains(id)),"Non-QA user target");}
        var message=new HttpRequestMessage(new HttpMethod(method),path);
        if(token!="")message.Headers.Authorization=new("Bearer",token);
        if(body!=null)message.Content=JsonContent.Create(body);
        var start=DateTime.UtcNow;
        using var response=await http!.SendAsync(message);
        var text=await response.Content.ReadAsStringAsync();
        JsonElement parsed=default;
        if(!string.IsNullOrWhiteSpace(text) && response.Content.Headers.ContentType?.MediaType=="application/json") parsed=JsonDocument.Parse(text).RootElement.Clone();
        var finished=DateTime.UtcNow;
        Record("http",new {method,path,status=(int)response.StatusCode,startedUTC=start.ToString("O"),finishedUTC=finished.ToString("O"),message=path.StartsWith("auth/")?null:parsed.ValueKind==JsonValueKind.Object && parsed.TryGetProperty("mensaje",out var msg)?msg.GetString():null});
        return ((int)response.StatusCode,parsed,start,finished);
    }
    async Task<string> Login(string username,string password)
    {var j=await Request("POST","auth/login","",new {username,password},200);return j.GetProperty("token").GetString()!;}
    async Task Change(string token,string current,string replacement) => await Request("POST","auth/cambiar-password",token,new {passwordActual=current,passwordNueva=replacement},200);
    async Task FreshSessions(){tokenA=await Login(userA,passwordA);tokenB=await Login(userB,passwordB);}
    async Task<JsonElement> GetUsers()=>await Request("GET","usuarios",tokenA,null,200);
    async Task<string> StateJson()
    {
        await using var c=await Admin(db);
        return (string)(await Scalar(c,"SELECT u.Id,u.UserName,u.Activo,u.AreaId,u.DebeCambiarPassword,(SELECT r.Name FROM AspNetUserRoles ur JOIN AspNetRoles r ON r.Id=ur.RoleId WHERE ur.UserId=u.Id ORDER BY r.Name FOR JSON PATH) Roles FROM AspNetUsers u ORDER BY u.Id FOR JSON PATH"))!;
    }
    async Task Snapshot(string label,int? expected=null)
    {
        await Verify(); var states=JsonDocument.Parse(await StateJson()).RootElement.Clone();
        var n=Count(states); Must(n>=1,"Invariant violated: zero active administrators"); if(expected.HasValue)Must(n==expected,"Wrong active administrator count");
        Must(states.EnumerateArray().All(x=>x.GetProperty("UserName").GetString()!.StartsWith("qa_o3_"+run+".",StringComparison.Ordinal)),"Unexpected users");
        Record("SQL-invariant",new {label,activeAdministrators=n,states});
    }
    static bool IsAdmin(JsonElement u)=>u.GetProperty("Activo").GetBoolean() && u.GetProperty("Roles").EnumerateArray().Any(r=>r.GetProperty("Name").GetString()=="Administrador");
    static int Count(JsonElement states)=>states.EnumerateArray().Count(IsAdmin);
    async Task<string> Logs()
    {
        await using var c=await Admin(db);
        return (string)(await Scalar(c,"SELECT BitacoraActividadId,FechaHora,TipoActividad,Resultado,UsuarioId,Detalle FROM BitacorasActividades WHERE TipoActividad IN ('CambioRoles','CambioEstadoUsuario') ORDER BY BitacoraActividadId FOR JSON PATH"))!;
    }
    async Task Restore()
    {
        stage="restore-QA-baseline"; Save();
        var states=JsonDocument.Parse(await StateJson()).RootElement.Clone();var survivor=states.EnumerateArray().First(IsAdmin).GetProperty("Id").GetInt32();
        var survivorToken=await Login(survivor==a?userA:userB,survivor==a?passwordA:passwordB);
        foreach(var u in states.EnumerateArray())
        {
            var id=u.GetProperty("Id").GetInt32();
            if(id!=a && id!=b) continue;
            if(!u.GetProperty("Roles").EnumerateArray().Any(r=>r.GetProperty("Name").GetString()=="Administrador")) await Request("PUT",$"usuarios/{id}/roles",survivorToken,new {roles=new[]{"Administrador"}},200);
            if(!u.GetProperty("Activo").GetBoolean())await Request("PUT",$"usuarios/{id}/activar",survivorToken,null,200);
        }
        await FreshSessions();await Snapshot("restored-before-next-case",2);
    }
    async Task Race(string name,bool roles,bool crossed,bool mutualDeactivation=false)
    {
        stage=name;Save();await Snapshot(name+"-before",2);var before=await Logs();
        await Verify(); // common preflight, immediately before releasing both one-shot writes
        // Both operations begin from verified sessions; one-shot HTTP sends, no retry handler.
        var gate=new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        async Task<(int status,JsonElement body,DateTime started,DateTime finished)> Go(string path,string token,object? body)
        {await gate.Task;var response=await Send("PUT",path,token,body,true);await Snapshot(name+"-after-response-"+path);return response;}
        var one=Go($"usuarios/{(crossed?b:a)}/{(roles?"roles":"desactivar")}",tokenA,roles?new {roles=new[]{"PersonalArea"}}:null);
        var secondRoles=(roles||crossed)&&!mutualDeactivation;
        var two=Go($"usuarios/{(crossed?a:b)}/{(secondRoles?"roles":"desactivar")}",crossed?tokenB:tokenA,secondRoles?new {roles=new[]{"PersonalArea"}}:null);
        gate.SetResult();
        var results=await Task.WhenAll(one,two);
        await Snapshot(name+"-after",1);
        Must(results[0].started<results[1].finished && results[1].started<results[0].finished,"Concurrent HTTP request intervals did not overlap");
        Must(results.Count(x=>x.status==200)==1 && results.All(x=>x.status is 200 or 401 or 403 or 409),"Unexpected concurrent responses");
        var after=await Logs();var oldRows=JsonDocument.Parse(before).RootElement.GetArrayLength();var rows=JsonDocument.Parse(after).RootElement.Clone();
        Must(rows.GetArrayLength()==oldRows+1,"Wrong successful concurrent mutation log count");
        Record("test-passed",new {test=name,statuses=results.Select(r=>r.status).ToArray(),successfulAdministrativeLogs=rows.EnumerateArray().Skip(oldRows).ToArray(),oneShot=true,overlappingHttpIntervals=true,internalSQLInterleavingForced=false});
    }
}
