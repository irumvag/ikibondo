class AppNotification {
  final String id;
  final String notificationType;
  final String message;
  final bool isRead;
  final String? childId;
  final String? childName;
  final String createdAt;

  const AppNotification({
    required this.id,
    required this.notificationType,
    required this.message,
    required this.isRead,
    this.childId,
    this.childName,
    required this.createdAt,
  });

  factory AppNotification.fromJson(Map<String, dynamic> json) =>
      AppNotification(
        id:               json['id'] as String,
        notificationType: json['notification_type'] as String? ?? '',
        message:          json['message'] as String? ?? '',
        isRead:           (json['is_read'] as bool?) ?? false,
        childId:          json['child'] as String?,
        childName:        json['child_name'] as String?,
        createdAt:        json['created_at'] as String,
      );

  /// Round-trips with [fromJson] — used for offline caching.
  Map<String, dynamic> toJson() => {
        'id':                id,
        'notification_type': notificationType,
        'message':           message,
        'is_read':           isRead,
        'child':             childId,
        'child_name':        childName,
        'created_at':        createdAt,
      };

  bool get isHighRisk => notificationType.contains('HIGH_RISK') ||
      notificationType.contains('SAM');
  bool get isVaccination => notificationType.contains('VACCINATION');
}
