# Formatting
Make sure to format according to the comment in the `minimap.impl.user.js`.

# Masks
Masks are supported for prioritization. You can put pixels into buckets by adding a `mask2k.png` with green channels
ranging from 0 to 255. Other channels are ignored, so grayscale works fine. The bot will select 150 bad pixels,
starting with ones in the highest bucket, then randomly pick one to fix.
