# TODO: DHIS2 integration — deferred pending DHIS2 instance provisioning.
# Contract:
#   sync_to_dhis2(health_records_queryset) -> {synced, failed, errors}
#   pull_from_dhis2(since_date) -> list of TrackedEntityInstance dicts
# Reference: DHIS2 Web API v40, /api/tracker/events

raise NotImplementedError(
    'DHIS2 sync not implemented. Awaiting DHIS2 instance access. '
    'See SRS v2.0 §3.5 for the data mapping specification.'
)
