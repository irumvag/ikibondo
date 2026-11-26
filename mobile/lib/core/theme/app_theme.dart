import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

// ── Design tokens — clinical palette: white surfaces, medical blue, teal accent ──
const Color colorInk     = Color(0xFF0E4C92); // primary medical blue (bars, headings, buttons)
const Color colorCream   = Color(0xFFF4F8FC); // page background; also text on blue
const Color colorGold    = Color(0xFF0EA5A4); // accent teal (scan, add, highlights)
const Color colorDanger  = Color(0xFFC62828); // danger
const Color colorSuccess = Color(0xFF15803D); // success
const Color colorWarn    = Color(0xFFB45309); // warning
const Color colorMuted   = Color(0xFF5B6B7F); // secondary text
const Color colorBgElev  = Color(0xFFFFFFFF); // cards
const Color colorBgSand  = Color(0xFFEAF1F8); // tinted panels, chips
const Color colorBorder  = Color(0xFFDCE6F1); // hairlines
const Color colorLowBg   = Color(0xFFDCFCE7); // low risk bg
const Color colorMedBg   = Color(0xFFFEF3C7); // medium risk bg
const Color colorHighBg  = Color(0xFFFEE2E2); // high risk bg
const Color colorSky     = Color(0xFF3B82F6); // lighter blue for gradients

/// Soft shadow for cards: separates them from the page without a hard outline.
const List<BoxShadow> softShadow = [
  BoxShadow(color: Color(0x140E4C92), blurRadius: 18, offset: Offset(0, 6)),
];

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
        elevation: 2,
        shadowColor: const Color(0x220E4C92),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
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
        // Explicit colour: chips otherwise inherit labelLarge, which is white (for buttons)
        labelStyle: GoogleFonts.inter(fontSize: 13, color: colorInk),
        side: const BorderSide(color: colorBorder),
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
