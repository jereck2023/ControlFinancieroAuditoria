using System.Data.Common;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using ControlFinanciero.API.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;

var root = new DirectoryInfo(Directory.GetCurrentDirectory());
while (root != null && !Directory.Exists(Path.Combine(root.FullName, "backend", "ControlFinanciero.API", "ControlFinanciero.API", "Migrations"))) root = root.Parent;
if (root == null) throw new InvalidOperationException("Ejecute desde el repositorio CFA.");
var backend = Path.Combine(root.FullName, "backend", "ControlFinanciero.API", "ControlFinanciero.API");
var output = args.Length == 0
    ? Path.Combine(root.FullName, "docs", "despliegue", "sql", "CFA-migraciones-idempotente.sql")
    : Path.GetFullPath(args[0]);
var manifestPath = Path.ChangeExtension(output, ".verificacion.json");
if (File.Exists(output) || File.Exists(manifestPath)) throw new InvalidOperationException("No se sobrescriben archivos existentes; elija otra ruta de salida.");
var sources = Directory.GetFiles(Path.Combine(backend, "Migrations"), "*.cs")
    .Concat(Directory.GetFiles(Path.Combine(backend, "Models"), "*.cs"))
    .Append(Path.Combine(backend, "Data", "ApplicationDbContext.cs"))
    .OrderBy(p => p, StringComparer.Ordinal).ToArray();
var sourceHashes = sources.ToDictionary(p => Path.GetRelativePath(root.FullName, p).Replace('\\', '/'), p => Hash(File.ReadAllBytes(p)));

var blocker = new BlockConnections();
var options = new DbContextOptionsBuilder<ApplicationDbContext>()
    .UseSqlServer("Server=127.0.0.1,1;Database=CFA_GENERACION_SQL_OFFLINE;Integrated Security=True;Connect Timeout=1;TrustServerCertificate=True")
    .AddInterceptors(blocker).Options;
using var context = new ApplicationDbContext(options);
var assembly = context.GetService<IMigrationsAssembly>();
var ids = assembly.Migrations.Keys.OrderBy(id => id, StringComparer.Ordinal).ToArray();
var sourceIds = Directory.GetFiles(Path.Combine(backend, "Migrations"), "*.cs")
    .Select(Path.GetFileNameWithoutExtension).Where(n => n != null && Regex.IsMatch(n, @"^\d{14}_") && !n.EndsWith(".Designer"))
    .OrderBy(n => n, StringComparer.Ordinal).ToArray();
Require(ids.Length == 12 && ids.SequenceEqual(sourceIds!), "Las migraciones compiladas no coinciden con las doce fuentes originales.");
var migrations = ids.Select(id => assembly.CreateMigration(assembly.Migrations[id], context.Database.ProviderName!)).ToArray();
var script = context.GetService<IMigrator>().GenerateScript(Migration.InitialDatabase, ids[^1], MigrationsSqlGenerationOptions.Idempotent);

// CREATE TRIGGER must start its own SQL Server batch. The original raw Up operation
// is valid when EF executes commands separately, but not inside an idempotent IF.
// Wrap only that raw operation in dynamic SQL in this delivery artifact, never in the sources.
var batchAdjustments = new List<string>();
foreach (var operation in migrations.SelectMany(m => m.UpOperations).OfType<SqlOperation>())
{
    var raw = operation.Sql.Trim();
    if (!Regex.IsMatch(raw, @"^CREATE\s+TRIGGER\b", RegexOptions.IgnoreCase)) continue;
    var pattern = string.Join(@"\s+", Regex.Split(raw, @"\s+").Select(Regex.Escape));
    var regex = new Regex(pattern, RegexOptions.CultureInvariant);
    Require(regex.Matches(script).Count == 1, "No se pudo identificar de forma unívoca el trigger para encapsular su lote.");
    script = regex.Replace(script, _ => "EXEC(N'" + raw.Replace("'", "''") + "');", 1);
    batchAdjustments.Add("TR_BitacorasActividades_Proteger: CREATE TRIGGER encapsulado en EXEC(N'...') para su lote propio dentro del IF idempotente.");
}
script = "-- CFA: migraciones originales 0 -> " + ids[^1] + "\n"
    + "-- EF Core SQL Server 9.0.20. Generacion offline; no se ejecuto contra una base.\n"
    + "-- Sin CREATE DATABASE ni USE: seleccionar expresamente una base nueva/autorizada al ejecutar.\n"
    + "-- Incluye esquema, historial EF y configuracion de tres reglas; no incluye usuarios ni datos financieros.\n\n" + script;

var tables = new Dictionary<string, HashSet<string>>(StringComparer.Ordinal);
var primaryKeys = new HashSet<string>();
var foreignKeys = new HashSet<string>();
var indexes = new Dictionary<string, bool>();
var checks = new HashSet<string>();
foreach (var operation in migrations.SelectMany(m => m.UpOperations))
{
    switch (operation)
    {
        case CreateTableOperation table:
            tables.Add(table.Name, table.Columns.Select(c => c.Name).ToHashSet());
            if (table.PrimaryKey != null) primaryKeys.Add(table.PrimaryKey.Name);
            foreach (var fk in table.ForeignKeys) foreignKeys.Add(fk.Name);
            foreach (var check in table.CheckConstraints) checks.Add(check.Name);
            break;
        case AddColumnOperation column: tables[column.Table].Add(column.Name); break;
        case DropColumnOperation column: tables[column.Table].Remove(column.Name); break;
        case RenameColumnOperation column: tables[column.Table].Remove(column.Name); tables[column.Table].Add(column.NewName); break;
        case AddForeignKeyOperation fk: foreignKeys.Add(fk.Name); break;
        case DropForeignKeyOperation fk: foreignKeys.Remove(fk.Name); break;
        case CreateIndexOperation index: indexes[index.Name] = index.IsUnique; break;
        case DropIndexOperation index: indexes.Remove(index.Name); break;
        case AddCheckConstraintOperation check: checks.Add(check.Name); break;
        case DropCheckConstraintOperation check: checks.Remove(check.Name); break;
    }
}
foreach (var table in tables.Keys) Require(Regex.IsMatch(script, @"CREATE TABLE \[" + Regex.Escape(table) + @"\]"), "Falta tabla " + table);
foreach (var column in tables.Values.SelectMany(c => c).Distinct()) Require(script.Contains("[" + column + "]"), "Falta columna " + column);
foreach (var key in primaryKeys.Concat(foreignKeys).Concat(checks)) Require(script.Contains("[" + key + "]"), "Falta restricción " + key);
foreach (var (name, unique) in indexes) Require(Regex.IsMatch(script, "CREATE " + (unique ? "UNIQUE " : "") + @"INDEX \[" + Regex.Escape(name) + @"\]"), "Falta índice " + name);
Require(Regex.Matches(script, @"INSERT INTO \[__EFMigrationsHistory\]").Count == ids.Length, "Historial de migraciones incompleto.");
foreach (var id in ids) Require(script.Contains("[MigrationId] = N'" + id + "'"), "Falta guardia idempotente " + id);
Require(script.Contains("TR_HistorialesAuditoria_Proteger") && script.Contains("TR_BitacorasActividades_Proteger"), "Falta protección de trazabilidad.");
Require(Regex.Matches(script, @"\[RowVersion\] rowversion", RegexOptions.IgnoreCase).Count == 2, "Faltan columnas de concurrencia.");
Require(script.Contains("Modern_Spanish_CI_AI"), "Falta collation institucional.");
var insertTargets = Regex.Matches(script, @"\bINSERT\s+INTO\s+\[([^\]]+)\]", RegexOptions.IgnoreCase).Select(m => m.Groups[1].Value).Distinct().ToArray();
Require(insertTargets.All(t => t is "ReglasAnomalia" or "__EFMigrationsHistory"), "Se encontraron inserciones ajenas al esquema/configuración permitidos.");
Require(migrations.SelectMany(m => m.UpOperations).OfType<InsertDataOperation>().All(o => o.Table == "ReglasAnomalia" && o.Values.GetLength(0) == 3), "Datos iniciales no esperados.");
Require(!Regex.IsMatch(script, @"QA_|Proyecto#Financiero|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|(?m)^\s*CREATE\s+DATABASE\b|(?m)^\s*USE\s+\[", RegexOptions.IgnoreCase), "Contenido no permitido en el script.");
var outsideStringLiterals = Regex.Replace(script, @"'(?:''|[^'])*'", "''", RegexOptions.Singleline);
Require(!Regex.IsMatch(outsideStringLiterals, @"(?m)^\s*CREATE\s+TRIGGER\b", RegexOptions.IgnoreCase), "Quedó un trigger sin lote dinámico.");
Require(blocker.Attempts == 0, "Se intentó abrir una conexión.");
foreach (var p in sources) Require(sourceHashes[Path.GetRelativePath(root.FullName, p).Replace('\\', '/')] == Hash(File.ReadAllBytes(p)), "Se modificó una fuente original.");

var report = new
{
    framework = "EF Core SQL Server 9.0.20", mode = "offline, idempotente, solo generación",
    migrations = ids, connectionAttempts = blocker.Attempts,
    tables, primaryKeys = primaryKeys.Order(), foreignKeys = foreignKeys.Order(), indexes,
    checkConstraints = checks.Order(), triggers = new[] { "TR_HistorialesAuditoria_Proteger", "TR_BitacorasActividades_Proteger" },
    insertTargets, seedRules = new[] { "MODIFICACION_REITERADA", "FUERA_DE_HORARIO", "LOGIN_FALLIDO_REITERADO" },
    batchAdjustments, originalSourceHashes = sourceHashes, scriptSha256 = Hash(Encoding.UTF8.GetBytes(script)),
    checks = new { sourceMigrationCoverage = true, structuralNamesPresent = true, migrationHistoryGuards = true, noBusinessData = true, sourceFilesUnchanged = true, executedOnSqlServer = false }
};
Directory.CreateDirectory(Path.GetDirectoryName(output)!);
File.WriteAllText(output, script, new UTF8Encoding(false));
File.WriteAllText(manifestPath, JsonSerializer.Serialize(report, new JsonSerializerOptions { WriteIndented = true }), new UTF8Encoding(false));
Console.WriteLine($"Generadas {ids.Length} migraciones: {tables.Count} tablas de aplicación/Identity, {foreignKeys.Count} relaciones, {indexes.Count} índices, {checks.Count} CHECK y 2 triggers.");
Console.WriteLine("Tabla técnica adicional: __EFMigrationsHistory. Aperturas de conexión: " + blocker.Attempts);
Console.WriteLine(output);
Console.WriteLine(manifestPath);

static string Hash(byte[] bytes) => Convert.ToHexString(SHA256.HashData(bytes));
static void Require(bool condition, string message) { if (!condition) throw new InvalidOperationException(message); }
sealed class BlockConnections : DbConnectionInterceptor
{
    public int Attempts { get; private set; }
    public override InterceptionResult ConnectionOpening(DbConnection connection, ConnectionEventData eventData, InterceptionResult result)
    { Attempts++; throw new InvalidOperationException("Herramienta offline: conexión prohibida."); }
    public override ValueTask<InterceptionResult> ConnectionOpeningAsync(DbConnection connection, ConnectionEventData eventData, InterceptionResult result, CancellationToken cancellationToken = default)
    { Attempts++; throw new InvalidOperationException("Herramienta offline: conexión prohibida."); }
}
