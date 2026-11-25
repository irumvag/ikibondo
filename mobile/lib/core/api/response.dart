/// The backend wraps lists as `{data: [...]}`, `{data: {results: [...]}}` or
/// plain DRF pages `{results: [...]}`, depending on the endpoint.
List<Map<String, dynamic>> unwrapList(dynamic body) {
  dynamic list = body;
  if (list is Map) list = list['data'] ?? list['results'] ?? list;
  if (list is Map) list = list['results'] ?? const [];
  if (list is! List) return const [];
  return list.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
}
