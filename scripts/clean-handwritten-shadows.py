#!/usr/bin/env python3
"""Create shadow-cleaned copies of the handwritten journal page images."""

from __future__ import annotations

import argparse
from pathlib import Path

import cv2
import numpy as np
from PIL import Image


BOTTOM_CROP_HEIGHTS = {
    "page_37.jpg": 1585,
    "page_38.jpg": 1560,
    "page_42.jpg": 1525,
    "page_47.jpg": 1775,
}

SPECIAL_POLYGONS = {
    "page_12.jpg": [
        [(0, 1740), (260, 1765), (520, 1782), (1023, 1778), (1023, 1800), (0, 1800)],
    ],
    "page_49.jpg": [
        [(0, 0), (400, 0), (305, 155), (40, 280), (0, 255)],
    ],
    "page_51.jpg": [
        [(0, 0), (180, 0), (125, 95), (0, 125)],
        [(955, 0), (1158, 0), (1158, 160), (1010, 120)],
    ],
}

SPECIAL_RECTS = {
    "page_51.jpg": [
        (996, 0, 1158, 1800),
    ],
}

RIGHT_CROP_WIDTHS = {
    "page_11.jpg": 860,
    "page_51.jpg": 1002,
}

LEFT_CROP_WIDTHS = {
    "page_02.jpg": 22,
}

PROTECTED_SHADOW_RECTS = {
    "page_02.jpg": [
        (0, 0, 58, 1800),
    ],
}


def paper_color(image: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
    height, width = gray.shape
    crop = image[
        int(height * 0.14) : int(height * 0.80),
        int(width * 0.10) : int(width * 0.90),
    ]
    crop_gray = cv2.cvtColor(crop, cv2.COLOR_RGB2GRAY)
    values = crop[crop_gray > 190]
    if len(values) < 100:
        values = crop[crop_gray > np.percentile(crop_gray, 75)]
    return np.median(values, axis=0).astype(np.uint8)


def bottom_shadow_start(gray: np.ndarray) -> int | None:
    height, _ = gray.shape
    median = np.median(gray, axis=1)
    dark_fraction = (gray < 135).mean(axis=1)
    broad_shadow = (median < 170) | (dark_fraction > 0.32)

    y = height - 1
    while y >= 0 and broad_shadow[y]:
        y -= 1

    start = y + 1
    if start > height * 0.72 and height - start > height * 0.08:
        return start
    return None


def add_rect(mask: np.ndarray, box: tuple[int, int, int, int]) -> None:
    x1, y1, x2, y2 = box
    mask[max(0, y1) : min(mask.shape[0], y2), max(0, x1) : min(mask.shape[1], x2)] = 255


def add_poly(mask: np.ndarray, points: list[tuple[int, int]]) -> None:
    cv2.fillPoly(mask, [np.array(points, dtype=np.int32)], 255)


def page_specific_mask(image: np.ndarray, filename: str) -> np.ndarray:
    height, width = image.shape[:2]
    mask = np.zeros((height, width), np.uint8)
    for polygon in SPECIAL_POLYGONS.get(filename, []):
        add_poly(mask, polygon)
    for rect in SPECIAL_RECTS.get(filename, []):
        add_rect(mask, rect)
    return mask


def artifact_mask(image: np.ndarray) -> np.ndarray:
    height, width = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
    mask = np.zeros((height, width), np.uint8)

    # Clean only the outside slivers that are page edge, not writing area.
    add_rect(mask, (0, 0, width, 10))
    add_rect(mask, (0, height - 10, width, height))
    add_rect(mask, (0, 0, 8, height))
    add_rect(mask, (width - 8, 0, width, height))

    dark = (gray < 150).astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(dark, 8)
    for label in range(1, count):
        x, y, w, h, area = stats[label]
        touches_left = x <= 3
        touches_right = x + w >= width - 3
        touches_top = y <= 3
        touches_bottom = y + h >= height - 3
        in_top_corner = y < height * 0.15 and (x < width * 0.28 or x + w > width * 0.72)

        top_artifact = y < height * 0.13 and (
            touches_left or touches_right or touches_top or (w > width * 0.22 and area > 35)
        )
        side_artifact = (touches_left or touches_right) and (h > height * 0.07 or area > 220)
        corner_artifact = in_top_corner and (touches_top or touches_left or touches_right or area > 55)
        bottom_artifact = touches_bottom and (w > width * 0.04 or area > 180)

        if top_artifact or side_artifact or corner_artifact or bottom_artifact:
            mask[labels == label] = 255

    # Clip shadows are often gray, not black, so treat the top corners separately.
    top_corner = np.zeros((height, width), np.uint8)
    corner_height = int(height * 0.13)
    corner_width = int(width * 0.25)
    top_corner[:corner_height, :corner_width] = 255
    top_corner[:corner_height, width - corner_width :] = 255
    mask[(top_corner > 0) & (gray < 210) & (gray > 138)] = 255

    bottom_start = bottom_shadow_start(gray)
    if bottom_start is not None:
        mask[bottom_start:, :] = 255

    # Protect ink-like strokes in the real writing field.
    ink = (gray < 120).astype(np.uint8) * 255
    ink = cv2.dilate(ink, np.ones((3, 3), np.uint8), iterations=1)
    protect = np.zeros((height, width), np.uint8)
    protect[
        int(height * 0.055) : int(height * 0.94),
        int(width * 0.035) : int(width * 0.965),
    ] = 255
    if bottom_start is not None:
        protect[bottom_start:, :] = 0
    mask[(protect > 0) & (ink > 0)] = 0

    if bottom_start is not None:
        mask[bottom_start:, :] = 255

    return cv2.dilate(mask, np.ones((3, 3), np.uint8), iterations=1)


def feather_fill(image: np.ndarray, mask: np.ndarray, color: np.ndarray) -> np.ndarray:
    hard_fill = image.copy()
    hard_fill[mask > 0] = color
    perimeter = cv2.dilate(mask, np.ones((9, 9), np.uint8), iterations=1) - cv2.erode(
        mask, np.ones((9, 9), np.uint8), iterations=1
    )
    if not np.any(perimeter):
        return hard_fill

    alpha = cv2.GaussianBlur(perimeter.astype(np.float32) / 255, (0, 0), sigmaX=2.5, sigmaY=2.5)
    blended = image.astype(np.float32) * (1 - alpha[:, :, None]) + hard_fill.astype(np.float32) * alpha[:, :, None]
    result = hard_fill.copy()
    result[perimeter > 0] = np.clip(blended, 0, 255).astype(np.uint8)[perimeter > 0]
    return result


def protected_shadow_fill(image: np.ndarray, rect: tuple[int, int, int, int]) -> np.ndarray:
    height, width = image.shape[:2]
    x1, y1, x2, y2 = rect
    mask = np.zeros((height, width), np.uint8)
    add_rect(mask, (x1, y1, x2, y2))
    mask = cv2.GaussianBlur(mask, (0, 0), sigmaX=4, sigmaY=1)

    gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
    ink = (gray < 122).astype(np.uint8) * 255
    ink = cv2.dilate(ink, np.ones((3, 3), np.uint8), iterations=1)
    mask[ink > 0] = 0

    alpha = (mask.astype(np.float32) / 255)[:, :, None]
    color = paper_color(image)
    return np.clip(
        image.astype(np.float32) * (1 - alpha) + color[None, None, :].astype(np.float32) * alpha,
        0,
        255,
    ).astype(np.uint8)


def clean_image(path: Path) -> Image.Image:
    image = np.array(Image.open(path).convert("RGB"))
    mask = artifact_mask(image)
    cleaned = feather_fill(image, mask, paper_color(image))
    return Image.fromarray(cleaned)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", default="docs/assets/pages_filtered")
    parser.add_argument("--output", default="docs/assets/pages_shadow_cleaned")
    parser.add_argument(
        "--clean-strength",
        type=float,
        default=1.0,
        help="Blend amount for the cleaned image. Use 0.4 for a midpoint between original and cleaned.",
    )
    args = parser.parse_args()
    if not 0 <= args.clean_strength <= 1:
        raise SystemExit("--clean-strength must be between 0 and 1.")

    repo_root = Path(__file__).resolve().parents[1]
    source_dir = (repo_root / args.source).resolve()
    output_dir = (repo_root / args.output).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    source_files = sorted(source_dir.glob("page_*.jpg"))
    if not source_files:
        raise SystemExit(f"No page images found in {source_dir}")

    for source_file in source_files:
        cleaned = clean_image(source_file)
        if args.clean_strength < 1:
            original = Image.open(source_file).convert("RGB")
            cleaned_array = np.asarray(cleaned, dtype=np.float32)
            original_array = np.asarray(original, dtype=np.float32)
            blended = original_array * (1 - args.clean_strength) + cleaned_array * args.clean_strength
            cleaned = Image.fromarray(np.clip(blended, 0, 255).astype(np.uint8))
        special_mask = page_specific_mask(np.asarray(cleaned), source_file.name)
        if np.any(special_mask):
            cleaned = Image.fromarray(feather_fill(np.asarray(cleaned), special_mask, paper_color(np.asarray(cleaned))))
        crop_height = BOTTOM_CROP_HEIGHTS.get(source_file.name)
        if crop_height:
            cleaned = cleaned.crop((0, 0, cleaned.width, crop_height))
        crop_width = RIGHT_CROP_WIDTHS.get(source_file.name)
        if crop_width:
            cleaned = cleaned.crop((0, 0, crop_width, cleaned.height))
        left_crop = LEFT_CROP_WIDTHS.get(source_file.name)
        if left_crop:
            cleaned = cleaned.crop((left_crop, 0, cleaned.width, cleaned.height))
        cleaned_array = np.asarray(cleaned)
        for rect in PROTECTED_SHADOW_RECTS.get(source_file.name, []):
            cleaned_array = protected_shadow_fill(cleaned_array, rect)
        cleaned = Image.fromarray(cleaned_array)
        cleaned.save(output_dir / source_file.name, quality=94, optimize=True)
        print(f"cleaned {source_file.name}")


if __name__ == "__main__":
    main()
