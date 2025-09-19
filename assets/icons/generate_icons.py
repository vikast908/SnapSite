#!/usr/bin/env python3
"""
Generate dark-mode optimized icons for GetInspire Chrome extension
Creates PNG files from SVG with proper contrast for both light and dark themes
"""

import os
from PIL import Image, ImageDraw, ImageFont
import io

def create_lightbulb_icon(size):
    """Create a lightbulb icon optimized for dark mode at specified size"""

    # Create image with transparent background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Scale factors based on size
    scale = size / 128

    # Colors optimized for both light and dark backgrounds
    primary_color = (79, 70, 229, 255)  # Indigo
    secondary_color = (124, 58, 237, 255)  # Purple
    accent_color = (245, 158, 11, 255)  # Amber
    outline_color = (31, 41, 55, 255)  # Dark gray
    base_color = (55, 65, 81, 255)  # Darker gray
    filament_color = (253, 224, 71, 255)  # Yellow

    # Background circle for contrast
    margin = int(2 * scale)
    bg_radius = size//2 - margin
    draw.ellipse([margin, margin, size-margin, size-margin],
                 fill=(255, 255, 255, 230), outline=(229, 231, 235, 255), width=max(1, int(2*scale)))

    # Calculate bulb dimensions
    bulb_width = int(32 * scale)
    bulb_height = int(45 * scale)
    bulb_x = (size - bulb_width) // 2
    bulb_y = int(20 * scale)

    # Draw main bulb body (rounded rectangle)
    bulb_coords = [bulb_x, bulb_y, bulb_x + bulb_width, bulb_y + bulb_height]
    draw.rounded_rectangle(bulb_coords, radius=int(16*scale),
                          fill=primary_color, outline=outline_color, width=max(1, int(2*scale)))

    # Draw screw threads
    thread_y1 = bulb_y + bulb_height + int(4 * scale)
    thread_y2 = thread_y1 + int(4 * scale)
    thread_margin = int(4 * scale)

    draw.line([bulb_x + thread_margin, thread_y1, bulb_x + bulb_width - thread_margin, thread_y1],
              fill=base_color, width=max(1, int(2*scale)))
    draw.line([bulb_x + thread_margin*2, thread_y2, bulb_x + bulb_width - thread_margin*2, thread_y2],
              fill=base_color, width=max(1, int(2*scale)))

    # Draw base
    base_y = thread_y2 + int(4 * scale)
    base_width = int(24 * scale)
    base_height = int(6 * scale)
    base_x = (size - base_width) // 2
    draw.rounded_rectangle([base_x, base_y, base_x + base_width, base_y + base_height],
                          radius=int(3*scale), fill=base_color, outline=outline_color, width=1)

    # Draw filament (simplified for smaller sizes)
    if size >= 32:
        center_x = size // 2
        filament_y = bulb_y + int(15 * scale)
        filament_width = int(12 * scale)

        # Simple filament lines
        draw.line([center_x - filament_width//2, filament_y, center_x + filament_width//2, filament_y],
                  fill=filament_color, width=max(1, int(2*scale)))
        draw.line([center_x - filament_width//3, filament_y + int(8*scale),
                   center_x + filament_width//3, filament_y + int(8*scale)],
                  fill=filament_color, width=max(1, int(2*scale)))

    # Draw inspiration rays (only for larger sizes)
    if size >= 32:
        ray_length = int(8 * scale)
        ray_width = max(1, int(2 * scale))
        center_x, center_y = size // 2, bulb_y + bulb_height // 2

        # Top ray
        draw.line([center_x, bulb_y - ray_length, center_x, bulb_y],
                  fill=accent_color, width=ray_width)

        # Side rays
        if size >= 48:
            # Top right
            draw.line([center_x + bulb_width//2 + int(4*scale), bulb_y + int(8*scale),
                       center_x + bulb_width//2 + int(4*scale) + ray_length, bulb_y + int(8*scale)],
                      fill=accent_color, width=ray_width)
            # Top left
            draw.line([center_x - bulb_width//2 - int(4*scale), bulb_y + int(8*scale),
                       center_x - bulb_width//2 - int(4*scale) - ray_length, bulb_y + int(8*scale)],
                      fill=accent_color, width=ray_width)

    return img

def main():
    """Generate all icon sizes"""
    sizes = [16, 32, 48, 128]

    for size in sizes:
        print(f"Generating {size}x{size} icon...")
        icon = create_lightbulb_icon(size)

        # Save with high quality
        filename = f"{size}.png"
        icon.save(filename, "PNG", optimize=True, quality=95)
        print(f"Saved {filename}")

    print("All icons generated successfully!")

if __name__ == "__main__":
    main()