
using ControlFinanciero.API.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace ControlFinanciero.API.Data
{
    public class ApplicationDbContext
        : IdentityDbContext<ApplicationUser, IdentityRole<int>, int>
    {
        public ApplicationDbContext(
            DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);

            builder.Entity<Area>(entity =>
            {
                entity.Property(a => a.Nombre)
                      .HasMaxLength(100)
                      .IsRequired()
                      .UseCollation("Modern_Spanish_CI_AI");

                entity.HasIndex(a => a.Nombre)
                      .IsUnique();
            });

            builder.Entity<ApplicationUser>(entity =>
            {
                entity.Property(u => u.NombreCompleto)
                      .HasMaxLength(150)
                      .IsRequired();

                entity.HasOne(u => u.Area)
                      .WithMany(a => a.Usuarios)
                      .HasForeignKey(u => u.AreaId)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            builder.Entity<DocumentoFinanciero>(entity =>
            {
                entity.HasKey(d => d.DocumentoFinancieroId);

                entity.Property(d => d.NombreArchivo)
                      .HasMaxLength(255)
                      .IsRequired();

                entity.Property(d => d.FechaImportacion)
                      .HasColumnType("datetime2");

                entity.Property(d => d.HashArchivo)
                      .HasMaxLength(64)
                      .IsUnicode(false)
                      .IsRequired();

                entity.HasIndex(d => new { d.AreaId, d.HashArchivo })
                      .IsUnique();

                entity.HasOne(d => d.Area)
                      .WithMany()
                      .HasForeignKey(d => d.AreaId)
                      .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(d => d.Usuario)
                      .WithMany()
                      .HasForeignKey(d => d.UsuarioId)
                      .OnDelete(DeleteBehavior.Restrict);
            });


            builder.Entity<RegistroFinanciero>(entity =>
            {
                entity.HasKey(r => r.RegistroFinancieroId);

                entity.Property(r => r.TipoOperacion)
                      .HasMaxLength(10)
                      .IsRequired();

                entity.Property(r => r.Descripcion)
                      .HasMaxLength(250)
                      .IsRequired();

                entity.Property(r => r.FechaOperacion)
                      .HasColumnType("date");

                entity.Property(r => r.Monto)
                      .HasPrecision(18, 2);

                entity.Property(r => r.RowVersion)
                      .IsRowVersion();

                entity.HasOne(r => r.DocumentoFinanciero)
                      .WithMany(d => d.RegistrosFinancieros)
                      .HasForeignKey(r => r.DocumentoFinancieroId)
                      .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(r => r.Area)
                      .WithMany()
                      .HasForeignKey(r => r.AreaId)
                      .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(r => r.Usuario)
                      .WithMany()
                      .HasForeignKey(r => r.UsuarioId)
                      .OnDelete(DeleteBehavior.Restrict);

                entity.ToTable(tabla =>
                {
                    tabla.HasCheckConstraint(
                        "CK_RegistroFinanciero_TipoOperacion",
                        "[TipoOperacion] IN (N'Ingreso', N'Egreso')");

                    tabla.HasCheckConstraint(
                        "CK_RegistroFinanciero_Monto",
                        "[Monto] > 0");
                });
            });

            builder.Entity<HistorialAuditoria>(entity =>
            {
                entity.ToTable("HistorialesAuditoria", tabla =>
                {
                    tabla.HasTrigger("TR_HistorialesAuditoria_Proteger");
                });

                entity.HasKey(h => h.HistorialAuditoriaId);

                entity.Property(h => h.FechaHora)
                      .HasColumnType("datetime2");

                entity.Property(h => h.TipoAccion)
                      .HasMaxLength(30)
                      .IsRequired();

                entity.Property(h => h.ValoresModificados)
                      .IsRequired();

                entity.HasOne(h => h.Usuario)
                      .WithMany()
                      .HasForeignKey(h => h.UsuarioId)
                      .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(h => h.RegistroFinanciero)
                      .WithMany()
                      .HasForeignKey(h => h.RegistroFinancieroId)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            builder.Entity<BitacoraActividad>(entity =>
            {
                entity.ToTable("BitacorasActividades", tabla =>
                {
                    tabla.HasTrigger("TR_BitacorasActividades_Proteger");
                });

                entity.HasKey(b => b.BitacoraActividadId);

                entity.Property(b => b.FechaHora)
                      .HasColumnType("datetime2");

                entity.Property(b => b.TipoActividad)
                      .HasMaxLength(60)
                      .IsRequired();

                entity.Property(b => b.Resultado)
                      .HasMaxLength(20)
                      .IsRequired();

                entity.Property(b => b.NombreUsuario)
                      .HasMaxLength(256)
                      .IsRequired();

                entity.Property(b => b.NombreDocumento)
                      .HasMaxLength(255);

                entity.Property(b => b.DireccionIp)
                      .HasMaxLength(45);

                entity.Property(b => b.Detalle)
                      .HasMaxLength(2000);

                entity.HasOne(b => b.Usuario)
                      .WithMany()
                      .HasForeignKey(b => b.UsuarioId)
                      .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(b => b.Area)
                      .WithMany()
                      .HasForeignKey(b => b.AreaId)
                      .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(b => b.DocumentoFinanciero)
                      .WithMany()
                      .HasForeignKey(b => b.DocumentoFinancieroId)
                      .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(b => b.RegistroFinanciero)
                      .WithMany()
                      .HasForeignKey(b => b.RegistroFinancieroId)
                      .OnDelete(DeleteBehavior.Restrict);

                entity.HasIndex(b => b.FechaHora);

                entity.HasIndex(b => new { b.AreaId, b.FechaHora });

                entity.HasIndex(b => new { b.UsuarioId, b.FechaHora });
            });
        }

        public DbSet<Area> Areas { get; set; }

        public DbSet<RegistroFinanciero> RegistrosFinancieros { get; set; }

        public DbSet<HistorialAuditoria> HistorialesAuditoria { get; set; }

        public DbSet<DocumentoFinanciero> DocumentosFinancieros { get; set; }

        public DbSet<BitacoraActividad> BitacorasActividades { get; set; }
    }
}
