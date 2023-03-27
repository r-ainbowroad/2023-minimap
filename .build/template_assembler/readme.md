This is the template assembler

1. Make a `template.json` in some folder which complies with the [template schema.md](template schema.md) and add the images

    The suggestion here would be to put the images referenced by the template in a subfolder e.g. `source`

1. From the repo root, invoke the script and provide the path to the folder where you created `template.json`

    e.g.

    * `./.build/template_assembler/assemble_template.py ./templates/mlp`

1. The script will produce `canvas.png`, `bot.png`, `mask.png`, `endu.png` and `endu_template.json` in that folder

    The names are this way for legacy/compatibility with past years' naming schemes. Due to canvas resizing, they may end up with suffixes e.g. `bot2k.png`
    
    * `canvas.png`: pony art and ally art
    * `bot.png`: only the art which we want our bots/automation working on
    * `mask.png`: a priority mask indicating what order bots will fix pixels in; brighter is faster
    * `endu.png`: **only** the pony art, trimmed to the extents of the art; you should consume this via...
    * `endu_template.json`: an osu!/Endu-style template for integrating our art with our allies

1. Check in the updates to everything and push it into the repo

1. The files will be available through several sources, in order of preference

    * [MLP only] Azure blob: `https://ponyplace.z19.web.core.windows.net/canvas.png`
    * GitHub LFS: `https://media.githubusercontent.com/media/r-ainbowroad/2023-minimap/main/template/mlp/canvas.png`
    * GitHub regular: `https://raw.githubusercontent.com/r-ainbowroad/2023-minimap/main/template/mlp/canvas.png`

    Swap `mlp` out with your template name as appropriate

1. Make more updates, commit, push, etc
