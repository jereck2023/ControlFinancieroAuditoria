using ControlFinanciero.API.DTOs;
using ControlFinanciero.API.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;

namespace ControlFinanciero.API.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IConfiguration _configuration;

        public AuthController(
            UserManager<ApplicationUser> userManager,
            IConfiguration configuration)
        {
            _userManager = userManager;
            _configuration = configuration;
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login(LoginRequest request)
        {
            var user = await _userManager.FindByNameAsync(request.Username);

            if (user == null || !user.Activo)
            {
                return Unauthorized(new
                {
                    mensaje = "Usuario o contraseña incorrectos."
                });
            }

            if (await _userManager.IsLockedOutAsync(user))
            {
                return Unauthorized(new
                {
                    mensaje = "Cuenta bloqueada temporalmente."
                });
            }

            var passwordValida = await _userManager.CheckPasswordAsync(
                user, request.Password);

            if (!passwordValida)
            {
                var resultado = await _userManager.AccessFailedAsync(user);

                return Unauthorized(new
                {
                    mensaje = "Usuario o contraseña incorrectos."
                });
            }

            await _userManager.ResetAccessFailedCountAsync(user);

            var roles = await _userManager.GetRolesAsync(user);

            var claims = new List<Claim>
            {
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.UniqueName, user.UserName!),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
                new Claim(
                    "SecurityStamp",
                    await _userManager.GetSecurityStampAsync(user)),
                new Claim(
                    "DebeCambiarPassword",
                    user.DebeCambiarPassword.ToString().ToLowerInvariant())
            };

            foreach (var rol in roles)
            {
                claims.Add(new Claim(ClaimTypes.Role, rol));
            }

            var jwtKey = _configuration["Jwt:Key"]
                ?? throw new InvalidOperationException(
                    "No se configuró la clave JWT.");

            var securityKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwtKey));

            var credentials = new SigningCredentials(
                securityKey,
                SecurityAlgorithms.HmacSha256);

            var expirationMinutes = _configuration.GetValue<int>(
                "Jwt:ExpirationMinutes");

            if (expirationMinutes <= 0)
            {
                throw new InvalidOperationException(
                    "La duración del token JWT no es válida.");
            }

            var expiration = DateTime.UtcNow.AddMinutes(expirationMinutes);

            var token = new JwtSecurityToken(
                issuer: _configuration["Jwt:Issuer"],
                audience: _configuration["Jwt:Audience"],
                claims: claims,
                expires: expiration,
                signingCredentials: credentials
            );

            var tokenString = new JwtSecurityTokenHandler()
                .WriteToken(token);

            return Ok(new
            {
                mensaje = "Inicio de sesión correcto.",
                token = tokenString,
                expiracion = expiration,
                usuario = user.UserName,
                roles = roles,
                debeCambiarPassword = user.DebeCambiarPassword
            });
        }

        [Authorize]
        [HttpPost("cambiar-password")]
        public async Task<IActionResult> CambiarPassword(
            CambiarPasswordRequest request)
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;

            if (string.IsNullOrWhiteSpace(userId))
            {
                return Unauthorized(new
                {
                    mensaje = "No se pudo identificar al usuario."
                });
            }

            var user = await _userManager.FindByIdAsync(userId);

            if (user == null || !user.Activo)
            {
                return Unauthorized(new
                {
                    mensaje = "Usuario no autorizado."
                });
            }

            var resultado = await _userManager.ChangePasswordAsync(
                user,
                request.PasswordActual,
                request.PasswordNueva);

            if (!resultado.Succeeded)
            {
                return BadRequest(new
                {
                    mensaje = "No se pudo cambiar la contraseña.",
                    errores = resultado.Errors.Select(e => e.Description)
                });
            }

            user.DebeCambiarPassword = false;

            var actualizacion = await _userManager.UpdateAsync(user);

            if (!actualizacion.Succeeded)
            {
                return StatusCode(500, new
                {
                    mensaje = "La contraseña cambió, pero no se pudo actualizar el estado del usuario."
                });
            }

            return Ok(new
            {
                mensaje = "Contraseña actualizada correctamente. Inicie sesión nuevamente."
            });
        }
    }
}