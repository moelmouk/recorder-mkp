from PIL import Image, ImageDraw

def create_icon(size, filename):
    # Create image with transparent background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Draw a circle (record button style)
    margin = size // 8
    circle_bbox = [margin, margin, size - margin, size - margin]
    
    # Red circle
    draw.ellipse(circle_bbox, fill=(244, 67, 54, 255))
    
    # Inner darker circle
    inner_margin = size // 4
    inner_bbox = [inner_margin, inner_margin, size - inner_margin, size - inner_margin]
    draw.ellipse(inner_bbox, fill=(183, 28, 28, 255))
    
    img.save(filename, 'PNG')
    print(f"Created {filename}")

# Create all sizes
create_icon(16, 'icon16.png')
create_icon(48, 'icon48.png')
create_icon(128, 'icon128.png')

print("All icons created!")
