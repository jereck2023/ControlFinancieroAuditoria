using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControlFinanciero.API.Migrations
{
    /// <inheritdoc />
    public partial class AgregarRegistrosFinancierosYAuditoria : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "RegistrosFinancieros",
                columns: table => new
                {
                    RegistroFinancieroId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TipoOperacion = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Descripcion = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: false),
                    FechaOperacion = table.Column<DateOnly>(type: "date", nullable: false),
                    Monto = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    AreaId = table.Column<int>(type: "int", nullable: false),
                    UsuarioId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RegistrosFinancieros", x => x.RegistroFinancieroId);
                    table.CheckConstraint("CK_RegistroFinanciero_Monto", "[Monto] > 0");
                    table.CheckConstraint("CK_RegistroFinanciero_TipoOperacion", "[TipoOperacion] IN (N'Ingreso', N'Egreso')");
                    table.ForeignKey(
                        name: "FK_RegistrosFinancieros_Areas_AreaId",
                        column: x => x.AreaId,
                        principalTable: "Areas",
                        principalColumn: "AreaId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RegistrosFinancieros_AspNetUsers_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "HistorialesAuditoria",
                columns: table => new
                {
                    HistorialAuditoriaId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FechaHora = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TipoAccion = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    ValoresModificados = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    UsuarioId = table.Column<int>(type: "int", nullable: false),
                    RegistroFinancieroId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HistorialesAuditoria", x => x.HistorialAuditoriaId);
                    table.ForeignKey(
                        name: "FK_HistorialesAuditoria_AspNetUsers_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_HistorialesAuditoria_RegistrosFinancieros_RegistroFinancieroId",
                        column: x => x.RegistroFinancieroId,
                        principalTable: "RegistrosFinancieros",
                        principalColumn: "RegistroFinancieroId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_HistorialesAuditoria_RegistroFinancieroId",
                table: "HistorialesAuditoria",
                column: "RegistroFinancieroId");

            migrationBuilder.CreateIndex(
                name: "IX_HistorialesAuditoria_UsuarioId",
                table: "HistorialesAuditoria",
                column: "UsuarioId");

            migrationBuilder.CreateIndex(
                name: "IX_RegistrosFinancieros_AreaId",
                table: "RegistrosFinancieros",
                column: "AreaId");

            migrationBuilder.CreateIndex(
                name: "IX_RegistrosFinancieros_UsuarioId",
                table: "RegistrosFinancieros",
                column: "UsuarioId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "HistorialesAuditoria");

            migrationBuilder.DropTable(
                name: "RegistrosFinancieros");
        }
    }
}
