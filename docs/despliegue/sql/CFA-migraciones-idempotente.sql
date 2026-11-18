-- CFA: migraciones originales 0 -> 20261111005207_AgregarGestionAlertas
-- EF Core SQL Server 9.0.20. Generacion offline; no se ejecuto contra una base.
-- Sin CREATE DATABASE ni USE: seleccionar expresamente una base nueva/autorizada al ejecutar.
-- Incluye esquema, historial EF y configuracion de tres reglas; no incluye usuarios ni datos financieros.

IF OBJECT_ID(N'[__EFMigrationsHistory]') IS NULL
BEGIN
    CREATE TABLE [__EFMigrationsHistory] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY ([MigrationId])
    );
END;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261014070306_InitialCreate'
)
BEGIN
    CREATE TABLE [Areas] (
        [AreaId] int NOT NULL IDENTITY,
        [Nombre] nvarchar(100) NOT NULL,
        [Activo] bit NOT NULL,
        CONSTRAINT [PK_Areas] PRIMARY KEY ([AreaId])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261014070306_InitialCreate'
)
BEGIN
    CREATE TABLE [AspNetRoles] (
        [Id] int NOT NULL IDENTITY,
        [Name] nvarchar(256) NULL,
        [NormalizedName] nvarchar(256) NULL,
        [ConcurrencyStamp] nvarchar(max) NULL,
        CONSTRAINT [PK_AspNetRoles] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261014070306_InitialCreate'
)
BEGIN
    CREATE TABLE [AspNetUsers] (
        [Id] int NOT NULL IDENTITY,
        [NombreCompleto] nvarchar(150) NOT NULL,
        [Activo] bit NOT NULL,
        [AreaId] int NOT NULL,
        [UserName] nvarchar(256) NULL,
        [NormalizedUserName] nvarchar(256) NULL,
        [Email] nvarchar(256) NULL,
        [NormalizedEmail] nvarchar(256) NULL,
        [EmailConfirmed] bit NOT NULL,
        [PasswordHash] nvarchar(max) NULL,
        [SecurityStamp] nvarchar(max) NULL,
        [ConcurrencyStamp] nvarchar(max) NULL,
        [PhoneNumber] nvarchar(max) NULL,
        [PhoneNumberConfirmed] bit NOT NULL,
        [TwoFactorEnabled] bit NOT NULL,
        [LockoutEnd] datetimeoffset NULL,
        [LockoutEnabled] bit NOT NULL,
        [AccessFailedCount] int NOT NULL,
        CONSTRAINT [PK_AspNetUsers] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_AspNetUsers_Areas_AreaId] FOREIGN KEY ([AreaId]) REFERENCES [Areas] ([AreaId]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261014070306_InitialCreate'
)
BEGIN
    CREATE TABLE [AspNetRoleClaims] (
        [Id] int NOT NULL IDENTITY,
        [RoleId] int NOT NULL,
        [ClaimType] nvarchar(max) NULL,
        [ClaimValue] nvarchar(max) NULL,
        CONSTRAINT [PK_AspNetRoleClaims] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_AspNetRoleClaims_AspNetRoles_RoleId] FOREIGN KEY ([RoleId]) REFERENCES [AspNetRoles] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261014070306_InitialCreate'
)
BEGIN
    CREATE TABLE [AspNetUserClaims] (
        [Id] int NOT NULL IDENTITY,
        [UserId] int NOT NULL,
        [ClaimType] nvarchar(max) NULL,
        [ClaimValue] nvarchar(max) NULL,
        CONSTRAINT [PK_AspNetUserClaims] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_AspNetUserClaims_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261014070306_InitialCreate'
)
BEGIN
    CREATE TABLE [AspNetUserLogins] (
        [LoginProvider] nvarchar(450) NOT NULL,
        [ProviderKey] nvarchar(450) NOT NULL,
        [ProviderDisplayName] nvarchar(max) NULL,
        [UserId] int NOT NULL,
        CONSTRAINT [PK_AspNetUserLogins] PRIMARY KEY ([LoginProvider], [ProviderKey]),
        CONSTRAINT [FK_AspNetUserLogins_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261014070306_InitialCreate'
)
BEGIN
    CREATE TABLE [AspNetUserRoles] (
        [UserId] int NOT NULL,
        [RoleId] int NOT NULL,
        CONSTRAINT [PK_AspNetUserRoles] PRIMARY KEY ([UserId], [RoleId]),
        CONSTRAINT [FK_AspNetUserRoles_AspNetRoles_RoleId] FOREIGN KEY ([RoleId]) REFERENCES [AspNetRoles] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_AspNetUserRoles_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261014070306_InitialCreate'
)
BEGIN
    CREATE TABLE [AspNetUserTokens] (
        [UserId] int NOT NULL,
        [LoginProvider] nvarchar(450) NOT NULL,
        [Name] nvarchar(450) NOT NULL,
        [Value] nvarchar(max) NULL,
        CONSTRAINT [PK_AspNetUserTokens] PRIMARY KEY ([UserId], [LoginProvider], [Name]),
        CONSTRAINT [FK_AspNetUserTokens_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261014070306_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Areas_Nombre] ON [Areas] ([Nombre]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261014070306_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_AspNetRoleClaims_RoleId] ON [AspNetRoleClaims] ([RoleId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261014070306_InitialCreate'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [RoleNameIndex] ON [AspNetRoles] ([NormalizedName]) WHERE [NormalizedName] IS NOT NULL');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261014070306_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_AspNetUserClaims_UserId] ON [AspNetUserClaims] ([UserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261014070306_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_AspNetUserLogins_UserId] ON [AspNetUserLogins] ([UserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261014070306_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_AspNetUserRoles_RoleId] ON [AspNetUserRoles] ([RoleId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261014070306_InitialCreate'
)
BEGIN
    CREATE INDEX [EmailIndex] ON [AspNetUsers] ([NormalizedEmail]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261014070306_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_AspNetUsers_AreaId] ON [AspNetUsers] ([AreaId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261014070306_InitialCreate'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [UserNameIndex] ON [AspNetUsers] ([NormalizedUserName]) WHERE [NormalizedUserName] IS NOT NULL');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261014070306_InitialCreate'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261014070306_InitialCreate', N'9.0.20');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261018160400_AddDebeCambiarPassword'
)
BEGIN
    ALTER TABLE [AspNetUsers] ADD [DebeCambiarPassword] bit NOT NULL DEFAULT CAST(0 AS bit);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261018160400_AddDebeCambiarPassword'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261018160400_AddDebeCambiarPassword', N'9.0.20');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261019223240_MakeUserAreaOptional'
)
BEGIN
    DECLARE @var sysname;
    SELECT @var = [d].[name]
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[AspNetUsers]') AND [c].[name] = N'AreaId');
    IF @var IS NOT NULL EXEC(N'ALTER TABLE [AspNetUsers] DROP CONSTRAINT [' + @var + '];');
    ALTER TABLE [AspNetUsers] ALTER COLUMN [AreaId] int NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261019223240_MakeUserAreaOptional'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261019223240_MakeUserAreaOptional', N'9.0.20');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261027005730_ConfigurarCollationAreas'
)
BEGIN
    DROP INDEX [IX_Areas_Nombre] ON [Areas];
    DECLARE @var1 sysname;
    SELECT @var1 = [d].[name]
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Areas]') AND [c].[name] = N'Nombre');
    IF @var1 IS NOT NULL EXEC(N'ALTER TABLE [Areas] DROP CONSTRAINT [' + @var1 + '];');
    ALTER TABLE [Areas] ALTER COLUMN [Nombre] nvarchar(100) COLLATE Modern_Spanish_CI_AI NOT NULL;
    CREATE UNIQUE INDEX [IX_Areas_Nombre] ON [Areas] ([Nombre]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261027005730_ConfigurarCollationAreas'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261027005730_ConfigurarCollationAreas', N'9.0.20');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261029045752_AgregarRegistrosFinancierosYAuditoria'
)
BEGIN
    CREATE TABLE [RegistrosFinancieros] (
        [RegistroFinancieroId] int NOT NULL IDENTITY,
        [TipoOperacion] nvarchar(10) NOT NULL,
        [Descripcion] nvarchar(250) NOT NULL,
        [FechaOperacion] date NOT NULL,
        [Monto] decimal(18,2) NOT NULL,
        [AreaId] int NOT NULL,
        [UsuarioId] int NOT NULL,
        CONSTRAINT [PK_RegistrosFinancieros] PRIMARY KEY ([RegistroFinancieroId]),
        CONSTRAINT [CK_RegistroFinanciero_Monto] CHECK ([Monto] > 0),
        CONSTRAINT [CK_RegistroFinanciero_TipoOperacion] CHECK ([TipoOperacion] IN (N'Ingreso', N'Egreso')),
        CONSTRAINT [FK_RegistrosFinancieros_Areas_AreaId] FOREIGN KEY ([AreaId]) REFERENCES [Areas] ([AreaId]) ON DELETE NO ACTION,
        CONSTRAINT [FK_RegistrosFinancieros_AspNetUsers_UsuarioId] FOREIGN KEY ([UsuarioId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261029045752_AgregarRegistrosFinancierosYAuditoria'
)
BEGIN
    CREATE TABLE [HistorialesAuditoria] (
        [HistorialAuditoriaId] int NOT NULL IDENTITY,
        [FechaHora] datetime2 NOT NULL,
        [TipoAccion] nvarchar(30) NOT NULL,
        [ValoresModificados] nvarchar(max) NOT NULL,
        [UsuarioId] int NOT NULL,
        [RegistroFinancieroId] int NOT NULL,
        CONSTRAINT [PK_HistorialesAuditoria] PRIMARY KEY ([HistorialAuditoriaId]),
        CONSTRAINT [FK_HistorialesAuditoria_AspNetUsers_UsuarioId] FOREIGN KEY ([UsuarioId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_HistorialesAuditoria_RegistrosFinancieros_RegistroFinancieroId] FOREIGN KEY ([RegistroFinancieroId]) REFERENCES [RegistrosFinancieros] ([RegistroFinancieroId]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261029045752_AgregarRegistrosFinancierosYAuditoria'
)
BEGIN
    CREATE INDEX [IX_HistorialesAuditoria_RegistroFinancieroId] ON [HistorialesAuditoria] ([RegistroFinancieroId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261029045752_AgregarRegistrosFinancierosYAuditoria'
)
BEGIN
    CREATE INDEX [IX_HistorialesAuditoria_UsuarioId] ON [HistorialesAuditoria] ([UsuarioId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261029045752_AgregarRegistrosFinancierosYAuditoria'
)
BEGIN
    CREATE INDEX [IX_RegistrosFinancieros_AreaId] ON [RegistrosFinancieros] ([AreaId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261029045752_AgregarRegistrosFinancierosYAuditoria'
)
BEGIN
    CREATE INDEX [IX_RegistrosFinancieros_UsuarioId] ON [RegistrosFinancieros] ([UsuarioId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261029045752_AgregarRegistrosFinancierosYAuditoria'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261029045752_AgregarRegistrosFinancierosYAuditoria', N'9.0.20');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030103136_AgregarConcurrenciaRegistroFinanciero'
)
BEGIN
    ALTER TABLE [RegistrosFinancieros] ADD [RowVersion] rowversion NOT NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030103136_AgregarConcurrenciaRegistroFinanciero'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261030103136_AgregarConcurrenciaRegistroFinanciero', N'9.0.20');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261101225931_ProtegerHistorialAuditoria'
)
BEGIN

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
                
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261101225931_ProtegerHistorialAuditoria'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261101225931_ProtegerHistorialAuditoria', N'9.0.20');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261102123826_AgregarDocumentosFinancieros'
)
BEGIN
    ALTER TABLE [RegistrosFinancieros] ADD [DocumentoFinancieroId] int NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261102123826_AgregarDocumentosFinancieros'
)
BEGIN
    CREATE TABLE [DocumentosFinancieros] (
        [DocumentoFinancieroId] int NOT NULL IDENTITY,
        [NombreArchivo] nvarchar(255) NOT NULL,
        [AreaId] int NOT NULL,
        [UsuarioId] int NOT NULL,
        [FechaImportacion] datetime2 NOT NULL,
        [HashArchivo] varchar(64) NOT NULL,
        CONSTRAINT [PK_DocumentosFinancieros] PRIMARY KEY ([DocumentoFinancieroId]),
        CONSTRAINT [FK_DocumentosFinancieros_Areas_AreaId] FOREIGN KEY ([AreaId]) REFERENCES [Areas] ([AreaId]) ON DELETE NO ACTION,
        CONSTRAINT [FK_DocumentosFinancieros_AspNetUsers_UsuarioId] FOREIGN KEY ([UsuarioId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261102123826_AgregarDocumentosFinancieros'
)
BEGIN
    CREATE INDEX [IX_RegistrosFinancieros_DocumentoFinancieroId] ON [RegistrosFinancieros] ([DocumentoFinancieroId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261102123826_AgregarDocumentosFinancieros'
)
BEGIN
    CREATE UNIQUE INDEX [IX_DocumentosFinancieros_AreaId_HashArchivo] ON [DocumentosFinancieros] ([AreaId], [HashArchivo]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261102123826_AgregarDocumentosFinancieros'
)
BEGIN
    CREATE INDEX [IX_DocumentosFinancieros_UsuarioId] ON [DocumentosFinancieros] ([UsuarioId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261102123826_AgregarDocumentosFinancieros'
)
BEGIN
    ALTER TABLE [RegistrosFinancieros] ADD CONSTRAINT [FK_RegistrosFinancieros_DocumentosFinancieros_DocumentoFinancieroId] FOREIGN KEY ([DocumentoFinancieroId]) REFERENCES [DocumentosFinancieros] ([DocumentoFinancieroId]) ON DELETE NO ACTION;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261102123826_AgregarDocumentosFinancieros'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261102123826_AgregarDocumentosFinancieros', N'9.0.20');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261103161427_AgregarBitacoraActividades'
)
BEGIN
    CREATE TABLE [BitacorasActividades] (
        [BitacoraActividadId] int NOT NULL IDENTITY,
        [FechaHora] datetime2 NOT NULL,
        [TipoActividad] nvarchar(60) NOT NULL,
        [Resultado] nvarchar(20) NOT NULL,
        [UsuarioId] int NULL,
        [NombreUsuario] nvarchar(256) NOT NULL,
        [AreaId] int NULL,
        [DocumentoFinancieroId] int NULL,
        [NombreDocumento] nvarchar(255) NULL,
        [RegistroFinancieroId] int NULL,
        [DireccionIp] nvarchar(45) NULL,
        [Detalle] nvarchar(2000) NULL,
        CONSTRAINT [PK_BitacorasActividades] PRIMARY KEY ([BitacoraActividadId]),
        CONSTRAINT [FK_BitacorasActividades_Areas_AreaId] FOREIGN KEY ([AreaId]) REFERENCES [Areas] ([AreaId]) ON DELETE NO ACTION,
        CONSTRAINT [FK_BitacorasActividades_AspNetUsers_UsuarioId] FOREIGN KEY ([UsuarioId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_BitacorasActividades_DocumentosFinancieros_DocumentoFinancieroId] FOREIGN KEY ([DocumentoFinancieroId]) REFERENCES [DocumentosFinancieros] ([DocumentoFinancieroId]) ON DELETE NO ACTION,
        CONSTRAINT [FK_BitacorasActividades_RegistrosFinancieros_RegistroFinancieroId] FOREIGN KEY ([RegistroFinancieroId]) REFERENCES [RegistrosFinancieros] ([RegistroFinancieroId]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261103161427_AgregarBitacoraActividades'
)
BEGIN
    CREATE INDEX [IX_BitacorasActividades_AreaId_FechaHora] ON [BitacorasActividades] ([AreaId], [FechaHora]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261103161427_AgregarBitacoraActividades'
)
BEGIN

                    EXEC(N'CREATE TRIGGER TR_BitacorasActividades_Proteger
                ON dbo.BitacorasActividades
                AFTER UPDATE, DELETE
                AS
                BEGIN
                    SET NOCOUNT ON;

                    THROW 50001,
                        ''No se permite modificar ni eliminar registros de la bitácora de actividades.'',
                    1;
                END;');
                
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261103161427_AgregarBitacoraActividades'
)
BEGIN
    CREATE INDEX [IX_BitacorasActividades_DocumentoFinancieroId] ON [BitacorasActividades] ([DocumentoFinancieroId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261103161427_AgregarBitacoraActividades'
)
BEGIN
    CREATE INDEX [IX_BitacorasActividades_FechaHora] ON [BitacorasActividades] ([FechaHora]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261103161427_AgregarBitacoraActividades'
)
BEGIN
    CREATE INDEX [IX_BitacorasActividades_RegistroFinancieroId] ON [BitacorasActividades] ([RegistroFinancieroId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261103161427_AgregarBitacoraActividades'
)
BEGIN
    CREATE INDEX [IX_BitacorasActividades_UsuarioId_FechaHora] ON [BitacorasActividades] ([UsuarioId], [FechaHora]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261103161427_AgregarBitacoraActividades'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261103161427_AgregarBitacoraActividades', N'9.0.20');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110014304_AgregarReglasAnomaliasYAlertas'
)
BEGIN
    CREATE TABLE [ReglasAnomalia] (
        [ReglaAnomaliaId] int NOT NULL IDENTITY,
        [Codigo] nvarchar(50) NOT NULL,
        [Nombre] nvarchar(150) NOT NULL,
        [Descripcion] nvarchar(500) NOT NULL,
        [Activa] bit NOT NULL,
        [Umbral] int NULL,
        [VentanaMinutos] int NULL,
        [HoraInicio] time NULL,
        [HoraFin] time NULL,
        [DiasSemana] nvarchar(20) NULL,
        CONSTRAINT [PK_ReglasAnomalia] PRIMARY KEY ([ReglaAnomaliaId])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110014304_AgregarReglasAnomaliasYAlertas'
)
BEGIN
    CREATE TABLE [Alertas] (
        [AlertaId] int NOT NULL IDENTITY,
        [ReglaAnomaliaId] int NOT NULL,
        [ClaveDeteccion] varchar(64) NOT NULL,
        [Estado] nvarchar(30) NOT NULL DEFAULT N'Pendiente',
        [FechaHoraEvento] datetime2 NOT NULL,
        [FechaHoraDeteccion] datetime2 NOT NULL,
        [UsuarioId] int NULL,
        [AreaId] int NULL,
        [RegistroFinancieroId] int NULL,
        [CampoModificado] nvarchar(30) NULL,
        [Titulo] nvarchar(180) NOT NULL,
        [Descripcion] nvarchar(1000) NOT NULL,
        [EvidenciasJson] nvarchar(max) NOT NULL,
        CONSTRAINT [PK_Alertas] PRIMARY KEY ([AlertaId]),
        CONSTRAINT [FK_Alertas_Areas_AreaId] FOREIGN KEY ([AreaId]) REFERENCES [Areas] ([AreaId]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Alertas_AspNetUsers_UsuarioId] FOREIGN KEY ([UsuarioId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Alertas_RegistrosFinancieros_RegistroFinancieroId] FOREIGN KEY ([RegistroFinancieroId]) REFERENCES [RegistrosFinancieros] ([RegistroFinancieroId]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Alertas_ReglasAnomalia_ReglaAnomaliaId] FOREIGN KEY ([ReglaAnomaliaId]) REFERENCES [ReglasAnomalia] ([ReglaAnomaliaId]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110014304_AgregarReglasAnomaliasYAlertas'
)
BEGIN
    IF EXISTS (SELECT * FROM [sys].[identity_columns] WHERE [name] IN (N'ReglaAnomaliaId', N'Activa', N'Codigo', N'Descripcion', N'DiasSemana', N'HoraFin', N'HoraInicio', N'Nombre', N'Umbral', N'VentanaMinutos') AND [object_id] = OBJECT_ID(N'[ReglasAnomalia]'))
        SET IDENTITY_INSERT [ReglasAnomalia] ON;
    EXEC(N'INSERT INTO [ReglasAnomalia] ([ReglaAnomaliaId], [Activa], [Codigo], [Descripcion], [DiasSemana], [HoraFin], [HoraInicio], [Nombre], [Umbral], [VentanaMinutos])
    VALUES (1, CAST(1 AS bit), N''MODIFICACION_REITERADA'', N''Detecta cambios repetidos del mismo campo, registro y usuario dentro de una ventana de tiempo.'', NULL, NULL, NULL, N''Modificaciones reiteradas sobre un mismo campo'', 3, 30),
    (2, CAST(1 AS bit), N''FUERA_DE_HORARIO'', N''Detecta inicios de sesion exitosos y cambios financieros fuera del horario de referencia.'', N''1,2,3,4,5'', ''18:00:00'', ''08:00:00'', N''Actividad fuera del horario institucional'', NULL, NULL),
    (3, CAST(1 AS bit), N''LOGIN_FALLIDO_REITERADO'', N''Detecta multiples contrasenas incorrectas para una misma cuenta dentro de una ventana de tiempo.'', NULL, NULL, NULL, N''Contrasenas incorrectas reiteradas'', 5, 15)');
    IF EXISTS (SELECT * FROM [sys].[identity_columns] WHERE [name] IN (N'ReglaAnomaliaId', N'Activa', N'Codigo', N'Descripcion', N'DiasSemana', N'HoraFin', N'HoraInicio', N'Nombre', N'Umbral', N'VentanaMinutos') AND [object_id] = OBJECT_ID(N'[ReglasAnomalia]'))
        SET IDENTITY_INSERT [ReglasAnomalia] OFF;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110014304_AgregarReglasAnomaliasYAlertas'
)
BEGIN
    CREATE INDEX [IX_Alertas_AreaId_FechaHoraEvento] ON [Alertas] ([AreaId], [FechaHoraEvento]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110014304_AgregarReglasAnomaliasYAlertas'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Alertas_ClaveDeteccion] ON [Alertas] ([ClaveDeteccion]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110014304_AgregarReglasAnomaliasYAlertas'
)
BEGIN
    CREATE INDEX [IX_Alertas_RegistroFinancieroId] ON [Alertas] ([RegistroFinancieroId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110014304_AgregarReglasAnomaliasYAlertas'
)
BEGIN
    CREATE INDEX [IX_Alertas_ReglaAnomaliaId_FechaHoraEvento] ON [Alertas] ([ReglaAnomaliaId], [FechaHoraEvento]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110014304_AgregarReglasAnomaliasYAlertas'
)
BEGIN
    CREATE INDEX [IX_Alertas_UsuarioId] ON [Alertas] ([UsuarioId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110014304_AgregarReglasAnomaliasYAlertas'
)
BEGIN
    CREATE UNIQUE INDEX [IX_ReglasAnomalia_Codigo] ON [ReglasAnomalia] ([Codigo]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110014304_AgregarReglasAnomaliasYAlertas'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261110014304_AgregarReglasAnomaliasYAlertas', N'9.0.20');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110064134_AgregarSeguimientoDeteccionAnomalias'
)
BEGIN
    ALTER TABLE [ReglasAnomalia] ADD [FechaUltimaEvaluacionUtc] datetime2 NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110064134_AgregarSeguimientoDeteccionAnomalias'
)
BEGIN
    EXEC(N'UPDATE [ReglasAnomalia] SET [FechaUltimaEvaluacionUtc] = NULL
    WHERE [ReglaAnomaliaId] = 1;
    SELECT @@ROWCOUNT');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110064134_AgregarSeguimientoDeteccionAnomalias'
)
BEGIN
    EXEC(N'UPDATE [ReglasAnomalia] SET [FechaUltimaEvaluacionUtc] = NULL
    WHERE [ReglaAnomaliaId] = 2;
    SELECT @@ROWCOUNT');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110064134_AgregarSeguimientoDeteccionAnomalias'
)
BEGIN
    EXEC(N'UPDATE [ReglasAnomalia] SET [FechaUltimaEvaluacionUtc] = NULL
    WHERE [ReglaAnomaliaId] = 3;
    SELECT @@ROWCOUNT');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110064134_AgregarSeguimientoDeteccionAnomalias'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261110064134_AgregarSeguimientoDeteccionAnomalias', N'9.0.20');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261111005207_AgregarGestionAlertas'
)
BEGIN
    ALTER TABLE [Alertas] ADD [FechaCierreUtc] datetime2 NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261111005207_AgregarGestionAlertas'
)
BEGIN
    ALTER TABLE [Alertas] ADD [FechaInicioRevisionUtc] datetime2 NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261111005207_AgregarGestionAlertas'
)
BEGIN
    ALTER TABLE [Alertas] ADD [JustificacionCierre] nvarchar(1000) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261111005207_AgregarGestionAlertas'
)
BEGIN
    ALTER TABLE [Alertas] ADD [RowVersion] rowversion NOT NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261111005207_AgregarGestionAlertas'
)
BEGIN
    ALTER TABLE [Alertas] ADD [UsuarioCierreId] int NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261111005207_AgregarGestionAlertas'
)
BEGIN
    ALTER TABLE [Alertas] ADD [UsuarioRevisionId] int NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261111005207_AgregarGestionAlertas'
)
BEGIN
    CREATE INDEX [IX_Alertas_UsuarioCierreId] ON [Alertas] ([UsuarioCierreId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261111005207_AgregarGestionAlertas'
)
BEGIN
    CREATE INDEX [IX_Alertas_UsuarioRevisionId] ON [Alertas] ([UsuarioRevisionId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261111005207_AgregarGestionAlertas'
)
BEGIN
    ALTER TABLE [Alertas] ADD CONSTRAINT [FK_Alertas_AspNetUsers_UsuarioCierreId] FOREIGN KEY ([UsuarioCierreId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE NO ACTION;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261111005207_AgregarGestionAlertas'
)
BEGIN
    ALTER TABLE [Alertas] ADD CONSTRAINT [FK_Alertas_AspNetUsers_UsuarioRevisionId] FOREIGN KEY ([UsuarioRevisionId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE NO ACTION;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261111005207_AgregarGestionAlertas'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261111005207_AgregarGestionAlertas', N'9.0.20');
END;

COMMIT;
GO

