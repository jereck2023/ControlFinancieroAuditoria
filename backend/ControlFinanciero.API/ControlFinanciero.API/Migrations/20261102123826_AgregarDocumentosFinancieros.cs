using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControlFinanciero.API.Migrations
{
    /// <inheritdoc />
    public partial class AgregarDocumentosFinancieros : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "DocumentoFinancieroId",
                table: "RegistrosFinancieros",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "DocumentosFinancieros",
                columns: table => new
                {
                    DocumentoFinancieroId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    NombreArchivo = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    AreaId = table.Column<int>(type: "int", nullable: false),
                    UsuarioId = table.Column<int>(type: "int", nullable: false),
                    FechaImportacion = table.Column<DateTime>(type: "datetime2", nullable: false),
                    HashArchivo = table.Column<string>(type: "varchar(64)", unicode: false, maxLength: 64, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DocumentosFinancieros", x => x.DocumentoFinancieroId);
                    table.ForeignKey(
                        name: "FK_DocumentosFinancieros_Areas_AreaId",
                        column: x => x.AreaId,
                        principalTable: "Areas",
                        principalColumn: "AreaId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DocumentosFinancieros_AspNetUsers_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RegistrosFinancieros_DocumentoFinancieroId",
                table: "RegistrosFinancieros",
                column: "DocumentoFinancieroId");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentosFinancieros_AreaId_HashArchivo",
                table: "DocumentosFinancieros",
                columns: new[] { "AreaId", "HashArchivo" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DocumentosFinancieros_UsuarioId",
                table: "DocumentosFinancieros",
                column: "UsuarioId");

            migrationBuilder.AddForeignKey(
                name: "FK_RegistrosFinancieros_DocumentosFinancieros_DocumentoFinancieroId",
                table: "RegistrosFinancieros",
                column: "DocumentoFinancieroId",
                principalTable: "DocumentosFinancieros",
                principalColumn: "DocumentoFinancieroId",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_RegistrosFinancieros_DocumentosFinancieros_DocumentoFinancieroId",
                table: "RegistrosFinancieros");

            migrationBuilder.DropTable(
                name: "DocumentosFinancieros");

            migrationBuilder.DropIndex(
                name: "IX_RegistrosFinancieros_DocumentoFinancieroId",
                table: "RegistrosFinancieros");

            migrationBuilder.DropColumn(
                name: "DocumentoFinancieroId",
                table: "RegistrosFinancieros");
        }
    }
}
