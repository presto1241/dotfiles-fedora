#!/usr/bin/env python3
"""Generate a recoloured copy of an upstream GTK stylesheet.

    recolor.py <upstream.css> <palette.css> <recolor.map> <outdir> <tag>

Prints the path of the generated stylesheet on stdout.

WHY: palette.css only reaches themes that actually reference GTK's named
colours. A theme compiled from SASS inlines its accent as a literal instead
(Juno-ocean-v40: #00A9A5 appears 112 times, @theme_selected_bg_color once),
so redefining the name changes nothing. This rewrites the literals.

~/.themes is never touched - everything is written under <outdir>.

Two things get rewritten:

  1. the stylesheet    #RRGGBB and rgba(r, g, b, a) forms, alpha preserved
  2. the PNG assets    nearest-colour within RADIUS, alpha preserved, because
                       the assets carry their own baked colours that no CSS
                       edit can reach

Relative url("../assets/x.png") references are rewritten to absolute paths so
the generated file can live outside the theme directory.
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import palette as pal

# Nearest-colour radius for assets. Antialiased edges keep the base RGB and
# vary only in alpha, so this only needs to absorb the odd off-by-one
# (#d08771, #d0876f). Kept well below the distance between any two mapped
# source colours - the closest pair measured is 42 apart.
RADIUS = 30


def load_map(path, colors):
    """[(src_rgb, dst_rgb)], skipping entries palette.css does not define."""
    out, bad = [], []
    with open(path) as fh:
        for line in fh:
            line = line.split('#', 1)[0].strip() if not line.lstrip().startswith('#') else ''
            # a trailing "# comment" is stripped above; a full-line one is skipped
            if not line:
                continue
            parts = line.split()
            if len(parts) < 2:
                continue
            src, name = parts[0], parts[1]
            if not re.fullmatch(r'[0-9A-Fa-f]{6}', src):
                continue
            if name not in colors:
                bad.append((src, name))
                continue
            out.append((tuple(int(src[i:i + 2], 16) for i in (0, 2, 4)), colors[name]))
    for src, name in bad:
        print(f"recolor: #{src} -> {name}: no such colour in palette.css, skipped",
              file=sys.stderr)
    return out


def recolor_css(src_text, mapping, assets_from, assets_to):
    by_hex = {pal.hex6(s): d for s, d in mapping}

    def sub_hex(m):
        d = by_hex.get(m.group(0).lower())
        return pal.hex6(d) if d else m.group(0)

    def sub_rgba(m):
        key = pal.hex6((int(m.group('r')), int(m.group('g')), int(m.group('b'))))
        d = by_hex.get(key)
        if not d:
            return m.group(0)
        return f"{m.group('fn')}({d[0]}, {d[1]}, {d[2]}{m.group('rest')})"

    text = re.sub(r'#[0-9A-Fa-f]{6}\b', sub_hex, src_text)
    text = re.sub(r'(?P<fn>rgba?)\(\s*(?P<r>\d{1,3})\s*,\s*(?P<g>\d{1,3})\s*,'
                  r'\s*(?P<b>\d{1,3})(?P<rest>\s*(?:,[^)]*)?)\)', sub_rgba, text)

    def sub_url(m):
        ref = m.group(1)
        if '://' in ref or ref.startswith('/'):
            return m.group(0)
        real = os.path.normpath(os.path.join(assets_from, ref))
        moved = os.path.join(assets_to, os.path.basename(real))
        return 'url("%s")' % (moved if os.path.exists(moved) else real)

    return re.sub(r'url\("([^"]+)"\)', sub_url, text)


def _recolor_svg(src, dst, mapping):
    """Text-substitute a mapped colour in an SVG. Returns True if it changed.

    Themes mix SVG and PNG assets freely - Juno draws its switch from
    switch-on.svg while the checkboxes next to it are PNGs - so skipping SVGs
    left exactly one widget still wearing the old accent.

    Substitution is by literal, so the many unrelated colours in these files
    (colour-picker swatches, battery and checkmark icons: 50 distinct saturated
    values, none of them theme colours) are left alone.
    """
    by_hex = {pal.hex6(s): d for s, d in mapping}

    def sub_hex(m):
        d = by_hex.get(m.group(0).lower())
        return pal.hex6(d) if d else m.group(0)

    def sub_rgb(m):
        d = by_hex.get(pal.hex6((int(m.group('r')), int(m.group('g')), int(m.group('b')))))
        if not d:
            return m.group(0)
        return f"{m.group('fn')}({d[0]},{d[1]},{d[2]}{m.group('rest')})"

    with open(src, encoding='utf-8', errors='surrogateescape') as fh:
        text = fh.read()
    out = re.sub(r'#[0-9A-Fa-f]{6}\b', sub_hex, text)
    out = re.sub(r'(?P<fn>rgba?)\(\s*(?P<r>\d{1,3})\s*,\s*(?P<g>\d{1,3})\s*,'
                 r'\s*(?P<b>\d{1,3})(?P<rest>\s*(?:,[^)]*)?)\)', sub_rgb, out)
    if out == text:
        return False
    with open(dst, 'w', encoding='utf-8', errors='surrogateescape') as fh:
        fh.write(out)
    return True


def recolor_assets(src_dir, dst_dir, mapping):
    """Recolour every PNG and SVG that contains a mapped colour. Returns count."""
    try:
        from PIL import Image
    except ImportError:
        Image = None
        print("recolor: python3-pillow not installed - PNG assets left at "
              "their original colours (checkboxes, radios and window buttons "
              "will not follow the palette). SVGs are still recoloured.",
              file=sys.stderr)
    if not os.path.isdir(src_dir):
        return 0
    os.makedirs(dst_dir, exist_ok=True)
    r2 = RADIUS * RADIUS
    changed = 0
    for name in os.listdir(src_dir):
        src = os.path.join(src_dir, name)
        dst = os.path.join(dst_dir, name)
        low = name.lower()
        if low.endswith('.svg'):
            if _recolor_svg(src, dst, mapping):
                changed += 1
            elif not os.path.lexists(dst):
                os.symlink(os.path.abspath(src), dst)
            continue
        if not low.endswith('.png') or Image is None:
            continue
        im = Image.open(src).convert('RGBA')
        # get_flattened_data() is the Pillow 12+ spelling; getdata() is
        # deprecated there and gone in 14, but is all older Pillow has.
        reader = getattr(im, 'get_flattened_data', im.getdata)
        px = list(reader())
        cache, hit = {}, False
        out = []
        for r, g, b, a in px:
            key = (r, g, b)
            if key in cache:
                new = cache[key]
            else:
                new = key
                if a:
                    for s, d in mapping:
                        dr, dg, db = r - s[0], g - s[1], b - s[2]
                        if dr * dr + dg * dg + db * db <= r2:
                            new = d
                            break
                cache[key] = new
            if new != key:
                hit = True
            out.append((new[0], new[1], new[2], a))
        if hit:
            im.putdata(out)
            im.save(dst)
            changed += 1
        else:
            # Unchanged assets still have to exist in the output dir, because
            # the rewritten url() points there for every file that was touched
            # and at the original for the rest. Symlink rather than copy.
            if not os.path.lexists(dst):
                os.symlink(os.path.abspath(src), dst)
    return changed


def main():
    upstream, palette_css, map_file, outdir, tag = sys.argv[1:6]
    # url() rewrites bake this path into the stylesheet, so it has to be
    # absolute regardless of how the caller spelled it.
    outdir = os.path.abspath(outdir)
    colors = pal.load(palette_css)
    mapping = load_map(map_file, colors)
    if not mapping:
        print(upstream)
        return

    theme_dir = os.path.dirname(os.path.abspath(upstream))
    assets_from = theme_dir
    assets_to = os.path.join(outdir, 'assets')

    os.makedirs(outdir, exist_ok=True)
    n = recolor_assets(os.path.normpath(os.path.join(theme_dir, '..', 'assets')),
                       assets_to, mapping)

    with open(upstream) as fh:
        text = fh.read()
    out_css = os.path.join(outdir, f'{tag}.css')
    with open(out_css, 'w') as fh:
        fh.write(f"/* GENERATED by ~/.config/themes/lib/recolor.py - do not edit.\n"
                 f" * Source: {upstream}\n"
                 f" * {len(mapping)} colour rules applied, {n} assets recoloured. */\n")
        fh.write(recolor_css(text, mapping, assets_from, assets_to))
    print(out_css)


if __name__ == '__main__':
    main()
