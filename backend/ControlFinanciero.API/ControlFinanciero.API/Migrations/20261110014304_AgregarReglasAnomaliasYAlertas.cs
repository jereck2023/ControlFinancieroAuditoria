using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace ControlFinanciero.API.Migrations
{
    /// <inheritdoc />
    public partial class AgregarReglasAnomaliasYAlertas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ReglasAnomalia",
                columns: table => new
                {
                    ReglaAnomaliaId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Codigo = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Nombre = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Descripcion = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Activa = table.Column<bool>(type: "bit", nullable: false),
                    Umbral = table.Column<int>(type: "int", nullable: true),
                    VentanaMinutos = table.Column<int>(type: "int", nullable: true),
                    HoraInicio = table.Column<TimeOnly>(type: "time", nullable: true),
                    HoraFin = table.Column<TimeOnly>(type: "time", nullable: true),
                    DiasSemana = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReglasAnomalia", x => x.ReglaAnomaliaId);
                });

            migrationBuilder.CreateTable(
                name: "Alertas",
                columns: table => new
                {
                    AlertaId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ReglaAnomaliaId = table.Column<int>(type: "int", nullable: false),
                    ClaveDeteccion = table.Column<string>(type: "varchar(64)", unicode: false, maxLength: 64, nullable: false),
                    Estado = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false, defaultValue: "Pendiente"),
                    FechaHoraEvento = table.Column<DateTime>(type: "datetime2", nullable: false),
                    FechaHoraDeteccion = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UsuarioId = table.Column<int>(type: "int", nullable: true),
                    AreaId = table.Column<int>(type: "int", nullable: true),
                    RegistroFinancieroId = table.Column<int>(type: "int", nullable: true),
                    CampoModificado = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    Titulo = table.Column<string>(type: "nvarchar(180)", maxLength: 180, nullable: false),
                    Descripcion = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    EvidenciasJson = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Alertas", x => x.AlertaId);
                    table.ForeignKey(
                        name: "FK_Alertas_Areas_AreaId",
                        column: x => x.AreaId,
                        principalTable: "Areas",
                        principalColumn: "AreaId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Alertas_AspNetUsers_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Alertas_RegistrosFinancieros_RegistroFinancieroId",
                        column: x => x.RegistroFinancieroId,
                        principalTable: "RegistrosFinancieros",
                        principalColumn: "RegistroFinancieroId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Alertas_ReglasAnomalia_ReglaAnomaliaId",
                        column: x => x.ReglaAnomaliaId,
                        principalTable: "ReglasAnomalia",
                        principalColumn: "ReglaAnomaliaId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.InsertData(
                table: "ReglasAnomalia",
                columns: new[] { "ReglaAnomaliaId", "Activa", "Codigo", "Descripcion", "DiasSemana", "HoraFin", "HoraInicio", "Nombre", "Umbral", "VentanaMinutos" },
                values: new object[,]
                {
                    { 1, true, "MODIFICACION_REITERADA", "Detecta cambios repetidos del mismo campo, registro y usuario dentro de una ventana de tiempo.", null, null, null, "Modificaciones reiteradas sobre un mismo campo", 3, 30 },
                    { 2, true, "FUERA_DE_HORARIO", "Detecta inicios de sesion exitosos y cambios financieros fuera del horario de referencia.", "1,2,3,4,5", new TimeOnly(18, 0, 0), new TimeOnly(8, 0, 0), "Actividad fuera del horario institucional", null, null },
                    { 3, true, "LOGIN_FALLIDO_REITERADO", "Detecta multiples contrasenas incorrectas para una misma cuenta dentro de una ventana de tiempo.", null, null, null, "Contrasenas incorrectas reiteradas", 5, 15 }
                });

            migrationBuilder.CreateIndex(
                name: "IX_Alertas_AreaId_FechaHoraEvento",
                table: "Alertas",
                columns: new[] { "AreaId", "FechaHoraEvento" });

            migrationBuilder.CreateIndex(
                name: "IX_Alertas_ClaveDeteccion",
                table: "Alertas",
                column: "ClaveDeteccion",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Alertas_RegistroFinancieroId",
                table: "Alertas",
                column: "RegistroFinancieroId");

            migrationBuilder.CreateIndex(
                name: "IX_Alertas_ReglaAnomaliaId_FechaHoraEvento",
                table: "Alertas",
                columns: new[] { "ReglaAnomaliaId", "FechaHoraEvento" });

            migrationBuilder.CreateIndex(
                name: "IX_Alertas_UsuarioId",
                table: "Alertas",
                column: "UsuarioId");

            migrationBuilder.CreateIndex(
                name: "IX_ReglasAnomalia_Codigo",
                table: "ReglasAnomalia",
                column: "Codigo",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Alertas");

            migrationBuilder.DropTable(
                name: "ReglasAnomalia");
        }
    }
}
