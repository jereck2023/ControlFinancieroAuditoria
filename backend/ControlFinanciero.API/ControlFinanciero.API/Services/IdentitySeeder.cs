using Microsoft.AspNetCore.Identity;
using ControlFinanciero.API.Constants;
using ControlFinanciero.API.Models;
using Microsoft.Extensions.Configuration;

namespace ControlFinanciero.API.Services
{
    public static class IdentitySeeder
    {
        public static async Task SeedRolesAsync(
            IServiceProvider serviceProvider)
        {
            using var scope = serviceProvider.CreateScope();

            var roleManager = scope.ServiceProvider
                .GetRequiredService<RoleManager<IdentityRole<int>>>();

            string[] roles =
            {
                Roles.Administrador,
                Roles.PersonalArea,
                Roles.JefeArea,
                Roles.Auditor
            };

            foreach (var roleName in roles)
            {
                if (!await roleManager.RoleExistsAsync(roleName))
                {
                    var result = await roleManager.CreateAsync(
                        new IdentityRole<int>(roleName));

                    if (!result.Succeeded)
                    {
                        throw new InvalidOperationException(
                            $"No se pudo crear el rol {roleName}: " +
                            string.Join(", ",
                                result.Errors.Select(e => e.Description)));
                    }
                }
            }
        }

        public static async Task SeedAdminAsync(IServiceProvider serviceProvider)
        {
            using var scope = serviceProvider.CreateScope();

            var userManager = scope.ServiceProvider
                .GetRequiredService<UserManager<ApplicationUser>>();

            var configuration = scope.ServiceProvider
                .GetRequiredService<IConfiguration>();

            string? username = configuration["AdminInicial:Username"];
            string? password = configuration["AdminInicial:Password"];

            if (string.IsNullOrWhiteSpace(username) ||
                string.IsNullOrWhiteSpace(password))
            {
                throw new InvalidOperationException(
                    "Faltan las credenciales del administrador inicial.");
            }

            var existingUser = await userManager.FindByNameAsync(username);

            if (existingUser != null)
            {
                return;
            }

            var admin = new ApplicationUser
            {
                UserName = username,
                NombreCompleto = "Administrador del Sistema",
                Activo = true,
                DebeCambiarPassword = true
            };

            var result = await userManager.CreateAsync(admin, password);

            if (!result.Succeeded)
            {
                throw new InvalidOperationException(
                    "No se pudo crear el administrador: " +
                    string.Join(", ", result.Errors.Select(e => e.Description)));
            }

            var roleResult = await userManager.AddToRoleAsync(
                admin, "Administrador");

            if (!roleResult.Succeeded)
            {
                throw new InvalidOperationException(
                    "No se pudo asignar el rol Administrador: " +
                    string.Join(", ", roleResult.Errors.Select(e => e.Description)));
            }
        }
    }
}