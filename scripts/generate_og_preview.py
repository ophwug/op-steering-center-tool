from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "og-preview.png"
WIDTH = 1200
HEIGHT = 630


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Helvetica Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Helvetica.ttf",
        "/Library/Fonts/Arial Bold.ttf" if bold else "/Library/Fonts/Arial.ttf",
    ]
    for candidate in candidates:
        path = Path(candidate)
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default(size=size)


def text(draw: ImageDraw.ImageDraw, xy: tuple[int, int], value: str, size: int, fill: str, bold: bool = False) -> None:
    draw.text(xy, value, font=font(size, bold), fill=fill)


def text_width(draw: ImageDraw.ImageDraw, value: str, size: int, bold: bool = False) -> int:
    box = draw.textbbox((0, 0), value, font=font(size, bold))
    return box[2] - box[0]


def fitted_text(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    value: str,
    size: int,
    max_width: int,
    fill: str,
    bold: bool = False,
    min_size: int = 16,
) -> None:
    while size > min_size and text_width(draw, value, size, bold) > max_width:
        size -= 1
    draw.text(xy, value, font=font(size, bold), fill=fill)


def pill(draw: ImageDraw.ImageDraw, xy: tuple[int, int], value: str, size: int, fill: str, text_fill: str) -> None:
    x, y = xy
    padding_x = 28
    padding_y = 12
    width = text_width(draw, value, size, True) + padding_x * 2
    height = size + padding_y * 2
    draw.rounded_rectangle((x, y, x + width, y + height), radius=height // 2, fill=fill)
    text(draw, (x + padding_x, y + padding_y - 2), value, size, text_fill, True)


def evidence_row(draw: ImageDraw.ImageDraw, y: int, label: str, value: str, accent: str = "#9ee6c1") -> None:
    left = 720
    right = 1080
    draw.rounded_rectangle((left, y, right, y + 72), radius=14, fill="#17272a", outline="#3a5550", width=2)
    draw.ellipse((left + 22, y + 25, left + 44, y + 47), fill=accent)
    text(draw, (left + 60, y + 15), label, 22, "#cfe0da", True)
    fitted_text(draw, (left + 60, y + 42), value, 18, right - left - 84, "#f7fbf9", True, min_size=14)


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    image = Image.new("RGB", (WIDTH, HEIGHT), "#eef2f0")
    draw = ImageDraw.Draw(image)

    draw.rounded_rectangle((44, 44, WIDTH - 44, HEIGHT - 44), radius=30, fill="#172226")
    pill(draw, (80, 82), "openpilot route utility", 21, "#d9f2e7", "#173d39")

    text(draw, (80, 150), "Steering", 66, "#f7fbf9", True)
    text(draw, (80, 224), "centering", 66, "#f7fbf9", True)
    text(draw, (80, 298), "diagnostic", 66, "#f7fbf9", True)
    text(draw, (82, 414), "Scan public routes for stable", 27, "#cfe0da", False)
    text(draw, (82, 454), "straight-driving carState windows", 27, "#cfe0da", False)
    text(draw, (82, 494), "and median steeringAngleDeg.", 27, "#cfe0da", False)

    draw.rounded_rectangle((80, 530, 600, 582), radius=26, fill="#244540")
    fitted_text(
        draw,
        (108, 543),
        "ophwug.github.io/op-steering-center-tool",
        21,
        464,
        "#9ee6c1",
        True,
        min_size=18,
    )

    draw.rounded_rectangle((682, 130, 1120, 500), radius=24, fill="#203034", outline="#3a5550", width=2)
    text(draw, (720, 176), "Center estimate", 33, "#f7fbf9", True)
    evidence_row(draw, 242, "Median angle", "+1.48 deg")
    evidence_row(draw, 326, "Confidence", "stable windows found", "#b7d7ff")
    evidence_row(draw, 410, "Filters", "speed, rate, blinkers", "#ffd38f")

    image.save(OUT, "PNG", optimize=True)


if __name__ == "__main__":
    main()
