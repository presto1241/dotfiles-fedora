#!/usr/bin/env python3
"""Derive every non-GTK toolkit's colour config from a theme pack's palette.css.

    derive.py kdeglobals <palette.css>
    derive.py kvantum    <palette.css> <base.kvconfig>
    derive.py kitty      <palette.css>

palette.css is the single place a colour is written down. Qt, Kvantum and
kitty cannot read CSS, so their values are generated from it here rather than
maintained by hand in three more files that then drift apart.
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import palette as pal


# ── kdeglobals ────────────────────────────────────────────────────────────────
# GTK name -> KDE colour role. Not a perfect 1:1 mapping between the two
# models; these are the roles that actually decide how an app reads.
#
# Note these mostly do NOT decide Qt widget colours - Kvantum overrides them
# (measured: Colors:Window set to magenta left the palette at #101010). What
# they still decide is QStyleHints::colorScheme(), which is what made Dolphin
# draw white rows on a dark palette, and they become the real palette if
# Kvantum is ever not the style.
KDE_MAP = [
    ("Colors:Window",        "BackgroundNormal",   ("theme_bg_color",)),
    ("Colors:Window",        "ForegroundNormal",   ("theme_fg_color",)),
    ("Colors:Window",        "ForegroundInactive", ("insensitive_fg_color",)),
    ("Colors:View",          "BackgroundNormal",   ("theme_base_color",)),
    ("Colors:View",          "ForegroundNormal",   ("theme_text_color", "theme_fg_color")),
    ("Colors:View",          "ForegroundInactive", ("insensitive_fg_color",)),
    ("Colors:Button",        "BackgroundNormal",   ("button_bg_color", "card_bg_color",
                                                    "theme_base_color")),
    ("Colors:Button",        "ForegroundNormal",   ("button_fg_color", "theme_fg_color")),
    ("Colors:Selection",     "BackgroundNormal",   ("theme_selected_bg_color",)),
    ("Colors:Selection",     "ForegroundNormal",   ("theme_selected_fg_color",)),
    ("Colors:Tooltip",       "BackgroundNormal",   ("popover_bg_color", "theme_base_color")),
    ("Colors:Tooltip",       "ForegroundNormal",   ("popover_fg_color", "theme_fg_color")),
    ("Colors:Complementary", "BackgroundNormal",   ("theme_bg_color",)),
    ("Colors:Complementary", "ForegroundNormal",   ("theme_fg_color",)),
]

# Focus rings and hover tints. Derived rather than hand-written in the pack's
# kdeglobals, which is where they used to live as a literal 110,118,129 - a
# second copy of the accent that silently stopped matching the moment
# palette.css changed.
for _g in ("Colors:Window", "Colors:View", "Colors:Button",
           "Colors:Selection", "Colors:Tooltip", "Colors:Complementary"):
    KDE_MAP.append((_g, "DecorationFocus", ("accent_bg_color", "theme_selected_bg_color")))
    KDE_MAP.append((_g, "DecorationHover", ("accent_bg_color", "theme_selected_bg_color")))


def do_kdeglobals(colors):
    for group, key, names in KDE_MAP:
        rgb = pal.first(colors, *names)
        if rgb:
            print(f"{group}|{key}|{rgb[0]},{rgb[1]},{rgb[2]}")


# ── Kvantum ───────────────────────────────────────────────────────────────────
# Kvantum's [GeneralColors] is what Qt actually obeys - it overrides kdeglobals
# entirely. Dolphin's grey selection came from highlight.color=#808080 here,
# not from anything in palette.css. So these keys have to be generated too, or
# palette.css simply cannot reach a Qt app.
#
# Only keys with a real palette equivalent are rewritten. light/mid/dark are
# structural shading that belongs to the Kvantum theme's SVG, and are left
# exactly as the base theme set them.
KV_MAP = {
    "window.color":                  ("theme_bg_color",),
    # ── These two do NOT reach Dolphin. Measured, do not chase it again. ──
    #
    # The obvious way to make Dolphin's file list match Nautilus's is to point
    # base.color at theme_bg_color, since overrides.css makes Nautilus's
    # listview transparent so it falls through to the window background.
    # It does nothing. Probed by setting each key to a vivid colour and
    # restarting Dolphin from a cold process every time:
    #
    #   Kvantum base.color      = #cf5f5f red    -> view stayed neutral
    #   Kvantum alt.base.color  = #6fa96f green  -> view stayed neutral
    #   Kvantum window.color    = #cf5f5f red    -> view stayed neutral
    #   Kvantum highlight.color = #6fa96f green  -> selection stayed grey
    #   kdeglobals Colors:View  = #cf5f5f red    -> view stayed neutral
    #
    # [Hacks] transparent_dolphin_view=true makes the view transparent, so it
    # shows the window beneath - and that window fill comes from the theme's
    # SVG, not from any colour key. Everything visible in Dolphin's content
    # area is painted by NoMansSky.svg. Reaching it needs the SVG recoloured
    # the way recolor.py already recolours Juno's assets.
    #
    # So these stay on the roles they actually describe, for the Qt apps that
    # have no such hack and do read them.
    "base.color":                    ("theme_base_color",),
    "alt.base.color":                ("card_bg_color", "theme_base_color"),
    "button.color":                  ("button_bg_color", "card_bg_color"),
    "highlight.color":               ("theme_selected_bg_color", "accent_bg_color"),
    "inactive.highlight.color":      ("accent_dark_color", "insensitive_bg_color"),
    "text.color":                    ("theme_text_color", "theme_fg_color"),
    "window.text.color":             ("theme_fg_color",),
    "button.text.color":             ("button_fg_color", "theme_fg_color"),
    "tooltip.text.color":            ("popover_fg_color", "theme_fg_color"),
    "highlight.text.color":          ("theme_selected_fg_color",),
    "disabled.text.color":           ("insensitive_fg_color",),
    "progress.indicator.text.color": ("theme_fg_color",),
    "link.color":                    ("accent_color", "accent_bg_color"),
    "link.visited.color":            ("insensitive_fg_color",),
}

_KV_LINE = re.compile(r'^(\s*)([A-Za-z0-9_.]+)(\s*=\s*)#([0-9A-Fa-f]{6})([0-9A-Fa-f]{2})?\s*$')


def do_kvantum(colors, base):
    """Rewrite [GeneralColors] in a Kvantum config, preserving everything else.

    The base theme's ALPHA is kept where it had one - base.color=#101010a0 is
    what makes Kvantum windows translucent, and palette.css has no way to
    express that, so dropping it would quietly make every Qt window opaque.
    """
    in_general = False
    with open(base) as fh:
        for raw in fh:
            line = raw.rstrip('\n')
            if line.startswith('['):
                in_general = line.strip() == '[GeneralColors]'
                print(line)
                continue
            m = _KV_LINE.match(line) if in_general else None
            if not m:
                print(line)
                continue
            indent, key, sep, _hex, alpha = m.groups()
            rgb = pal.first(colors, *KV_MAP.get(key, ()))
            if rgb is None:
                print(line)
            else:
                print(f"{indent}{key}{sep}{pal.hex6(rgb)}{alpha or ''}")


# ── kitty ─────────────────────────────────────────────────────────────────────
KITTY_BASIC = [
    ("background",           ("term_background", "theme_bg_color")),
    ("foreground",           ("term_foreground", "theme_fg_color")),
    ("cursor",               ("term_cursor", "theme_fg_color")),
    ("cursor_text_color",    ("term_background", "theme_bg_color")),
    ("selection_background", ("term_selection_bg", "theme_selected_bg_color")),
    ("selection_foreground", ("term_selection_fg", "theme_selected_fg_color")),
    ("url_color",            ("term_url", "accent_color")),
    ("active_border_color",  ("accent_bg_color", "theme_selected_bg_color")),
    ("inactive_border_color", ("borders",)),
    ("active_tab_background", ("accent_bg_color", "theme_selected_bg_color")),
    ("active_tab_foreground", ("theme_selected_fg_color",)),
    ("inactive_tab_background", ("theme_base_color",)),
    ("inactive_tab_foreground", ("insensitive_fg_color",)),
]


def do_kitty(colors):
    print("# GENERATED by ~/.config/themes/lib/derive.py from the theme pack's")
    print("# palette.css - do not edit. Put per-theme overrides in the pack's")
    print("# kitty.conf, which apply.sh appends after this.")
    print()
    for key, names in KITTY_BASIC:
        rgb = pal.first(colors, *names)
        if rgb:
            print(f"{key:<24} {pal.hex6(rgb)}")
    print()
    missing = []
    for i in range(16):
        rgb = pal.first(colors, f"term_color{i}")
        if rgb is None:
            missing.append(i)
            continue
        print(f"color{i:<19} {pal.hex6(rgb)}")
    if missing:
        print(f"derive: palette.css defines no term_color{{{','.join(map(str, missing))}}}"
              " - kitty keeps its built-in ANSI colours for those",
              file=sys.stderr)


def main():
    cmd = sys.argv[1]
    colors = pal.load(sys.argv[2])
    if cmd == "kdeglobals":
        do_kdeglobals(colors)
    elif cmd == "kvantum":
        do_kvantum(colors, sys.argv[3])
    elif cmd == "kitty":
        do_kitty(colors)
    else:
        sys.exit(f"derive: unknown subcommand: {cmd}")


if __name__ == "__main__":
    main()
