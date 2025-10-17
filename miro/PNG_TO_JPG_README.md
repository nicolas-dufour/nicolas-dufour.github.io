# PNG to JPG Conversion Script

This script converts all PNG images in the blog to compressed JPG format and automatically updates all references in HTML, JavaScript, CSS, and Markdown files.

## Requirements

```bash
pip install Pillow
```

## Usage

### 1. Dry Run (Preview Changes)

First, run in dry-run mode to see what changes would be made:

```bash
cd blog
python3 convert_png_to_jpg.py --dry-run
```

### 2. Convert PNG to JPG

Convert all PNG files to JPG with default 85% quality:

```bash
python3 convert_png_to_jpg.py
```

### 3. Convert with Custom Quality

Adjust the JPG quality (1-100):

```bash
python3 convert_png_to_jpg.py --quality 90
```

### 4. Convert and Remove Original PNGs

Convert and delete the original PNG files after successful conversion:

```bash
python3 convert_png_to_jpg.py --remove-png
```

### 5. Full Example

Preview, then convert with 90% quality and remove PNGs:

```bash
# Preview first
python3 convert_png_to_jpg.py --dry-run --quality 90 --remove-png

# If everything looks good, run for real
python3 convert_png_to_jpg.py --quality 90 --remove-png
```

## Options

- `--quality N`: Set JPG quality (1-100), default is 85
- `--dry-run`: Preview changes without modifying files
- `--remove-png`: Delete original PNG files after conversion
- `--blog-dir PATH`: Specify blog directory path (default: current directory)

## What the Script Does

1. **Finds all PNG files** in `assets/images/` directory
2. **Converts PNG to JPG** with the specified quality
   - Handles transparency by converting to white background
   - Optimizes file size
3. **Updates all references** in:
   - HTML files (`*.html`)
   - JavaScript files (`*.js`)
   - CSS files (`*.css`)
   - Markdown files (`*.md`)
   - JSON and text files
4. **Optionally removes** original PNG files

## File Size Savings

The script typically achieves 50-80% file size reduction while maintaining visual quality:

- PNG → JPG (85% quality): ~60% size reduction
- PNG → JPG (90% quality): ~50% size reduction
- PNG → JPG (80% quality): ~70% size reduction

## Example Output

```
Blog directory: /path/to/blog
Images directory: /path/to/blog/assets/images
Quality: 85%
Dry run: False
Remove PNG: False

============================================================
STEP 1: Finding PNG files...
============================================================
Found 220 PNG files

============================================================
STEP 2: Converting PNG to JPG...
============================================================
✓ Converted: frame_0000.png -> frame_0000.jpg
✓ Converted: frame_0001.png -> frame_0001.jpg
...
220 files converted

============================================================
STEP 3: Finding files to update...
============================================================
Found 8 files to check for references

============================================================
STEP 4: Updating file references...
============================================================
  ✓ Updated app.js: 2 replacement(s)
  ✓ Updated data.js: 16 replacement(s)
  ✓ Updated inference_animation.js: 4 replacement(s)
  ✓ Updated reward_tradeoff_animation.js: 1 replacement(s)

Total: 4 files updated with 23 replacements

============================================================
SUMMARY
============================================================
✓ Converted: 220 PNG files to JPG
✓ Updated: 4 files
✓ Total replacements: 23

Done!
```

## Files Affected

The script updates references in:

- `index.html`
- `assets/js/app.js`
- `assets/js/data.js`
- `assets/js/inference_animation.js`
- `assets/js/reward_tradeoff_animation.js`
- `assets/css/styles.css`
- `*.md` files

## Safety Features

- **Dry run mode**: Preview all changes before applying them
- **Backup recommended**: Create a backup before running with `--remove-png`
- **Error handling**: Continues processing even if individual files fail
- **Detailed logging**: Shows exactly what was changed

## Reverting Changes

If you need to revert:

1. If you didn't use `--remove-png`, you still have the original PNG files
2. Restore from your git repository: `git checkout blog/`
3. If you have backups, restore from there

## Troubleshooting

### "No PNG files found"
- Make sure you're running the script from the blog directory
- Check that `assets/images/` exists and contains PNG files

### "Error converting [file]"
- Check that the PNG file is valid and not corrupted
- Ensure you have write permissions in the directory

### References not updated
- The script looks for exact path matches
- If a file uses a different path format, you may need to update it manually

## Performance

The script processes files efficiently:
- ~1-2 seconds per PNG file for conversion
- ~0.1 seconds per text file for reference updates
- Total time for 220 PNGs: ~5-10 minutes

## Notes

- JPG is lossy compression - always test with `--dry-run` first
- Quality 85 is a good balance between size and quality
- For photos/images: JPG is excellent
- For screenshots with text: Consider keeping as PNG or using quality 90+
- The script handles transparency by using a white background

