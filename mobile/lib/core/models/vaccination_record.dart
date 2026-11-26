class VaccinationRecord {
  final String id;
  final String childId;
  final String? childName;
  final String? vaccineName;
  final String? vaccineCode;
  final int? doseNumber;
  final String scheduledDate;
  final String? administeredDate;
  final String status; // SCHEDULED | DONE | MISSED | SKIPPED
  final bool isOverdue;
  final String? batchNumber;
  final String? notes;
  final double? dropoutProbability;
  final String? dropoutRiskTier;
  final String? guardianName;
  final String? guardianPhone;
  /// Full name, protects_against, how_given, after (server: vaccine_info.py)
  final Map<String, dynamic>? info;

  const VaccinationRecord({
    required this.id,
    required this.childId,
    this.childName,
    this.vaccineName,
    this.vaccineCode,
    this.doseNumber,
    required this.scheduledDate,
    this.administeredDate,
    required this.status,
    required this.isOverdue,
    this.batchNumber,
    this.notes,
    this.dropoutProbability,
    this.guardianName,
    this.guardianPhone,
    this.info,
    this.dropoutRiskTier,
  });

  factory VaccinationRecord.fromJson(Map<String, dynamic> json) =>
      VaccinationRecord(
        id:                  json['id'] as String,
        childId:             json['child'] as String,
        childName:           json['child_name'] as String?,
        vaccineName:         json['vaccine_name'] as String?,
        vaccineCode:         json['vaccine_code'] as String?,
        doseNumber:          json['dose_number'] as int?,
        scheduledDate:       json['scheduled_date'] as String,
        administeredDate:    json['administered_date'] as String?,
        status:              json['status'] as String? ?? 'SCHEDULED',
        isOverdue:           (json['is_overdue'] as bool?) ?? false,
        batchNumber:         json['batch_number'] as String?,
        notes:               json['notes'] as String?,
        guardianName:        json['guardian_name'] as String?,
        guardianPhone:       json['guardian_phone'] as String?,
        info:                json['vaccine_info'] is Map ? Map<String, dynamic>.from(json['vaccine_info'] as Map) : null,
        dropoutProbability:  double.tryParse('${json['dropout_probability'] ?? ''}'),
        dropoutRiskTier:     json['dropout_risk_tier'] as String?,
      );

  /// Round-trips with [fromJson] — used for offline caching and enqueueing.
  Map<String, dynamic> toJson() => {
        'id':                  id,
        'child':               childId,
        'child_name':          childName,
        'vaccine_name':        vaccineName,
        'vaccine_code':        vaccineCode,
        'dose_number':         doseNumber,
        'scheduled_date':      scheduledDate,
        'administered_date':   administeredDate,
        'status':              status,
        'is_overdue':          isOverdue,
        'batch_number':        batchNumber,
        'notes':               notes,
        'dropout_probability': dropoutProbability,
        'dropout_risk_tier':   dropoutRiskTier,
      };
}
