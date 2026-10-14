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
                      .IsRequired();

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
        }

        public DbSet<Area> Areas { get; set; }
    }
}
