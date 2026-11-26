import 'dart:ui' show ImageFilter;
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/app_theme.dart';

/// The Ikibondo mark: a rising growth curve on a blue tile (same motif as the
/// launcher icon), optionally followed by the name.
class IkibondoLogo extends StatelessWidget {
  final double size;
  final bool showName;
  final Color nameColor;

  const IkibondoLogo(
      {super.key,
      this.size = 44,
      this.showName = true,
      this.nameColor = colorInk});

  @override
  Widget build(BuildContext context) {
    final mark = Semantics(
      label: 'Ikibondo',
      child: SizedBox.square(
          dimension: size, child: CustomPaint(painter: _MarkPainter())),
    );
    if (!showName) return mark;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        mark,
        SizedBox(width: size * 0.28),
        Text(
          'Ikibondo',
          style: GoogleFonts.inter(
            fontSize: size * 0.62,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.5,
            color: nameColor,
          ),
        ),
      ],
    );
  }
}

class _MarkPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width;
    final tile =
        RRect.fromRectAndRadius(Offset.zero & size, Radius.circular(s * 0.28));
    canvas.drawRRect(
      tile,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [colorSky, colorInk],
        ).createShader(Offset.zero & size),
    );

    // Growth curve: low left, rising to the right
    final pts = [
      Offset(s * 0.20, s * 0.74),
      Offset(s * 0.36, s * 0.56),
      Offset(s * 0.52, s * 0.48),
      Offset(s * 0.68, s * 0.36),
    ];
    final path = Path()..moveTo(pts.first.dx, pts.first.dy);
    for (final p in pts.skip(1)) {
      path.lineTo(p.dx, p.dy);
    }
    canvas.drawPath(
      path,
      Paint()
        ..color = Colors.white
        ..style = PaintingStyle.stroke
        ..strokeWidth = s * 0.075
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
    for (final p in pts.sublist(1, 3)) {
      canvas.drawCircle(p, s * 0.055, Paint()..color = Colors.white);
    }
    canvas.drawCircle(
        Offset(s * 0.76, s * 0.30), s * 0.11, Paint()..color = colorGold);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Frosted-glass panel: blurs what is behind it. Use on a coloured or
/// gradient background, otherwise the effect is invisible.
class GlassCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final double radius;
  final double opacity;

  const GlassCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.radius = 20,
    this.opacity = 0.62,
  });

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
        child: Container(
          padding: padding,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: opacity),
            borderRadius: BorderRadius.circular(radius),
            border: Border.all(color: Colors.white.withValues(alpha: 0.7)),
          ),
          child: child,
        ),
      ),
    );
  }
}

/// Soft blue background with blurred colour blobs, for screens that use [GlassCard].
class GlassBackground extends StatelessWidget {
  final Widget child;
  const GlassBackground({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    Widget blob(Color c, double size) => Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
              shape: BoxShape.circle, color: c.withValues(alpha: 0.18)),
        );
    return Stack(
      children: [
        const Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Color(0xFFE3EEFB), colorCream],
              ),
            ),
          ),
        ),
        Positioned(top: -60, right: -40, child: blob(colorSky, 220)),
        Positioned(top: 260, left: -70, child: blob(colorGold, 200)),
        Positioned(bottom: -40, right: -30, child: blob(colorInk, 180)),
        Positioned.fill(child: child),
      ],
    );
  }
}
