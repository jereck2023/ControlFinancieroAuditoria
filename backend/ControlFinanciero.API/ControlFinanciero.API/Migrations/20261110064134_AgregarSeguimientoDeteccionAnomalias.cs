using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControlFinanciero.API.Migrations
{
    /// <inheritdoc />
    public partial class AgregarSeguimientoDeteccionAnomalias : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "FechaUltimaEvaluacionUtc",
                table: "ReglasAnomalia",
                type: "datetime2",
                nullable: true);

            migrationBuilder.UpdateData(
                table: "ReglasAnomalia",
                keyColumn: "ReglaAnomaliaId",
                keyValue: 1,
                column: "FechaUltimaEvaluacionUtc",
                value: null);

            migrationBuilder.UpdateData(
                table: "ReglasAnomalia",
                keyColumn: "ReglaAnomaliaId",
                keyValue: 2,
                column: "FechaUltimaEvaluacionUtc",
                value: null);

            migrationBuilder.UpdateData(
                table: "ReglasAnomalia",
                keyColumn: "ReglaAnomaliaId",
                keyValue: 3,
                column: "FechaUltimaEvaluacionUtc",
                value: null);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FechaUltimaEvaluacionUtc",
                table: "ReglasAnomalia");
        }
    }
}
