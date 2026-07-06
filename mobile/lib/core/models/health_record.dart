class HealthRecord {
  final String id;
  final String childId;
  final String? childName;
  final String measurementDate;
  final double? weightKg;
  final double? heightCm;
  final double? muacCm;
  final bool? oedema;
  final double? temperatureC;
  final int? respiratoryRate;
  final int? heartRate;
  final int? spo2;
  final List<String>? symptomFlags;
  final double? weightForHeightZ;
  final double? heightForAgeZ;
  final double? weightForAgeZ;
  final String? nutritionStatus;
  final String? nutritionStatusDisplay;
  final String? riskLevel;
  final dynamic riskFactors;
  final double? mlConfidence;
  final String? notes;
  final String? recordedByName;
  final String createdAt;

  const HealthRecord({
    required this.id,
    required this.childId,
    this.childName,
    required this.measurementDate,
    this.weightKg,
    this.heightCm,
    this.muacCm,
    this.oedema,
    this.temperatureC,
    this.respiratoryRate,
    this.heartRate,
    this.spo2,
    this.symptomFlags,
    this.weightForHeightZ,
    this.heightForAgeZ,
    this.weightForAgeZ,
    this.nutritionStatus,
    this.nutritionStatusDisplay,
    this.riskLevel,
    this.riskFactors,
    this.mlConfidence,
    this.notes,
    this.recordedByName,
    required this.createdAt,
  });

  factory HealthRecord.fromJson(Map<String, dynamic> json) => HealthRecord(
    id:                    json['id'] as String,
    childId:               json['child'] as String,
    childName:             json['child_name'] as String?,
    measurementDate:       json['measurement_date'] as String,
    weightKg:              (json['weight_kg'] as num?)?.toDouble(),
    heightCm:              (json['height_cm'] as num?)?.toDouble(),
    muacCm:                (json['muac_cm'] as num?)?.toDouble(),
    oedema:                json['oedema'] as bool?,
    temperatureC:          (json['temperature_c'] as num?)?.toDouble(),
    respiratoryRate:       json['respiratory_rate'] as int?,
    heartRate:             json['heart_rate'] as int?,
    spo2:                  json['spo2'] as int?,
    symptomFlags:          (json['symptom_flags'] as List?)?.cast<String>(),
    weightForHeightZ:      (json['weight_for_height_z'] as num?)?.toDouble(),
    heightForAgeZ:         (json['height_for_age_z'] as num?)?.toDouble(),
    weightForAgeZ:         (json['weight_for_age_z'] as num?)?.toDouble(),
    nutritionStatus:       json['nutrition_status'] as String?,
    nutritionStatusDisplay: json['nutrition_status_display'] as String?,
    riskLevel:             json['risk_level'] as String?,
    riskFactors:           json['risk_factors'],
    mlConfidence:          (json['ml_confidence'] as num?)?.toDouble(),
    notes:                 json['notes'] as String?,
    recordedByName:        json['recorded_by_name'] as String?,
    createdAt:             json['created_at'] as String,
  );

  Map<String, dynamic> toJson() => {
    'child': childId,
    'measurement_date': measurementDate,
    if (weightKg != null) 'weight_kg': weightKg,
    if (heightCm != null) 'height_cm': heightCm,
    if (muacCm != null) 'muac_cm': muacCm,
    if (oedema != null) 'oedema': oedema,
    if (temperatureC != null) 'temperature_c': temperatureC,
    if (respiratoryRate != null) 'respiratory_rate': respiratoryRate,
    if (heartRate != null) 'heart_rate': heartRate,
    if (spo2 != null) 'spo2': spo2,
    if (symptomFlags != null) 'symptom_flags': symptomFlags,
    if (notes != null) 'notes': notes,
  };
}

class GrowthPoint {
  final String date;
  final double? waz;
  final double? haz;
  final double? whz;
  final double? weight;
  final double? height;
  final double? muac;

  const GrowthPoint({
    required this.date,
    this.waz,
    this.haz,
    this.whz,
    this.weight,
    this.height,
    this.muac,
  });

  factory GrowthPoint.fromJson(Map<String, dynamic> json) => GrowthPoint(
    date:   json['date'] as String,
    waz:    (json['weight_for_age_z'] as num?)?.toDouble(),
    haz:    (json['height_for_age_z'] as num?)?.toDouble(),
    whz:    (json['weight_for_height_z'] as num?)?.toDouble(),
    weight: (json['weight_kg'] as num?)?.toDouble(),
    height: (json['height_cm'] as num?)?.toDouble(),
    muac:   (json['muac_cm'] as num?)?.toDouble(),
  );
}
