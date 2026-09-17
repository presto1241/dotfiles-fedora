#!/usr/bin/env bash
# Apply a theme from ~/.config/themes/<name>/ across every toolkit at once.
#
#   apply.sh dark-gray      switch to that theme
#   apply.sh --current      print what is active
#   apply.sh --list         list available themes
#   apply.sh dark-gray --no-switch-wallpaper
#                           switch to that theme but leave the current
#                           wallpaper alone
#
# ── What actually applies live, and what does not ─────────────────────────────
#
# MEASURED, not assumed. An earlier version of this header claimed GTK reloads
# live; it does not, and that was why editing palette.css and re-running this
# script appeared to do nothing.
#
#   ags bar         live      theme.ts reloads palette.css into its own
#                             provider when gtk-theme changes, and set-theme.sh
#                             bounces that key through a sentinel so the signal
#                             fires even on a same-theme re-apply
#   Hyprland        live      hyprctl reload re-reads the source'd theme file
#   wallpaper       live      swww
#   kitty           live      kitty @ set-colors, over the listen_on sockets
#   GTK apps        RESTART   GtkCssProvider does not watch files. Probed on
#                             GTK 3.24.52 and 4.22.4: editing palette.css,
#                             rewriting gtk.css, and switching gtk-theme all
#                             leave a running app unchanged. Only a manual
#                             load_from_path() reloads it, and nothing in GTK
#                             calls one.
#   Qt apps         RESTART   Kvantum reads its config once at startup
#
# Nothing here changes environment variables. Those are read once per process
# and would need a full logout, which makes for a confusing theme switch - so
# QT_QPA_PLATFORMTHEME and friends stay in the main hyprland.conf.
#
# ── Where a colour is written down ────────────────────────────────────────────
#
# palette.css, and nowhere else. Everything below is DERIVED from it by
# lib/derive.py and lib/recolor.py:
#
#   GTK            palette.css is imported directly; if the GTK theme baked
#                  its accent in as a literal, gtk-recolor.map rewrites it
#   kdeglobals     derived - decides QStyleHints::colorScheme()
#   Kvantum        derived into a generated theme - this is what Qt widgets
#                  actually obey, kdeglobals loses to it
#   kitty          derived from the term_* names
#
# Hyprland's hyprland.conf is the one file that still carries its own literals,
# because hyprctl takes rgba(RRGGBBAA) and there is no CSS in the loop at all.

set -euo pipefail

THEMES_DIR="$HOME/.config/themes"
LIB_DIR="$THEMES_DIR/lib"

# The helpers are plain scripts run from a config directory; without this they
# scatter a __pycache__ into it on every apply.
export PYTHONDONTWRITEBYTECODE=1
IFACE="org.gnome.desktop.interface"

NO_SWITCH_WALLPAPER=0
args=()
for a in "$@"; do
  if [[ "$a" == "--no-switch-wallpaper" ]]; then
    NO_SWITCH_WALLPAPER=1
  else
    args+=("$a")
  fi
done
set -- "${args[@]+"${args[@]}"}"

case "${1:-}" in
  --list)
    find "$THEMES_DIR" -mindepth 1 -maxdepth 1 -type d -not -name lib -printf '%f\n' | sort
    exit 0 ;;
  --current)
    if [[ -L "$THEMES_DIR/current" ]]; then
      echo "theme:        $(basename "$(readlink -f "$THEMES_DIR/current")")"
    else
      echo "theme:        (none - no current symlink)"
    fi
    echo "gtk-theme:    $(gsettings get $IFACE gtk-theme)"
    echo "color-scheme: $(gsettings get $IFACE color-scheme)"
    echo "kvantum:      $(sed -n 's/^theme=//p' "$HOME/.config/Kvantum/kvantum.kvconfig" 2>/dev/null)"
    exit 0 ;;
esac

THEME="${1:?usage: apply.sh <theme-name> [--no-switch-wallpaper] | --list | --current}"
DIR="$THEMES_DIR/$THEME"
[[ -d "$DIR" ]] || { echo "apply: no such theme: $THEME" >&2; exit 1; }

# Read the manifest. Only bare key=value lines, so a stray line in the file
# cannot execute anything.
declare -A CFG=()
while IFS='=' read -r k v; do
  [[ "$k" =~ ^[a-z_]+$ ]] || continue
  CFG[$k]="$v"
done < <(grep -E '^[a-z_]+=' "$DIR/theme.conf")

GTK_THEME="${CFG[gtk_theme]:-Adwaita}"
SCHEME="${CFG[color_scheme]:-prefer-dark}"
PALETTE="$DIR/palette.css"

# ── the `current` symlink ─────────────────────────────────────────────────────
# Everything else points at this rather than at a theme by name, so the other
# config files never have to be edited on a switch. Repointed BEFORE anything
# reads it - set-theme.sh resolves the pack through this symlink.
ln -sfn "$DIR" "$THEMES_DIR/current"

# ── GTK ───────────────────────────────────────────────────────────────────────
"$HOME/.config/ags/scripts/set-theme.sh" "$GTK_THEME" "$SCHEME"

[[ -n "${CFG[icon_theme]:-}" ]]   && gsettings set "$IFACE" icon-theme   "${CFG[icon_theme]}"
[[ -n "${CFG[cursor_theme]:-}" ]] && gsettings set "$IFACE" cursor-theme "${CFG[cursor_theme]}"

# ── Qt: kdeglobals ────────────────────────────────────────────────────────────
# Derived from palette.css. Kvantum overrides most of these for the widget
# palette, but kdeglobals still decides QStyleHints::colorScheme() - and a
# light kdeglobals under a dark Kvantum theme is exactly what made Dolphin draw
# white rows on a dark palette. Deriving both sides from one file makes that
# drift impossible.
if [[ -f "$PALETTE" ]] && command -v kwriteconfig6 >/dev/null; then
  while IFS='|' read -r group key value; do
    kwriteconfig6 --file kdeglobals --group "$group" --key "$key" "$value"
  done < <("$LIB_DIR/derive.py" kdeglobals "$PALETTE")
fi

# An explicit kdeglobals in the theme dir is applied AFTER the derived values,
# for anything the mapping cannot express.
if [[ -f "$DIR/kdeglobals" ]] && command -v kwriteconfig6 >/dev/null; then
  group=""
  while IFS= read -r line; do
    [[ "$line" =~ ^\[(.+)\]$ ]] && { group="${BASH_REMATCH[1]}"; continue; }
    [[ "$line" =~ ^([A-Za-z]+)=(.*)$ ]] || continue
    [[ -n "$group" ]] && kwriteconfig6 --file kdeglobals --group "$group" \
        --key "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}"
  done < "$DIR/kdeglobals"
fi
[[ -n "${CFG[qt_style]:-}" ]] && command -v kwriteconfig6 >/dev/null && \
  kwriteconfig6 --file kdeglobals --group KDE --key widgetStyle "${CFG[qt_style]}"

# ── Qt: Kvantum ───────────────────────────────────────────────────────────────
# [GeneralColors] in the Kvantum theme is what Qt widgets ACTUALLY obey - it
# beats kdeglobals outright. Dolphin's grey file selection came from
# highlight.color=#808080 in NoMansSky.kvconfig, nothing to do with palette.css.
#
# So the theme named in theme.conf is treated as a BASE, and a sibling theme is
# generated next to it with [GeneralColors] rewritten from palette.css. The
# base theme is never modified, and the SVG - which is where all the shape and
# gradient work lives - is symlinked rather than copied.
KVANTUM_ACTIVE=""
if [[ -n "${CFG[kvantum_theme]:-}" ]]; then
  KV_BASE="${CFG[kvantum_theme]}"
  KV_DIR="$HOME/.config/Kvantum"
  KV_BASE_DIR=""
  for b in "$KV_DIR" "$HOME/.local/share/Kvantum" /usr/share/Kvantum; do
    [[ -f "$b/$KV_BASE/$KV_BASE.kvconfig" ]] && { KV_BASE_DIR="$b/$KV_BASE"; break; }
  done

  mkdir -p "$KV_DIR"
  if [[ -n "$KV_BASE_DIR" && -f "$PALETTE" ]]; then
    KV_GEN="$KV_BASE-$THEME"
    KV_GEN_DIR="$KV_DIR/$KV_GEN"
    mkdir -p "$KV_GEN_DIR"
    "$LIB_DIR/derive.py" kvantum "$PALETTE" "$KV_BASE_DIR/$KV_BASE.kvconfig" \
      > "$KV_GEN_DIR/$KV_GEN.kvconfig"
    # Kvantum finds the SVG by the theme's own name, so the generated copy
    # has to be renamed to match.
    #
    # [GeneralColors] above does not reach a colour baked into the SVG's own
    # shapes - measured, see kvantum-recolor.map's header. If the pack ships
    # one, rewrite those literals into a real copy; otherwise fall back to
    # the symlink, which is fine for a base theme that bakes nothing in.
    if [[ -f "$KV_BASE_DIR/$KV_BASE.svg" ]]; then
      # A prior run may have left this as a symlink into the base theme -
      # recolor.py opens the destination for writing, and following that
      # link would overwrite the BASE theme's SVG instead of this pack's
      # copy. Break it first so a write always lands on a real file here.
      rm -f "$KV_GEN_DIR/$KV_GEN.svg"
      if [[ -f "$DIR/kvantum-recolor.map" && -x "$LIB_DIR/recolor.py" ]]; then
        "$LIB_DIR/recolor.py" svg "$KV_BASE_DIR/$KV_BASE.svg" \
          "$KV_GEN_DIR/$KV_GEN.svg" "$PALETTE" "$DIR/kvantum-recolor.map" \
          >/dev/null 2>&1 || ln -sfn "$KV_BASE_DIR/$KV_BASE.svg" "$KV_GEN_DIR/$KV_GEN.svg"
      else
        ln -sfn "$KV_BASE_DIR/$KV_BASE.svg" "$KV_GEN_DIR/$KV_GEN.svg"
      fi
    fi
    KVANTUM_ACTIVE="$KV_GEN"
  else
    [[ -n "$KV_BASE_DIR" ]] || echo "apply: Kvantum theme '$KV_BASE' not found - using it by name anyway" >&2
    KVANTUM_ACTIVE="$KV_BASE"
  fi
  printf '[General]\ntheme=%s\n' "$KVANTUM_ACTIVE" > "$KV_DIR/kvantum.kvconfig"
fi

# ── kitty ─────────────────────────────────────────────────────────────────────
# kitty.conf does `include current-theme.conf`, so writing that file is the
# whole integration. It is GENERATED from palette.css; the pack's own
# kitty.conf is appended after it for anything palette.css cannot express
# (and may be absent or empty, which is the normal case).
KITTY_STATE="skipped (no palette.css)"
if [[ -f "$PALETTE" ]] && [[ -d "$HOME/.config/kitty" ]]; then
  KITTY_THEME="$HOME/.config/kitty/current-theme.conf"
  tmp="$(mktemp)"
  "$LIB_DIR/derive.py" kitty "$PALETTE" > "$tmp"
  if [[ -s "$DIR/kitty.conf" ]]; then
    printf '\n# --- from %s/kitty.conf ---\n' "$THEME" >> "$tmp"
    cat "$DIR/kitty.conf" >> "$tmp"
  fi
  cp "$KITTY_THEME" "$KITTY_THEME.bak" 2>/dev/null || true
  mv "$tmp" "$KITTY_THEME"
  chmod 644 "$KITTY_THEME"
  KITTY_STATE="written, no running instance reached"

  # kitty's auto colour-scheme feature OUTRANKS `include current-theme.conf`.
  # If dark-theme.auto.conf / light-theme.auto.conf exist, kitty follows the
  # desktop light/dark preference and loads one of them, and whatever the
  # include pulled in is discarded.
  #
  # Measured: a kitty launched seconds after current-theme.conf was rewritten
  # to background #0f0f0f still reported #222d31, because a stale
  # dark-theme.auto.conf (an Adapta Nokto Maia copy) was winning. The include
  # had been dead the whole time and nothing said so.
  #
  # Rather than fight it, both auto files are pointed at the generated theme.
  # The theme pack owns light-vs-dark through theme.conf's color_scheme, so
  # kitty should not be second-guessing it from the desktop preference.
  for variant in dark light; do
    auto="$HOME/.config/kitty/$variant-theme.auto.conf"
    if [[ -e "$auto" && ! -L "$auto" ]]; then
      mv "$auto" "$auto.bak"
      echo "apply: $variant-theme.auto.conf was a real file and was overriding" >&2
      echo "       current-theme.conf - saved as $variant-theme.auto.conf.bak" >&2
    fi
    ln -sfn current-theme.conf "$auto"
  done

  # kitty @ only reaches an instance through a socket it is listening on, so
  # this depends on `allow_remote_control yes` + `listen_on` in kitty.conf.
  # Running instances that predate those settings will not have a socket and
  # keep their old colours until they are restarted.
  live=0
  for sock in /tmp/kitty-*; do
    [[ -S "$sock" ]] || continue
    kitty @ --to "unix:$sock" set-colors --all --configured "$KITTY_THEME" \
      >/dev/null 2>&1 && live=$((live + 1))
  done
  [[ $live -gt 0 ]] && KITTY_STATE="live on $live instance(s)"
fi

# ── rofi ──────────────────────────────────────────────────────────────────────
# rofi's .rasi "@name" variables aren't GTK's @define-color, so it can't read
# palette.css directly either - shared/colors.rasi imports this generated
# file instead of the fixed colors/onedark.rasi it used to.
ROFI_STATE="skipped (no palette.css)"
if [[ -f "$PALETTE" ]] && [[ -d "$HOME/.config/rofi" ]]; then
  "$LIB_DIR/derive.py" rofi "$PALETTE" > "$HOME/.config/rofi/current-theme.rasi"
  ROFI_STATE="written - takes effect next launch"
fi

# ── Hyprland ──────────────────────────────────────────────────────────────────
# Only reloads if the main config actually source's the theme file; harmless
# either way.
command -v hyprctl >/dev/null && hyprctl reload >/dev/null 2>&1 || true

# ── Wallpaper ─────────────────────────────────────────────────────────────────
if [[ "$NO_SWITCH_WALLPAPER" -eq 0 ]] && [[ -n "${CFG[wallpaper]:-}" ]]; then
  wp="${CFG[wallpaper]/#\~/$HOME}"
  [[ -f "$wp" ]] && command -v swww >/dev/null && swww img "$wp" --transition-duration 1 --transition-type wipe --transition-fps 60 >/dev/null 2>&1 || true
fi

echo
echo "apply: $THEME (${CFG[name]:-$THEME})"
echo "  gtk       $GTK_THEME / $SCHEME"
echo "  qt        ${KVANTUM_ACTIVE:-<unchanged>} / ${CFG[qt_style]:-<unchanged>}"
echo "  kitty     $KITTY_STATE"
echo "  rofi      $ROFI_STATE"
echo
echo "  Live now:      ags bar, Hyprland, wallpaper, kitty (where reachable)."
echo "  Needs restart: every GTK app, and every Qt app. rofi picks up new"
echo "                 colors on its next launch - nothing to restart there."
echo "                 GTK parses its CSS once at startup and never re-reads"
echo "                 it; Kvantum reads its config once. Neither is fixable"
echo "                 from here - see the header of this script."
