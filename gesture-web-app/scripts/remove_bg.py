from PIL import Image

def extract_white_lines(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    data = img.getdata()
    
    new_data = []
    for item in data:
        r, g, b, a = item
        brightness = (r * 299 + g * 587 + b * 114) // 1000
        
        if brightness > 180:
            new_data.append((0, 0, 0, 255))
        else:
            new_data.append((0, 0, 0, 0))
    
    img.putdata(new_data)
    width, height = img.size
    img = img.resize((width * 2, height * 2), Image.NEAREST)
    img.save(output_path)
    print(f"Saved to {output_path}")

if __name__ == "__main__":
    input_path = "/Users/feifanwang/Desktop/hackthon/image_source/Weixin Image_20260714203025_4694_184.png"
    output_path = "/Users/feifanwang/Desktop/hackthon/gesture-web-app/assets/logo.png"
    extract_white_lines(input_path, output_path)