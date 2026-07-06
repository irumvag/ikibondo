import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/app_theme.dart';

class RiskBadge extends StatelessWidget {
  final String? riskLevel;
  final String? nutritionStatus;
  final bool compact;

  const RiskBadge({
    super.key,
    this.riskLevel,
    this.nutritionStatus,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    final label = nutritionStatus?.toUpperCase() ?? riskLevel?.toUpperCase() ?? '—';
    final color = nutritionStatus != null
        ? nutritionColor(nutritionStatus)
        : riskColor(riskLevel);
    final bg = nutritionStatus != null
        ? nutritionColor(nutritionStatus).withOpacity(0.12)
        : riskBgColor(riskLevel);

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 6 : 10,
        vertical: compact ? 2 : 4,
      ),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Text(
        label,
        style: GoogleFonts.inter(
          fontSize: compact ? 10 : 12,
          fontWeight: FontWeight.w700,
          color: color,
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}
