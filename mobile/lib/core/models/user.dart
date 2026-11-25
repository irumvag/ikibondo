import 'dart:convert';

enum UserRole { admin, supervisor, nurse, chw, parent }

class AppUser {
  final String id;
  final String email;
  final String fullName;
  /// The role the person is acting as right now.
  final UserRole role;
  /// Every role the person holds (primary first). More than one enables "Switch role".
  final List<UserRole> roles;
  final String? phoneNumber;
  final String? campId;
  final String? campName;
  final bool isApproved;
  final bool mustChangePassword;
  final String? preferredLanguage;
  final String? guardianId;

  const AppUser({
    required this.id,
    required this.email,
    required this.fullName,
    required this.role,
    this.roles = const [],
    this.phoneNumber,
    this.campId,
    this.campName,
    required this.isApproved,
    required this.mustChangePassword,
    this.preferredLanguage,
    this.guardianId,
  });

  factory AppUser.fromJson(Map<String, dynamic> json) {
    return AppUser(
      id:                 json['id'] as String,
      email:              json['email'] as String,
      fullName:           json['full_name'] as String,
      role:               _parseRole(json['role'] as String),
      roles:              ((json['roles'] as List?) ?? const [])
          .map((r) => _parseRole('$r'))
          .toList(),
      phoneNumber:        json['phone_number'] as String?,
      campId:             json['camp'] as String?,
      campName:           json['camp_name'] as String?,
      isApproved:         (json['is_approved'] as bool?) ?? false,
      mustChangePassword: (json['must_change_password'] as bool?) ?? false,
      preferredLanguage:  json['preferred_language'] as String?,
      guardianId:         json['guardian_id'] as String?,
    );
  }

  /// Roles this person can switch between (always includes the active one).
  List<UserRole> get switchableRoles => roles.isEmpty ? [role] : roles;

  /// Backend value for a role, e.g. UserRole.nurse -> 'NURSE'.
  static String apiValue(UserRole r) => r.name.toUpperCase();

  static UserRole _parseRole(String r) {
    switch (r.toUpperCase()) {
      case 'ADMIN':      return UserRole.admin;
      case 'SUPERVISOR': return UserRole.supervisor;
      case 'NURSE':      return UserRole.nurse;
      case 'CHW':        return UserRole.chw;
      default:           return UserRole.parent;
    }
  }

  /// Round-trips with [fromJson] — same convention as the other models.
  Map<String, dynamic> toJson() => {
    'id': id,
    'email': email,
    'full_name': fullName,
    'role': role.name.toUpperCase(),
    'roles': roles.map((r) => r.name.toUpperCase()).toList(),
    'phone_number': phoneNumber,
    'camp': campId,
    'camp_name': campName,
    'is_approved': isApproved,
    'must_change_password': mustChangePassword,
    'preferred_language': preferredLanguage,
    'guardian_id': guardianId,
  };

  String toJsonString() => jsonEncode(toJson());

  factory AppUser.fromJsonString(String s) =>
      AppUser.fromJson(jsonDecode(s) as Map<String, dynamic>);

  String get initials {
    final parts = fullName.trim().split(' ');
    if (parts.length >= 2) return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    return fullName.isNotEmpty ? fullName[0].toUpperCase() : '?';
  }
}
