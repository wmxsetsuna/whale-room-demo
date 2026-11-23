"""将本目录的鲸光闪烁 APNG 导出为 Demo 使用的图集与帧时长。需要 Pillow。"""

import json
from pathlib import Path

from PIL import Image


def export():
    folder = Path(__file__).resolve().parent
    atlas_path = folder / "atlas.png"
    with Image.open(folder / "鲸光闪烁.png") as source:
        # APNG can have a still fallback image before its first animation frame.
        first = int(source.info.get("default_image", False))
        count = source.n_frames - first
        columns = min(6, count)
        rows = (count + columns - 1) // columns
        width, height = source.size
        atlas = Image.new("RGBA", (columns * width, rows * height))
        durations = []
        for index in range(count):
            source.seek(index + first)
            durations.append(source.info["duration"])
            origin = (index % columns * width, index // columns * height)
            atlas.paste(source.convert("RGBA"), origin)
        atlas.save(atlas_path, optimize=True)

        # Compare decoded RGBA bytes, including the fully transparent pixels.
        with Image.open(atlas_path) as saved:
            for index in range(count):
                source.seek(index + first)
                x, y = index % columns * width, index // columns * height
                cell = saved.crop((x, y, x + width, y + height))
                if cell.tobytes() != source.convert("RGBA").tobytes():
                    raise ValueError(f"Frame {index + 1} does not match the APNG.")

    metadata = {
        "columns": columns,
        "rows": rows,
        "count": count,
        "cellSize": [width, height],
        "durations": durations,
    }
    (folder / "animation.json").write_text(
        json.dumps(metadata, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Verified {count} frames, total duration {sum(durations):g} ms.")


if __name__ == "__main__":
    export()
