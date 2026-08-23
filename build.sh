#!/usr/bin/env bash
# Builds and installs the tools in sources.lock, pinned to the commit
# recorded there. Run after install.sh and after installing packages.dnf.txt
# (the astal COPR + build deps in particular - ags will not build without
# them). See packages.other.md for what each tool is and why it isn't just
# a dnf package.
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$SRC/.build"
LOCK="$SRC/sources.lock"

mkdir -p "$BUILD_DIR"

build_ags() {
    local dir="$1"
    (cd "$dir" && npm install --silent)
    (cd "$dir" && meson setup build --wipe >/dev/null)
    echo "  meson install writes to /usr/local - needs sudo:"
    (cd "$dir" && sudo meson install -C build)
}

build_picker() {
    local dir="$1"
    (cd "$dir" && cargo install --quiet --path . --force)
    echo "  -> ~/.cargo/bin/hyprland-preview-share-picker"
}

while read -r name repo commit; do
    [[ -z "$name" || "$name" == \#* ]] && continue

    dir="$BUILD_DIR/$name"
    echo "== $name @ ${commit:0:12} =="

    if [ -d "$dir/.git" ]; then
        git -C "$dir" fetch --quiet origin
    else
        git clone --quiet --recursive "$repo" "$dir"
    fi
    git -C "$dir" checkout --quiet "$commit"
    git -C "$dir" submodule update --init --recursive --quiet

    case "$name" in
        ags) build_ags "$dir" ;;
        hyprland-preview-share-picker) build_picker "$dir" ;;
        *)
            echo "  no build recipe for '$name' - add one in build.sh" >&2
            exit 1
            ;;
    esac
done < "$LOCK"

echo
echo "Done. GTK theme packs and the Nerd Font still need fetching separately"
echo "- see packages.other.md."
