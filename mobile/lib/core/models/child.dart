class Child {
  final String id;
  final String registrationNumber;
  final String fullName;
  final String dateOfBirth;
  final String? ageDisplay;
  final int? ageMonths;
  final String sex;
  final String? campName;
  final String? zoneName;
  final String? guardianName;
  final String? guardianPhone;
  final String? assignedChwName;
  final String? assignedChwPhone;
  final String? riskLevel;
  final String? nutritionStatus;
  final String? nutritionStatusDisplay;
  final String? photo;
  final double? birthWeight;
  final String? feedingType;

  const Child({
    required this.id,
    required this.registrationNumber,
    required this.fullName,
    required this.dateOfBirth,
    this.ageDisplay,
    this.ageMonths,
    required this.sex,
    this.campName,
    this.zoneName,
    this.guardianName,
    this.guardianPhone,
    this.assignedChwName,
    this.assignedChwPhone,
    this.riskLevel,
    this.nutritionStatus,
    this.nutritionStatusDisplay,
    this.photo,
    this.birthWeight,
    this.feedingType,
  });

  factory Child.fromJson(Map<String, dynamic> json) => Child(
    id:                     json['id'] as String,
    registrationNumber:     json['registration_number'] as String? ?? '',
    fullName:               json['full_name'] as String,
    dateOfBirth:            json['date_of_birth'] as String,
    ageDisplay:             json['age_display'] as String?,
    ageMonths:              json['age_months'] as int?,
    sex:                    json['sex'] as String? ?? '',
    campName:               json['camp_name'] as String?,
    zoneName:               json['zone_name'] as String?,
    guardianName:           json['guardian_name'] as String?,
    guardianPhone:          json['guardian_phone'] as String?,
    assignedChwName:        json['assigned_chw_name'] as String?,
    assignedChwPhone:       json['assigned_chw_phone'] as String?,
    riskLevel:              json['risk_level'] as String?,
    nutritionStatus:        json['nutrition_status'] as String?,
    nutritionStatusDisplay: json['nutrition_status_display'] as String?,
    photo:                  json['photo'] as String?,
    birthWeight:            (json['birth_weight'] as num?)?.toDouble(),
    feedingType:            json['feeding_type'] as String?,
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'registration_number': registrationNumber,
    'full_name': fullName,
    'date_of_birth': dateOfBirth,
    'age_display': ageDisplay,
    'age_months': ageMonths,
    'sex': sex,
    'camp_name': campName,
    'zone_name': zoneName,
    'guardian_name': guardianName,
    'guardian_phone': guardianPhone,
    'assigned_chw_name': assignedChwName,
    'assigned_chw_phone': assignedChwPhone,
    'risk_level': riskLevel,
    'nutrition_status': nutritionStatus,
    'nutrition_status_display': nutritionStatusDisplay,
    'photo': photo,
    'birth_weight': birthWeight,
    'feeding_type': feedingType,
  };
}
