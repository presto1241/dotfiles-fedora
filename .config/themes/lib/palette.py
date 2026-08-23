"""Parse a theme pack's palette.css into {name: (r, g, b)}.

Shared by set-theme.sh (GTK recolouring) and apply.sh (kdeglobals, Kvantum,
kitty), so every consumer resolves a colour name exactly the same way.
"""
import re

_DEF = re.compile(r'@define-color\s+([A-Za-z0-9_]+)\s+#([0-9A-Fa-f]{6})\s*;')


def load(path):
    with open(path) as fh:
        src = fh.read()
    return {n: tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
            for n, h in _DEF.findall(src)}


def hex6(rgb):
    return '#%02x%02x%02x' % rgb


def first(colors, *names):
    """First of `names` that palette.css actually defines, else None."""
    for n in names:
        if n in colors:
            return colors[n]
    return None
