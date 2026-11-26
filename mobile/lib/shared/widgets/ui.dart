import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/app_theme.dart';

/// Shared building blocks so every role's screens look alike (the parent
/// screens set the pattern): gradient header, soft cards, tiles, empty states.

/// Blue gradient card at the top of a home screen.
class HeroHeader extends StatelessWidget {
  final String title;
  final String? subtitle;
  final IconData? icon;
  final Widget? trailing;
  const HeroHeader({super.key, required this.title, this.subtitle, this.icon, this.trailing});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          gradient: const LinearGradient(
              colors: [colorInk, colorSky], begin: Alignment.topLeft, end: Alignment.bottomRight),
          boxShadow: softShadow,
        ),
        child: Row(
          children: [
            if (icon != null) ...[
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.18), borderRadius: BorderRadius.circular(14)),
                child: Icon(icon, color: Colors.white, size: 24),
              ),
              const SizedBox(width: 14),
            ],
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: GoogleFonts.inter(fontSize: 19, fontWeight: FontWeight.w800, color: Colors.white)),
                  if (subtitle != null) ...[
                    const SizedBox(height: 3),
                    Text(subtitle!,
                        style: GoogleFonts.inter(fontSize: 13, color: Colors.white.withValues(alpha: 0.88))),
                  ],
                ],
              ),
            ),
            if (trailing != null) trailing!,
          ],
        ),
      );
}

class SectionTitle extends StatelessWidget {
  final String text;
  final String? action;
  final VoidCallback? onAction;
  const SectionTitle(this.text, {super.key, this.action, this.onAction});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(4, 6, 0, 8),
        child: Row(
          children: [
            Expanded(
              child: Text(text, style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w700, color: colorInk)),
            ),
            if (action != null) TextButton(onPressed: onAction, child: Text(action!)),
          ],
        ),
      );
}

/// White card with a soft shadow; tappable when [onTap] is set.
class SoftCard extends StatelessWidget {
  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;
  final Color? accent; // coloured left edge, e.g. for urgent items
  const SoftCard({super.key, required this.child, this.onTap, this.accent,
      this.padding = const EdgeInsets.all(14)});

  @override
  Widget build(BuildContext context) => Material(
        color: colorBgElev,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Container(
            padding: padding,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              boxShadow: softShadow,
              border: accent == null ? null : Border(left: BorderSide(color: accent!, width: 4)),
            ),
            child: child,
          ),
        ),
      );
}

/// Number + label tile for a dashboard row.
class StatTile extends StatelessWidget {
  final IconData icon;
  final String value;
  final String label;
  final Color color;
  final VoidCallback? onTap;
  const StatTile({super.key, required this.icon, required this.value, required this.label,
      this.color = colorInk, this.onTap});

  @override
  Widget build(BuildContext context) => Expanded(
        child: SoftCard(
          onTap: onTap,
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(7),
                decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)),
                child: Icon(icon, size: 18, color: color),
              ),
              const SizedBox(height: 10),
              Text(value, style: GoogleFonts.inter(fontSize: 22, fontWeight: FontWeight.w800, color: colorInk)),
              Text(label, style: GoogleFonts.inter(fontSize: 11.5, color: colorMuted)),
            ],
          ),
        ),
      );
}

/// Icon + label shortcut tile; [badge] shows a count in the corner.
class ActionTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final int badge;
  const ActionTile({super.key, required this.icon, required this.label, required this.onTap, this.badge = 0});

  @override
  Widget build(BuildContext context) => Expanded(
        child: SoftCard(
          onTap: onTap,
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 6),
          child: Column(
            children: [
              Badge(
                isLabelVisible: badge > 0,
                label: Text('$badge'),
                backgroundColor: colorDanger,
                child: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(color: colorBgSand, borderRadius: BorderRadius.circular(12)),
                  child: Icon(icon, color: colorInk, size: 22),
                ),
              ),
              const SizedBox(height: 7),
              Text(label,
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: colorInk, height: 1.2)),
            ],
          ),
        ),
      );
}

/// Round initial for a person or child.
class InitialAvatar extends StatelessWidget {
  final String name;
  final double radius;
  const InitialAvatar(this.name, {super.key, this.radius = 22});

  @override
  Widget build(BuildContext context) => CircleAvatar(
        radius: radius,
        backgroundColor: colorBgSand,
        child: Text(name.isNotEmpty ? name[0].toUpperCase() : '?',
            style: GoogleFonts.inter(fontSize: radius * 0.8, fontWeight: FontWeight.w800, color: colorInk)),
      );
}

class EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? text;
  const EmptyState({super.key, required this.icon, required this.title, this.text});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 24),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(18),
              decoration: const BoxDecoration(color: colorBgSand, shape: BoxShape.circle),
              child: Icon(icon, size: 34, color: colorInk),
            ),
            const SizedBox(height: 14),
            Text(title,
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700, color: colorInk)),
            if (text != null) ...[
              const SizedBox(height: 4),
              Text(text!, textAlign: TextAlign.center, style: GoogleFonts.inter(fontSize: 13, color: colorMuted)),
            ],
          ],
        ),
      );
}

/// Small coloured pill: status labels in lists.
class StatusPill extends StatelessWidget {
  final String text;
  final Color color;
  const StatusPill(this.text, {super.key, required this.color});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
        decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
        child: Text(text, style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w700, color: color)),
      );
}
