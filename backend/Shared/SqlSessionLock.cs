using System.Data.Common;

namespace Shared;

// Serializes outbox dispatch across replicas without holding a database transaction over the network.
public sealed class SqlSessionLock(DbConnection connection, string resource) : IAsyncDisposable
{
    private bool acquired;
    public async Task<bool> Acquire(CancellationToken ct)
    {
        await connection.OpenAsync(ct);
        await using var command = connection.CreateCommand();
        command.CommandText = "DECLARE @r int; EXEC @r=sys.sp_getapplock @Resource=@resource, @LockMode='Exclusive', @LockOwner='Session', @LockTimeout=0; SELECT @r;";
        var p = command.CreateParameter(); p.ParameterName = "@resource"; p.Value = resource; command.Parameters.Add(p);
        acquired = Convert.ToInt32(await command.ExecuteScalarAsync(ct)) >= 0;
        return acquired;
    }
    public async ValueTask DisposeAsync()
    {
        try
        {
            if (!acquired) return;
            await using var command = connection.CreateCommand();
            command.CommandText = "EXEC sys.sp_releaseapplock @Resource=@resource, @LockOwner='Session';";
            var p = command.CreateParameter(); p.ParameterName = "@resource"; p.Value = resource; command.Parameters.Add(p);
            await command.ExecuteNonQueryAsync(CancellationToken.None);
        }
        finally { await connection.CloseAsync(); }
    }
}
