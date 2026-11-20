namespace FinanceTracker.Application.Common;

// Use cases throw these; the Api translates them into HTTP status codes (404, 409) in one place.
// Messages are in Portuguese because they are shown to the user.

/// <summary>The resource does not exist or belongs to another user (both are 404: never reveal other users' ids).</summary>
public sealed class NotFoundException(string resource) : Exception($"{resource} não encontrada.");

public sealed class ConflictException(string message) : Exception(message);
