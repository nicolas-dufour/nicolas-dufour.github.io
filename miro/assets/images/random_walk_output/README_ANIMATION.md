# Reward Trade-off Animation

## Overview
This animation demonstrates how MIRO responds to different reward weight configurations in real-time. It cycles through 200 different reward configurations, showing how the generated output changes as the reward weights are adjusted.

## Files Created

1. **`reward_tradeoff_animation.js`** - Main animation script
2. **Updated `index.html`** - Added animation container and script tag

## How It Works

### Animation Structure

The animation follows the same pattern as the other two animations (`miro_animation.js` and `inference_animation.js`):

1. **Layout**:
   - **Desktop**: Prompt at top center, MIRO model in center, reward histogram on left, output image on right
   - **Mobile**: Vertical stack - prompt, model, histogram, output

2. **Animation Cycle**:
   - Pause at start (2 seconds)
   - Cycle through 200 frames (150ms per frame = 30 seconds total)
   - Pause at end (2 seconds)
   - Loop

3. **Interactive Features**:
   - Auto-plays when scrolled into view
   - Click to pause/play
   - Responsive design for mobile and desktop

### Data Flow

1. **CSV Loading**: Loads `uncoherence_values.csv` with 200 rows of 7 reward weights each
2. **Image Loading**: Dynamically loads images `frame_0000.jpg` to `frame_0199.jpg`
3. **Preloading**: Preloads ±5 frames around current frame for smooth playback
4. **Memory Management**: Cleans up frames that are far from current position

### Reward Dimensions

The animation displays 7 reward dimensions (matching CSV columns):
1. CLIP - Text-image semantic correspondence
2. Aesthetic - Overall visual appeal
3. ImageReward - Human preference alignment
4. PickScore - User preference
5. HPSv2 - Composition and preference
6. VQA - Visual reasoning
7. SciScore - Scientific correctness

## Configuration

You can adjust these parameters in `reward_tradeoff_animation.js`:

```javascript
animation: {
    frameDuration: 150,     // ms per frame (default: 150ms)
    pauseDuration: 2000,    // ms pause at start/end (default: 2s)
    numRewards: 7,          // number of reward dimensions
}
```

## Testing

To test the animation:

1. Open `blog/index.html` in a web browser
2. Navigate to the "Method" section
3. Scroll to "3. Flexible Reward Trade-offs"
4. The animation should start automatically when scrolled into view
5. Click to pause/play

## Customization

### Change Animation Speed
Edit `frameDuration` in the config (line 50):
```javascript
frameDuration: 100, // Faster (100ms per frame)
```

### Change Pause Duration
Edit `pauseDuration` in the config (line 51):
```javascript
pauseDuration: 1000, // 1 second pause
```

### Adjust Layout
Modify the `layout` section in CONFIG (lines 60-103) for mobile and desktop layouts.

### Color Scheme
The animation uses the same color palette as the other animations, pulling from CSS variables:
- `--fg` - Foreground text
- `--card` - Card background
- `--accent` - Accent color (orange)
- `--muted` - Muted text

## Troubleshooting

### Images Not Loading
- Check that all 200 images exist in `assets/images/random_walk_output/`
- Verify image names match pattern `frame_0000.jpg` to `frame_0199.jpg`
- Check browser console for loading errors

### CSV Not Loading
- Ensure `uncoherence_values.csv` is in `assets/images/random_walk_output/`
- Check browser console for fetch errors
- Verify CSV format matches expected structure

### Animation Not Starting
- Check that container `#rewardTradeoffAnimation` exists in HTML
- Verify p5.js library is loaded
- Check browser console for JavaScript errors

## Performance Notes

- The animation preloads ±5 frames to ensure smooth playback
- Old frames are cleaned up to prevent memory issues
- Uses IntersectionObserver to only animate when visible
- Mobile layout is optimized for smaller screens

