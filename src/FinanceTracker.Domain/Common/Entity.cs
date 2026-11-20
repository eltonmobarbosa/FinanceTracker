namespace FinanceTracker.Domain.Common;

/// <summary>Base for every persisted entity. The database generates the Id (IDENTITY column).</summary>
public abstract class Entity
{
    public int Id { get; private set; }
}
