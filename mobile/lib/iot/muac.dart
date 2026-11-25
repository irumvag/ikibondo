import 'package:flutter/material.dart';
import '../core/theme/app_theme.dart';

/// On-device triage with the WHO cut-offs for children 6–59 months.
/// Works with no signal; the server's full risk score follows once the visit uploads.
class MuacBand {
  const MuacBand(this.label, this.color, this.background, this.action);

  final String label;
  final Color color;
  final Color background;
  final String action;

  static MuacBand? classify({double? muacCm, bool oedema = false}) {
    if (oedema) {
      return const MuacBand('Oedema: severe acute malnutrition', colorDanger, colorHighBg,
          'Refer to the health centre today.');
    }
    if (muacCm == null) return null;
    if (muacCm < 11.5) {
      return MuacBand('MUAC $muacCm cm: red band', colorDanger, colorHighBg, 'Refer to the health centre today.');
    }
    if (muacCm < 12.5) {
      return MuacBand('MUAC $muacCm cm: yellow band', colorWarn, colorMedBg,
          'Enrol in supplementary feeding and re-measure at the next visit.');
    }
    return MuacBand('MUAC $muacCm cm: green band', colorSuccess, colorLowBg, 'No acute malnutrition by MUAC.');
  }
}
