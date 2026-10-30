using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControlFinanciero.API.Migrations
{
    /// <inheritdoc />
    public partial class AgregarConcurrenciaRegistroFinanciero : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "RegistrosFinancieros",
                type: "rowversion",
                rowVersion: true,
                nullable: false,
                defaultValue: new byte[0]);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "RegistrosFinancieros");
        }
    }
}
