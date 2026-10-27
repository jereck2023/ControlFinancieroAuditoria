using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControlFinanciero.API.Migrations
{
    /// <inheritdoc />
    public partial class ConfigurarCollationAreas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "Nombre",
                table: "Areas",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                collation: "Modern_Spanish_CI_AI",
                oldClrType: typeof(string),
                oldType: "nvarchar(100)",
                oldMaxLength: 100);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "Nombre",
                table: "Areas",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(100)",
                oldMaxLength: 100,
                oldCollation: "Modern_Spanish_CI_AI");
        }
    }
}
