"""Export the three farm PSDs using Pillow and psd-tools."""

import argparse
import json
from io import BytesIO
from pathlib import Path, PurePosixPath
from tempfile import TemporaryDirectory
from zipfile import ZipFile

from PIL import Image
from psd_tools import PSDImage
from psd_tools.constants import BlendMode


PSD_FILES = {
    "day": "小农园-午后.psd",
    "dusk": "小农园-黄昏.psd",
    "dawn": "小农园-夜晚.psd",
}
LAYER_IDS = {
    "底景 · 草地、围栏及其他道具": "base",
    "田间石板路": "paths",
    **{f"田块 {i:02d}": f"bed{i}" for i in range(1, 7)},
    "水塘（含石岸、睡莲和木栈桥）": "pond",
    "前景遮挡 · 绣球花": "hydrangea",
    "邮箱": "mail",
    "萤火虫": "fireflies",
}


def export_period(psd, destination, period):
    preview = Image.new("RGBA", psd.size)
    layers = []
    layers_dir = destination / "layers" / period
    layers_dir.mkdir(parents=True)
    # psd-tools returns siblings from the bottom of the Photoshop stack upwards.
    for layer in psd.descendants():
        if not layer.is_visible():
            continue
        if layer.opacity != 255 or layer.blend_mode not in (BlendMode.NORMAL, BlendMode.PASS_THROUGH):
            raise ValueError(f"Unsupported layer compositing: {layer.name}")
        if layer.is_group():
            continue
        key = LAYER_IDS[layer.name]
        image = layer.topil().convert("RGBA")
        bounds = image.getchannel("A").getbbox()
        if bounds is None:
            continue
        image = image.crop(bounds)
        x, y = layer.left + bounds[0], layer.top + bounds[1]
        preview.alpha_composite(image, (x, y))
        image.save(layers_dir / f"{key}.png")
        layers.append(dict(id=key, x=x, y=y, width=image.width, height=image.height))
    preview.save(destination / f"{period}.png")
    return layers


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("zip_file", type=Path, help="Path to 小农园三个独立PSD.zip")
    args = parser.parse_args()
    output = Path(__file__).resolve().parent
    with ZipFile(args.zip_file) as archive, TemporaryDirectory(dir=output) as tmp:
        staged = Path(tmp)
        files = {PurePosixPath(item.filename).name: item for item in archive.infolist()}
        manifest = {}
        for period, filename in PSD_FILES.items():
            psd = PSDImage.open(BytesIO(archive.read(files[filename])))
            manifest[period] = export_period(psd, staged, period)
        index = staged / "layers.json"
        index.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        for file in staged.rglob("*.png"):
            target = output / file.relative_to(staged)
            target.parent.mkdir(exist_ok=True, parents=True)
            file.replace(target)
        index.replace(output / index.name)


if __name__ == "__main__":
    main()
