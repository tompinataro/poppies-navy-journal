#!/usr/bin/env python3
"""Create shadow-cleaned copies of the handwritten journal page images."""

from __future__ import annotations

import argparse
from pathlib import Path

import cv2
import numpy as np
from PIL import Image


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


def clean_image(path: Path) -> Image.Image:
    image = np.array(Image.open(path).convert("RGB"))
    mask = artifact_mask(image)
    cleaned = feather_fill(image, mask, paper_color(image))
    return Image.fromarray(cleaned)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", default="docs/assets/pages_filtered")
    parser.add_argument("--output", default="docs/assets/pages_shadow_cleaned")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    source_dir = (repo_root / args.source).resolve()
    output_dir = (repo_root / args.output).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    source_files = sorted(source_dir.glob("page_*.jpg"))
    if not source_files:
        raise SystemExit(f"No page images found in {source_dir}")

    for source_file in source_files:
        clean_image(source_file).save(output_dir / source_file.name, quality=94, optimize=True)
        print(f"cleaned {source_file.name}")


if __name__ == "__main__":
    main()
