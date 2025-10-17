# Reward Trade-off Animation - Quick Start Guide

## What Was Created

A new interactive animation that demonstrates MIRO's flexible reward trade-offs by cycling through 200 different reward configurations and showing the corresponding generated outputs.

## Files Modified/Created

### ✅ Created
- `assets/js/reward_tradeoff_animation.js` - Main animation script (554 lines)
- `assets/images/random_walk_output/README_ANIMATION.md` - Detailed documentation

### ✅ Modified
- `index.html` - Added animation container in the "Flexible Reward Trade-offs" section
- `index.html` - Added script tag to load the animation

## Animation Features

### Visual Layout

**Desktop View:**
```
                    [Prompt]
                    
[Reward Histogram]  [MIRO]  [Output Image]
     (left)        (center)     (right)
```

**Mobile View:**
```
              [Prompt]
              
              [MIRO]
              
         [Reward Histogram]
         
          [Output Image]
```

### Animation Flow

1. **Start**: Pauses for 2 seconds showing frame 0
2. **Animate**: Cycles through 200 frames at 150ms per frame (30 seconds)
3. **End**: Pauses for 2 seconds at frame 199
4. **Loop**: Returns to start and repeats

### Interactive Controls

- **Auto-play**: Starts automatically when scrolled into view
- **Click to pause/play**: Click anywhere on the animation
- **Responsive**: Adapts to mobile and desktop screens

## Data Source

The animation uses:
- **Images**: `assets/images/random_walk_output/frame_0000.jpg` to `frame_0199.jpg` (200 images)
- **Rewards**: `assets/images/random_walk_output/uncoherence_values.csv` (200 rows × 7 rewards)

## Reward Visualization

The histogram shows 7 colored bars representing:
1. 🔵 **CLIP** (teal) - Text-image alignment
2. 🟢 **Aesthetic** (green) - Visual quality
3. 🔴 **ImageReward** (red) - Human preference
4. 🌸 **PickScore** (pink) - User preference
5. 🔵 **HPSv2** (blue) - Composition
6. 🟡 **VQA** (yellow) - Visual reasoning
7. 🟣 **SciScore** (purple) - Scientific correctness

## How to Test

### Option 1: Local Server
```bash
cd blog
python -m http.server 8000
# Open http://localhost:8000 in browser
```

### Option 2: Direct Open
1. Open `blog/index.html` in your browser
2. Scroll to "Method" → "Flexible Reward Trade-offs"
3. Watch the animation start automatically

## Performance

- **Smooth playback**: Preloads ±5 frames ahead
- **Memory efficient**: Cleans up old frames automatically
- **Optimized**: Only animates when visible in viewport
- **Total cycle time**: ~34 seconds (2s + 30s + 2s)

## Customization Quick Reference

### Speed Control
```javascript
// In reward_tradeoff_animation.js, line 50
frameDuration: 150,  // Change to 100 for faster, 200 for slower
```

### Pause Duration
```javascript
// In reward_tradeoff_animation.js, line 51
pauseDuration: 2000,  // Change to adjust start/end pause
```

### Animation Range
```javascript
// To use fewer frames (e.g., first 100 only)
// In reward_tradeoff_animation.js, line 46
totalFrames: 100  // Instead of 200
```

## Troubleshooting

### Animation doesn't start
- ✅ Check browser console for errors
- ✅ Verify p5.js is loaded (should see it in Network tab)
- ✅ Ensure container `#rewardTradeoffAnimation` exists

### Images not loading
- ✅ Check image paths in console
- ✅ Verify all 200 PNG files exist
- ✅ Check file naming: `frame_0000.jpg` not `frame_000.jpg`

### CSV errors
- ✅ Verify CSV is at `assets/images/random_walk_output/uncoherence_values.csv`
- ✅ Check CSV has 201 lines (1 header + 200 data rows)
- ✅ Ensure 7 reward columns (after frame number)

## Integration with Existing Animations

This animation follows the same pattern as:
- `miro_animation.js` - Training pipeline visualization
- `inference_animation.js` - Inference process visualization

All three share:
- Similar code structure and organization
- Same styling and color scheme
- Consistent user interaction patterns
- Responsive design approach

## Next Steps

After testing, you might want to:
1. **Adjust timing**: Make animation faster/slower based on user feedback
2. **Add controls**: Add play/pause button or frame scrubber
3. **Enhance visuals**: Add transition effects between frames
4. **Add labels**: Show current reward values as numbers
5. **Interactive mode**: Allow users to manually adjust reward weights

## Questions?

If you encounter issues:
1. Check browser console for errors
2. Review `README_ANIMATION.md` for detailed troubleshooting
3. Verify all file paths are correct
4. Test with a simple local server to avoid CORS issues

