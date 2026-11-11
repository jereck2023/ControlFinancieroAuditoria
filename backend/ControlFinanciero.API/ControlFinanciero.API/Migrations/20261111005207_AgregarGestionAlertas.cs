using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControlFinanciero.API.Migrations
{
    /// <inheritdoc />
    public partial class AgregarGestionAlertas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "FechaCierreUtc",
                table: "Alertas",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "FechaInicioRevisionUtc",
                table: "Alertas",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "JustificacionCierre",
                table: "Alertas",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "Alertas",
                type: "rowversion",
                rowVersion: true,
                nullable: false,
                defaultValue: new byte[0]);

            migrationBuilder.AddColumn<int>(
                name: "UsuarioCierreId",
                table: "Alertas",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "UsuarioRevisionId",
                table: "Alertas",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Alertas_UsuarioCierreId",
                table: "Alertas",
                column: "UsuarioCierreId");

            migrationBuilder.CreateIndex(
                name: "IX_Alertas_UsuarioRevisionId",
                table: "Alertas",
                column: "UsuarioRevisionId");

            migrationBuilder.AddForeignKey(
                name: "FK_Alertas_AspNetUsers_UsuarioCierreId",
                table: "Alertas",
                column: "UsuarioCierreId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Alertas_AspNetUsers_UsuarioRevisionId",
                table: "Alertas",
                column: "UsuarioRevisionId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Alertas_AspNetUsers_UsuarioCierreId",
                table: "Alertas");

            migrationBuilder.DropForeignKey(
                name: "FK_Alertas_AspNetUsers_UsuarioRevisionId",
                table: "Alertas");

            migrationBuilder.DropIndex(
                name: "IX_Alertas_UsuarioCierreId",
                table: "Alertas");

            migrationBuilder.DropIndex(
                name: "IX_Alertas_UsuarioRevisionId",
                table: "Alertas");

            migrationBuilder.DropColumn(
                name: "FechaCierreUtc",
                table: "Alertas");

            migrationBuilder.DropColumn(
                name: "FechaInicioRevisionUtc",
                table: "Alertas");

            migrationBuilder.DropColumn(
                name: "JustificacionCierre",
                table: "Alertas");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "Alertas");

            migrationBuilder.DropColumn(
                name: "UsuarioCierreId",
                table: "Alertas");

            migrationBuilder.DropColumn(
                name: "UsuarioRevisionId",
                table: "Alertas");
        }
    }
}
