import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

// ── Design tokens — matches web CSS vars exactly ──────────────────────────
const Color colorInk     = Color(0xFF085041); // primary teal (--ink)
const Color colorCream   = Color(0xFFFFFDF7); // background   (--bg)
const Color colorGold    = Color(0xFFFBC800); // accent       (--accent)
const Color colorDanger  = Color(0xFFB91C1C); // danger       (--danger)
const Color colorSuccess = Color(0xFF16A34A); // success      (--success)
const Color colorWarn    = Color(0xFFD97706); // warning      (--warn)
const Color colorMuted   = Color(0xFF4B5563); // text muted   (--text-muted)
const Color colorBgElev  = Color(0xFFFFFFFF); // elevated bg  (--bg-elev)
const Color colorBgSand  = Color(0xFFF5F0E8); // sand bg      (--bg-sand)
const Color colorBorder  = Color(0xFFE5DDD0); // border       (--border)
const Color colorLowBg   = Color(0xFFDCFCE7); // low risk bg  (--low-bg)
const Color colorMedBg   = Color(0xFFFEF9C3); // medium risk  (--med-bg)
const Color colorHighBg  = Color(0xFFFEE2E2); // high risk    (--high-bg)

class AppTheme {
  static ThemeData get lightTheme {
    final base = ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: colorInk,
        primary: colorInk,
        secondary: colorGold,
        surface: colorCream,
        error: colorDanger,
        brightness: Brightness.light,
      ),
      scaffoldBackgroundColor: colorCream,
      appBarTheme: AppBarTheme(
        backgroundColor: colorInk,
        foregroundColor: colorCream,
        elevation: 0,
        titleTextStyle: GoogleFonts.inter(
          fontSize: 18,
          fontWeight: FontWeight.w600,
          color: colorCream,
        ),
      ),
      textTheme: GoogleFonts.interTextTheme().copyWith(
        headlineLarge: GoogleFonts.inter(
          fontSize: 28,
          fontWeight: FontWeight.w700,
          color: colorInk,
        ),
        headlineMedium: GoogleFonts.inter(
          fontSize: 22,
          fontWeight: FontWeight.w600,
          color: colorInk,
        ),
        titleLarge: GoogleFonts.inter(
          fontSize: 18,
          fontWeight: FontWeight.w600,
          color: colorInk,
        ),
        titleMedium: GoogleFonts.inter(
          fontSize: 16,
          fontWeight: FontWeight.w500,
          color: colorInk,
        ),
        bodyLarge: GoogleFonts.inter(fontSize: 16, color: const Color(0xFF1A1A1A)),
        bodyMedium: GoogleFonts.inter(fontSize: 14, color: const Color(0xFF333333)),
        bodySmall: GoogleFonts.inter(fontSize: 12, color: colorMuted),
        labelLarge: GoogleFonts.inter(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: colorCream,
        ),
      ),
      cardTheme: CardThemeData(
        color: colorBgElev,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: colorBorder),
        ),
        margin: EdgeInsets.zero,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: colorBgElev,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: colorBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: colorBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: colorInk, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: colorDanger),
        ),
        labelStyle: GoogleFonts.inter(color: colorMuted, fontSize: 14),
        hintStyle: GoogleFonts.inter(color: colorMuted, fontSize: 14),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: colorInk,
          foregroundColor: colorCream,
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          textStyle: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: colorInk,
          side: const BorderSide(color: colorInk),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          textStyle: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w500),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: colorBgSand,
        selectedColor: colorInk,
        labelStyle: GoogleFonts.inter(fontSize: 13),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: colorBgElev,
        selectedItemColor: colorInk,
        unselectedItemColor: colorMuted,
        elevation: 8,
        type: BottomNavigationBarType.fixed,
      ),
      dividerTheme: const DividerThemeData(color: colorBorder, thickness: 1),
    );
    return base;
  }
}

// ── Risk color helpers ─────────────────────────────────────────────────────
Color riskColor(String? riskLevel) {
  switch (riskLevel?.toUpperCase()) {
    case 'HIGH':   return colorDanger;
    case 'MEDIUM': return colorWarn;
    case 'LOW':    return colorSuccess;
    default:       return colorMuted;
  }
}

Color riskBgColor(String? riskLevel) {
  switch (riskLevel?.toUpperCase()) {
    case 'HIGH':   return colorHighBg;
    case 'MEDIUM': return colorMedBg;
    case 'LOW':    return colorLowBg;
    default:       return colorBgSand;
  }
}

Color nutritionColor(String? status) {
  switch (status?.toUpperCase()) {
    case 'SAM':    return colorDanger;
    case 'MAM':    return colorWarn;
    case 'NORMAL': return colorSuccess;
    default:       return colorMuted;
  }
}
