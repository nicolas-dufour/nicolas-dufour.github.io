#!/usr/bin/env python3
"""
Script to convert all PNG images in the blog directory to compressed JPG format
and update all references in HTML, JS, CSS, and Markdown files.

This script:
1. Finds all PNG files in the blog/assets/images directory
2. Converts them to JPG with 85% quality
3. Updates all file references in HTML, JS, CSS, and Markdown files
4. Optionally removes the original PNG files
"""

import os
import sys
from pathlib import Path
from PIL import Image
import re
import argparse


def convert_png_to_jpg(png_path, quality=85):
    """
    Convert a PNG file to JPG format with the specified quality.
    
    Args:
        png_path: Path to the PNG file
        quality: JPG quality (1-100), default 85
        
    Returns:
        Path to the created JPG file, or None if conversion failed
    """
    try:
        jpg_path = png_path.with_suffix('.jpg')
        
        # Open the PNG image
        img = Image.open(png_path)
        
        # Convert RGBA to RGB if necessary
        if img.mode in ('RGBA', 'LA', 'P'):
            # Create a white background
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            if img.mode in ('RGBA', 'LA'):
                background.paste(img, mask=img.split()[-1])  # Use alpha channel as mask
            img = background
        elif img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Save as JPG with the specified quality
        img.save(jpg_path, 'JPEG', quality=quality, optimize=True)
        
        print(f"✓ Converted: {png_path.name} -> {jpg_path.name}")
        return jpg_path
        
    except Exception as e:
        print(f"✗ Error converting {png_path}: {e}")
        return None


def find_all_png_files(base_dir):
    """Find all PNG files in the given directory and subdirectories."""
    png_files = []
    for root, dirs, files in os.walk(base_dir):
        for file in files:
            if file.lower().endswith('.png'):
                png_files.append(Path(root) / file)
    return png_files


def find_files_to_update(base_dir, extensions=None):
    """Find all files that might contain image references."""
    if extensions is None:
        extensions = ['.html', '.js', '.css', '.md', '.json', '.txt']
    
    files_to_update = []
    for root, dirs, files in os.walk(base_dir):
        # Skip node_modules, .git, etc.
        dirs[:] = [d for d in dirs if not d.startswith('.') and d != 'node_modules']
        
        for file in files:
            if any(file.endswith(ext) for ext in extensions):
                files_to_update.append(Path(root) / file)
    
    return files_to_update


def update_file_references(file_path, replacements, dry_run=False):
    """
    Update PNG references to JPG in a file.
    
    Args:
        file_path: Path to the file to update
        replacements: Dictionary mapping PNG paths to JPG paths (relative to blog dir)
        dry_run: If True, only report changes without modifying files
        
    Returns:
        Number of replacements made
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        new_content = content
        
        # Strategy 1: Replace exact path matches
        for png_ref, jpg_ref in replacements.items():
            if png_ref in new_content:
                new_content = new_content.replace(png_ref, jpg_ref)
        
        # Strategy 2: Replace .png extension in common patterns
        # This handles template strings and dynamic paths like: `${var}.png`, .png`, '.png', ".png"
        # Use regex to replace .png with .jpg more broadly
        import re
        
        # Pattern for .png in various contexts (but not in comments or strings that look like URLs)
        patterns = [
            # Template string with .png: ${var}.png or `something.png`
            (r'\.png([`\'"\)])', r'.jpg\1'),
            # Array or list with .png: 'file.png', "file.png"
            (r'\.png\'', r'.jpg\''),
            (r'\.png"', r'.jpg"'),
            # End of line .png
            (r'\.png$', r'.jpg'),
        ]
        
        for pattern, replacement in patterns:
            new_content = re.sub(pattern, replacement, new_content, flags=re.MULTILINE)
        
        # Count actual changes
        if new_content != original_content:
            # Count how many .png -> .jpg replacements were made
            png_count_before = original_content.count('.png')
            png_count_after = new_content.count('.png')
            replacement_count = png_count_before - png_count_after
            
            if replacement_count > 0:
                if dry_run:
                    print(f"  [DRY RUN] Would update {file_path.name}: {replacement_count} replacement(s)")
                else:
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f"  ✓ Updated {file_path.name}: {replacement_count} replacement(s)")
                
                return replacement_count
        
        return 0
        
    except Exception as e:
        print(f"  ✗ Error updating {file_path}: {e}")
        return 0


def main():
    parser = argparse.ArgumentParser(
        description='Convert PNG images to JPG and update references'
    )
    parser.add_argument(
        '--quality',
        type=int,
        default=85,
        help='JPG quality (1-100), default: 85'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be done without making changes'
    )
    parser.add_argument(
        '--remove-png',
        action='store_true',
        help='Remove original PNG files after conversion'
    )
    parser.add_argument(
        '--blog-dir',
        type=str,
        default='.',
        help='Path to blog directory (default: current directory)'
    )
    
    args = parser.parse_args()
    
    # Resolve blog directory
    blog_dir = Path(args.blog_dir).resolve()
    if not blog_dir.exists():
        print(f"Error: Blog directory not found: {blog_dir}")
        sys.exit(1)
    
    # Find images directory
    images_dir = blog_dir / 'assets' / 'images'
    if not images_dir.exists():
        print(f"Error: Images directory not found: {images_dir}")
        sys.exit(1)
    
    print(f"Blog directory: {blog_dir}")
    print(f"Images directory: {images_dir}")
    print(f"Quality: {args.quality}%")
    print(f"Dry run: {args.dry_run}")
    print(f"Remove PNG: {args.remove_png}")
    print()
    
    # Step 1: Find all PNG files
    print("=" * 60)
    print("STEP 1: Finding PNG files...")
    print("=" * 60)
    png_files = find_all_png_files(images_dir)
    print(f"Found {len(png_files)} PNG files")
    print()
    
    if not png_files:
        print("No PNG files found. Exiting.")
        sys.exit(0)
    
    # Step 2: Convert PNG files to JPG
    print("=" * 60)
    print("STEP 2: Converting PNG to JPG...")
    print("=" * 60)
    
    converted_files = []
    replacements = {}
    
    for png_path in png_files:
        if args.dry_run:
            print(f"[DRY RUN] Would convert: {png_path.name}")
            jpg_path = png_path.with_suffix('.jpg')
            converted_files.append((png_path, jpg_path))
        else:
            jpg_path = convert_png_to_jpg(png_path, quality=args.quality)
            if jpg_path:
                converted_files.append((png_path, jpg_path))
    
    print(f"\n{len(converted_files)} files {'would be' if args.dry_run else ''} converted")
    print()
    
    # Build replacement mappings (relative paths from blog directory)
    for png_path, jpg_path in converted_files:
        # Get relative path from blog dir
        try:
            png_rel = png_path.relative_to(blog_dir)
            jpg_rel = jpg_path.relative_to(blog_dir)
            
            # Store with forward slashes (for web paths)
            png_ref = str(png_rel).replace('\\', '/')
            jpg_ref = str(jpg_rel).replace('\\', '/')
            
            replacements[png_ref] = jpg_ref
            
            # Also add variants (without 'assets/', just 'images/', etc.)
            if png_ref.startswith('assets/'):
                replacements[png_ref[7:]] = jpg_ref[7:]  # Remove 'assets/' prefix
        except ValueError:
            # If relative path fails, use name only
            replacements[png_path.name] = jpg_path.name
    
    # Step 3: Find files to update
    print("=" * 60)
    print("STEP 3: Finding files to update...")
    print("=" * 60)
    files_to_update = find_files_to_update(blog_dir)
    print(f"Found {len(files_to_update)} files to check for references")
    print()
    
    # Step 4: Update references
    print("=" * 60)
    print("STEP 4: Updating file references...")
    print("=" * 60)
    
    total_replacements = 0
    files_updated = 0
    
    for file_path in files_to_update:
        count = update_file_references(file_path, replacements, dry_run=args.dry_run)
        if count > 0:
            total_replacements += count
            files_updated += 1
    
    print()
    print(f"Total: {files_updated} files updated with {total_replacements} replacements")
    print()
    
    # Step 5: Optionally remove PNG files
    if args.remove_png and not args.dry_run:
        print("=" * 60)
        print("STEP 5: Removing original PNG files...")
        print("=" * 60)
        
        for png_path, jpg_path in converted_files:
            try:
                png_path.unlink()
                print(f"✓ Removed: {png_path.name}")
            except Exception as e:
                print(f"✗ Error removing {png_path}: {e}")
        
        print()
    
    # Summary
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)
    if args.dry_run:
        print("DRY RUN - No changes were made")
        print(f"Would convert: {len(converted_files)} PNG files")
        print(f"Would update: {files_updated} files")
        print(f"Total replacements: {total_replacements}")
    else:
        print(f"✓ Converted: {len(converted_files)} PNG files to JPG")
        print(f"✓ Updated: {files_updated} files")
        print(f"✓ Total replacements: {total_replacements}")
        if args.remove_png:
            print(f"✓ Removed: {len(converted_files)} PNG files")
    
    print()
    print("Done!")


if __name__ == '__main__':
    main()

