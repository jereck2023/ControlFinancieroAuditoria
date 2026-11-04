using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControlFinanciero.API.Migrations
{
    /// <inheritdoc />
    public partial class AgregarBitacoraActividades : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "BitacorasActividades",
                columns: table => new
                {
                    BitacoraActividadId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FechaHora = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TipoActividad = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: false),
                    Resultado = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    UsuarioId = table.Column<int>(type: "int", nullable: true),
                    NombreUsuario = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    AreaId = table.Column<int>(type: "int", nullable: true),
                    DocumentoFinancieroId = table.Column<int>(type: "int", nullable: true),
                    NombreDocumento = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    RegistroFinancieroId = table.Column<int>(type: "int", nullable: true),
                    DireccionIp = table.Column<string>(type: "nvarchar(45)", maxLength: 45, nullable: true),
                    Detalle = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BitacorasActividades", x => x.BitacoraActividadId);
                    table.ForeignKey(
                        name: "FK_BitacorasActividades_Areas_AreaId",
                        column: x => x.AreaId,
                        principalTable: "Areas",
                        principalColumn: "AreaId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_BitacorasActividades_AspNetUsers_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_BitacorasActividades_DocumentosFinancieros_DocumentoFinancieroId",
                        column: x => x.DocumentoFinancieroId,
                        principalTable: "DocumentosFinancieros",
                        principalColumn: "DocumentoFinancieroId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_BitacorasActividades_RegistrosFinancieros_RegistroFinancieroId",
                        column: x => x.RegistroFinancieroId,
                        principalTable: "RegistrosFinancieros",
                        principalColumn: "RegistroFinancieroId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BitacorasActividades_AreaId_FechaHora",
                table: "BitacorasActividades",
                columns: new[] { "AreaId", "FechaHora" });


            migrationBuilder.Sql(@"
                CREATE TRIGGER TR_BitacorasActividades_Proteger
                ON dbo.BitacorasActividades
                AFTER UPDATE, DELETE
                AS
                BEGIN
                    SET NOCOUNT ON;

                    THROW 50001,
                        'No se permite modificar ni eliminar registros de la bitácora de actividades.',
                    1;
                END;
            ");


            migrationBuilder.CreateIndex(
                name: "IX_BitacorasActividades_DocumentoFinancieroId",
                table: "BitacorasActividades",
                column: "DocumentoFinancieroId");

            migrationBuilder.CreateIndex(
                name: "IX_BitacorasActividades_FechaHora",
                table: "BitacorasActividades",
                column: "FechaHora");

            migrationBuilder.CreateIndex(
                name: "IX_BitacorasActividades_RegistroFinancieroId",
                table: "BitacorasActividades",
                column: "RegistroFinancieroId");

            migrationBuilder.CreateIndex(
                name: "IX_BitacorasActividades_UsuarioId_FechaHora",
                table: "BitacorasActividades",
                columns: new[] { "UsuarioId", "FechaHora" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BitacorasActividades");
        }
    }
}
