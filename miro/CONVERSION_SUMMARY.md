# PNG to JPG Conversion - Ready to Execute

## Summary

The conversion script is ready to process your blog images. Here's what it will do:

### Files to Convert
- **Total PNG files:** 268 images
- **Locations:**
  - `assets/images/random_walk_output/` - 200 frames (frame_0000.png to frame_0199.jpg)
  - `assets/images/training_progression/` - 48 training images
  - `assets/images/inference_pipeline_animation/` - 4 animation frames
  - `assets/images/images_per_reward/` - 16 reward comparison images

### Files to Update
- **Total files:** 7 files will be updated with 32 reference replacements
- **Files:**
  1. `ANIMATION_QUICKSTART.md` - 4 replacements
  2. `assets/images/random_walk_output/README_ANIMATION.md` - 4 replacements
  3. `assets/images/random_walk_output/README.txt` - 1 replacement
  4. `assets/js/inference_animation.js` - 4 replacements
  5. `assets/js/data.js` - 16 replacements
  6. `assets/js/reward_tradeoff_animation.js` - 1 replacement
  7. `assets/js/app.js` - 2 replacements

## How to Run

### Option 1: Convert and Keep PNGs (Recommended for first run)

```bash
cd blog
python3 convert_png_to_jpg.py --quality 85
```

This will:
- ✓ Convert all 268 PNG files to JPG (85% quality)
- ✓ Update all 32 references in 7 files
- ✓ Keep the original PNG files (safe mode)

### Option 2: Convert and Remove PNGs (Save maximum space)

```bash
cd blog
python3 convert_png_to_jpg.py --quality 85 --remove-png
```

This will:
- ✓ Convert all 268 PNG files to JPG (85% quality)
- ✓ Update all 32 references in 7 files
- ✓ Delete the original PNG files

⚠️ **Warning:** Make sure you have a backup before using `--remove-png`!

### Option 3: Higher Quality (Less compression)

```bash
cd blog
python3 convert_png_to_jpg.py --quality 90
```

Use quality 90 for slightly larger files but better quality.

## Expected Results

### File Size Savings
- **Quality 85:** ~60-70% size reduction
- **Quality 90:** ~50-60% size reduction
- **Quality 80:** ~70-75% size reduction

For 268 images, you can expect to save **several hundred MB** of space.

### Processing Time
- Conversion: ~5-10 minutes (depending on your system)
- Each PNG takes ~1-2 seconds to convert
- File updates are instant

## What Gets Changed

### JavaScript Files
The script updates all `.jpg` references to `.jpg` in:
- Template strings: `` `${path}.jpg` `` → `` `${path}.jpg` ``
- String literals: `'file.jpg'` → `'file.jpg'`
- File paths in arrays: `['a.jpg', 'b.jpg']` → `['a.jpg', 'b.jpg']`

### Example Changes

**Before:**
```javascript
input: 'assets/images/inference_pipeline_animation/previous_aesthetics.jpg',
highAesthetics: 'assets/images/inference_pipeline_animation/high_aesthetics.jpg',
```

**After:**
```javascript
input: 'assets/images/inference_pipeline_animation/previous_aesthetics.jpg',
highAesthetics: 'assets/images/inference_pipeline_animation/high_aesthetics.jpg',
```

## Verification

After running the script:

1. **Check the output** - Look for any errors in the console
2. **Test the blog** - Open `index.html` in a browser and verify images load
3. **Check file sizes** - Compare the sizes of JPG vs PNG files
4. **Visual inspection** - Make sure image quality is acceptable

## Rollback Plan

If you need to revert:

### If you didn't use --remove-png:
- Simply run: `git checkout blog/` to restore the JS files
- Delete the JPG files: `find blog/assets/images -name "*.jpg" -delete`

### If you used --remove-png:
- Restore from git: `git checkout blog/`
- Or restore from your backup

## Next Steps

1. **Run dry-run again** (optional): `python3 convert_png_to_jpg.py --dry-run`
2. **Run the conversion**: `python3 convert_png_to_jpg.py --quality 85`
3. **Test the blog**: Open in browser and check all images
4. **Commit changes**: `git add blog/` and `git commit -m "Convert PNG images to JPG"`

## Questions?

See `PNG_TO_JPG_README.md` for detailed documentation.

