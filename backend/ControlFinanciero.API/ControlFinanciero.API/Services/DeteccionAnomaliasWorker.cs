
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace ControlFinanciero.API.Services
{
    public class DeteccionAnomaliasWorker : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<DeteccionAnomaliasWorker> _logger;

        public DeteccionAnomaliasWorker(
            IServiceScopeFactory scopeFactory,
            ILogger<DeteccionAnomaliasWorker> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(
            CancellationToken stoppingToken)
        {
            using var timer = new PeriodicTimer(
                TimeSpan.FromMinutes(1));

            try
            {
                while (await timer.WaitForNextTickAsync(stoppingToken))
                {
                    try
                    {
                        using var scope = _scopeFactory.CreateScope();

                        var servicio = scope.ServiceProvider
                            .GetRequiredService<DeteccionAnomaliasService>();

                        var cantidad = await servicio.DetectarAsync(
                            stoppingToken);

                        if (cantidad > 0)
                        {
                            _logger.LogInformation(
                                "Deteccion automatica: {Cantidad} alertas nuevas.",
                                cantidad);
                        }
                    }
                    catch (OperationCanceledException)
                        when (stoppingToken.IsCancellationRequested)
                    {
                        break;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(
                            ex,
                            "Error durante la deteccion automatica de anomalias.");
                    }
                }
            }
            catch (OperationCanceledException)
                when (stoppingToken.IsCancellationRequested)
            {
            }
        }
    }
}
