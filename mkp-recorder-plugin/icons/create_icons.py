# Script pour créer des icônes PNG simples
from PIL import Image, ImageDraw, ImageFont
import os

sizes = [16, 48, 128]

for size in sizes:
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Cercle de fond
    margin = size // 8
    draw.ellipse([margin, margin, size-margin, size-margin], fill='#4fc3f7')
    
    # Triangle de lecture
    cx, cy = size // 2, size // 2
    triangle_size = size // 4
    points = [
        (cx - triangle_size//2, cy - triangle_size),
        (cx - triangle_size//2, cy + triangle_size),
        (cx + triangle_size, cy)
    ]
    draw.polygon(points, fill='white')
    
    img.save(f'icon{size}.png')
    print(f'Created icon{size}.png')

print('Icons created successfully!')
