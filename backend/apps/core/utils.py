"""Small shared helpers for the core app."""


def safe_int(value, default, *, minimum=None, maximum=None):
    """Parse an int from an untrusted value (e.g. a query param), falling back to
    ``default`` on any parse error instead of raising (a bad ``?page=abc`` would
    otherwise crash the request with a 500). The result is then clamped into
    ``[minimum, maximum]`` when those bounds are provided.
    """
    try:
        result = int(value)
    except (TypeError, ValueError):
        result = default
    if minimum is not None:
        result = max(result, minimum)
    if maximum is not None:
        result = min(result, maximum)
    return result
