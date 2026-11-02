using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControlFinanciero.API.Migrations
{
    /// <inheritdoc />
    public partial class ProtegerHistorialAuditoria : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
        EXEC(N'
            CREATE TRIGGER [dbo].[TR_HistorialesAuditoria_Proteger]
            ON [dbo].[HistorialesAuditoria]
            AFTER UPDATE, DELETE
            AS
            BEGIN
                SET NOCOUNT ON;

                    THROW 51000,
                        ''No se permite modificar ni eliminar registros del historial de auditoria.'',
                        1;
                    END
                ');
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DROP TRIGGER IF EXISTS [dbo].[TR_HistorialesAuditoria_Proteger];
            ");
        }
    }
}
