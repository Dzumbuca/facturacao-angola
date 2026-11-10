"""Gera os ícones PWA/splash a partir do logótipo oficial (public/logo.png).

Não desenha nem substitui a marca: recorta o conteúdo oficial e centra-o
em fundos neutros, com margens diferentes para ícones maskable.
Executar: python scripts/generate-pwa-icons.py
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "public" / "logo.png"
OUT = ROOT / "public" / "icons"
OUT.mkdir(parents=True, exist_ok=True)

logo = Image.open(SOURCE).convert("RGBA")
bbox = logo.getchannel("A").getbbox()
if bbox:
    logo = logo.crop(bbox)

WHITE = (255, 255, 255, 255)


def make_icon(size: int, ratio: float, destination: Path) -> None:
    canvas = Image.new("RGBA", (size, size), WHITE)
    width = max(1, int(size * ratio))
    height = max(1, round(logo.height * width / logo.width))
    resized = logo.resize((width, height), Image.LANCZOS)
    canvas.alpha_composite(resized, ((size - width) // 2, (size - height) // 2))
    canvas.convert("RGB").save(destination, "PNG", optimize=True)


def make_splash(width: int, height: int, destination: Path) -> None:
    canvas = Image.new("RGB", (width, height), (255, 255, 255))
    target = int(width * 0.42)
    logo_height = max(1, round(logo.height * target / logo.width))
    resized = logo.resize((target, logo_height), Image.LANCZOS)
    position = ((width - target) // 2, (height - logo_height) // 2)
    canvas.paste(resized, position, resized)
    canvas.save(destination, "PNG", optimize=True)


# Ícone normal: margem mínima para o logótipo respirar.
make_icon(192, 0.86, OUT / "icon-192.png")
make_icon(512, 0.86, OUT / "icon-512.png")
# Maskable: conteúdo dentro da zona segura (~60%).
make_icon(192, 0.60, OUT / "icon-maskable-192.png")
make_icon(512, 0.60, OUT / "icon-maskable-512.png")
# iOS home screen.
make_icon(180, 0.84, OUT / "apple-touch-icon.png")

# Splash screens iOS (retrato) para os tamanhos mais comuns.
make_splash(1170, 2532, OUT / "splash-1170x2532.png")
make_splash(1290, 2796, OUT / "splash-1290x2796.png")
make_splash(2048, 2732, OUT / "splash-2048x2732.png")

print("Ícones gerados em", OUT)
for path in sorted(OUT.glob("*.png")):
    print(f"  {path.name}: {path.stat().st_size // 1024} KB")
