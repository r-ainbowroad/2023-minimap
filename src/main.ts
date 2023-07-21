/**
 *
 * Part of the MLP r/place Project, under the Apache License v2.0 or ISC.
 * SPDX-License-Identifier: Apache-2.0 OR ISC
 * SPDX-FileCopyrightText: Copyright CONTRIBUTORS.md
 *
 **
 *
 * @file All of the minimap. This needs to be split up.
 *
 **/

import {html} from 'uhtml';
import {waitForDocumentLoad, RedditCanvas, getRedditCanvas} from './canvas';
import {
  CheckboxSetting,
  CycleSetting,
  ButtonSetting,
  DisplaySetting, Settings,
} from './minimap/minimap-components';
import {MinimapUI, createMinimapUI} from './minimap/minimap-ui';
import {Overlay, fallbackOverlay} from './overlay';
import {ImageTemplate} from './template/template';
import {waitMs, BlobServer} from './utils';
import {Analytics} from './analytics';
import {MinimapTemplateController} from './templateController';
import {CanvasComparer} from './canvasComparer';

const analytics = new Analytics(new URL('http://ponyplace-compute.ferrictorus.com/analytics/placepixel'));

const comparerTimeout = 5000;
const autoPickAfterPlaceTimeout = 3000;

function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

function logError(...args) {
  console.error(`[${new Date().toISOString()}]`, ...args);
  analytics.logError(...args);
}

class Minimap {
  rPlace: RedditCanvas | undefined = undefined;
  overlay: Overlay | undefined = undefined;
  rPlaceCanvas: HTMLCanvasElement | undefined = undefined;
  templateCanvas: HTMLCanvasElement | undefined = undefined;
  maskCanvas: HTMLCanvasElement | undefined = undefined;
  comparer: CanvasComparer | undefined = undefined;
  settings: Settings | undefined = undefined;
  ui: MinimapUI | undefined = undefined;

  templates: MinimapTemplateController = new MinimapTemplateController();

  async takeScreenshotOfCanvas() {
    // Move camera to center. The entire canvas isn't loaded unless we do this.
    this.rPlace!.camera.applyPosition({
      x: Math.floor(this.rPlaceCanvas!.width / 2),
      y: Math.floor(this.rPlaceCanvas!.height / 2),
      zoom: 0,
    });

    // Wait for the canvas to update.
    await waitMs(1000);

    const downloadLink = document.createElement('a');
    downloadLink.setAttribute('download', 'rplace.png');
    this.rPlaceCanvas!.toBlob((blob) => {
      const url = URL.createObjectURL(blob!);
      downloadLink.setAttribute('href', url);
      downloadLink.click();
    });
  }

  selectRandPix() {
    this.comparer!.computeDiff();
    if (this.comparer!.countOfWrongPixels > 0) {
      try {
        const randPixel = this.comparer!.selectRandomPixelFromDiff();
        const imageDataRight = this.templateCanvas!.getContext("2d")!.getImageData(randPixel.x, randPixel.y, 1, 1);
        const currentColor = this.rPlaceCanvas!.getContext("2d")!.getImageData(randPixel.x, randPixel.y, 1, 1);
        this.pickColorFromPixel(imageDataRight);
        this.rPlace!.camera.applyPosition(randPixel);
        this.rPlace!.embed.showColorPicker = true;
        const selectedColor = this.rPlace!.embed.selectedColor;
        log(`Ready to place pixel [x: ${randPixel.x}, y: ${randPixel.y}, color: ${selectedColor}, current-color: ${currentColor.data}, new-color: ${imageDataRight.data}]`);
      } catch (err) {
        console.error("Error getting pixel to place", err);
      }
    }
  }

  async initialize() {
    this.templates.set(this.templates.keys[0]);

    await waitForDocumentLoad();
    await waitMs(1000);
    this.rPlace = await getRedditCanvas();
    if (!this.rPlace) {
      const canvas = this.rPlace!.canvas;
      // Start overlay async.
      logError("Failed to find site specific handler. Falling back to overlay.");
      await fallbackOverlay(canvas, this.templates.currentTemplate.url);
      // Don't load the settings interface, some pixel game sites will ban you for mousedown/mouseup
      // events.
      return;
    }

    this.ui = createMinimapUI(document);
    this.rPlaceCanvas = this.rPlace.canvas;
    this.settings = new Settings(this.ui.settingsBlock, this.ui.mlpMinimapBlock);
    this.templateCanvas = this.ui.imageCanvas;
    this.maskCanvas = document.createElement("canvas");
    this.maskCanvas.width = this.rPlaceCanvas.width;
    this.maskCanvas.height = this.rPlaceCanvas.height;
    this.comparer = new CanvasComparer(this.rPlaceCanvas, this.templateCanvas, this.maskCanvas);

    this.settings.addSetting(
      "templateName",
      new CycleSetting(
        "Template",
        this.templates.keys,
        0,
        (templateNameSetting) => {
          this.templates.set(templateNameSetting.value);
          this.templates.fetch(this.settings!.getSetting("autoPick").enabled);
        },
        true
      )
    );

    this.settings.addSetting(
      "findArt",
      new ButtonSetting("Find our art!", () => {
        const nextLocation = this.comparer!.findNextArt();
        if (!nextLocation)
          throw {message: "Next location not found!"};
        console.log(`Moving to art at: [x: ${nextLocation.x}, y: ${nextLocation.y}]`);
        this.rPlace!.camera.applyPosition(nextLocation);
      })
    );

    const enableAutoColorSetting = await GM.getValue('enableAutoColor', false);
    this.settings.addSetting(
      "autoColor",
      new CheckboxSetting("Auto color picker", enableAutoColorSetting, (autoColorSettings) => {
        GM.setValue('enableAutoColor', autoColorSettings.enabled);
      })
    );

    const enableAutoPickSetting = await GM.getValue('enableAutoPick', false);
    this.settings.addSetting(
      "autoPick",
      new CheckboxSetting("Use the priority-based template", enableAutoPickSetting, (autoPickSetting) => {
        GM.setValue('enableAutoPick', autoPickSetting.enabled);
        this.templates!.fetch(autoPickSetting.enabled);
      })
    );

    const enableOverlay = await GM.getValue('enableOverlay', false);
    this.settings.addSetting(
      "overlay",
      new CheckboxSetting("Fullscreen overlay", enableOverlay, (overlaySetting) => {
        GM.setValue('enableOverlay', overlaySetting.enabled);
        if (overlaySetting.enabled) {
          this.overlay!.show();
        } else {
          this.overlay!.hide();
        }
      })
    );

    this.settings.addSetting(
      "pixelDisplayProgress",
      new DisplaySetting("Current progress", "Unknown", true)
    );

    this.settings.addSetting(
      "downloadCanvas",
      new ButtonSetting("Download r/place Canvas", () => {
        this.takeScreenshotOfCanvas();
      })
    );

    this.templates.addEventListener("templateFetched", () => {
      const template = this.templates.currentTemplate.obj;
      template!.palettize(this.rPlace!.palette);
      this.ui!.setTemplate(template!);
      this.ui!.recalculateImagePos(this.rPlace!.position.pos);
      if (this.overlay instanceof Overlay) {
        this.overlay.applyTemplate(template!);
      } else {
        this.overlay = new Overlay(this.rPlaceCanvas!, null, template!);
        if (!this.settings!.getSetting("overlay").enabled) this.overlay.hide();
      }
      const maskCtx = this.maskCanvas!.getContext("2d");
      maskCtx!.clearRect(0, 0, this.maskCanvas!.width, this.maskCanvas!.height);
      if (template!.mask) {
        template!.mask.drawTo(maskCtx!);
      }
    });

    const actions = this.rPlace!.embed
      .shadowRoot!.querySelector("garlic-bread-color-picker")!
      .shadowRoot!.querySelector('div > div > div.actions')! as HTMLDivElement;
    const button = document.createElement('button');
    button.innerText = "Pick Priority Pixel";
    button.setAttribute('style', "height:44px; min-width: 44px; padding: 0px; border: var(--pixel-border); box-sizing: border-box; background-color: #ffffff; flex: 1 1 0%; cursor:pointer;  color: rgb(18, 18, 18); font-size 20px; position:relative; --button-border-width: 4px; border-image-slice: 1; margin-left: 16px;");
    button.onclick = () => {
      this.selectRandPix();
    };
    actions.appendChild(button);

    this.comparer!.setInterval(comparerTimeout);
    this.comparer!.addEventListener("computed", () => {
      const percentage = ((100 * this.comparer!.countOfRightPixels) / this.comparer!.countOfAllPixels).toPrecision(3);
      this.settings!.getSetting("pixelDisplayProgress").content = html`<span style="font-weight: bold;">${percentage}
          % (${this.comparer!.countOfRightPixels}/${this.comparer!.countOfAllPixels})</span>`;
    });

    this.rPlace.position.addEventListener("posChanged", () => {
      this.ui!.recalculateImagePos(this.rPlace!.position.pos);
      if (this.settings!.getSetting("autoColor").enabled) {
        try {
          const imageData = this.ui!.imageCanvasCtx.getImageData(this.rPlace!.position.pos.x, this.rPlace!.position.pos.y, 1, 1);
          this.pickColorFromPixel(imageData);
        } catch (e) {
          console.error(e);
        }
      }
    });

    await this.templates.fetch(this.settings.getSetting("autoPick").enabled);
  }

  pickColorFromPixel(imageData) {
    if (imageData.data[3] !== 255) return;

    const r = imageData.data[0];
    const g = imageData.data[1];
    const b = imageData.data[2];
    let diff: number[] = [];
    for (const color of this.rPlace!.palette) {
      diff.push(Math.abs(r - color[0]) + Math.abs(g - color[1]) + Math.abs(b - color[2]));
    }
    let correctColorID = 0;
    for (let i = 0; i < diff.length; i++) {
      if (diff[correctColorID] > diff[i]) correctColorID = i;
    }

    this.rPlace!.embed.selectedColor = this.rPlace!.palette[correctColorID][3];
  }
}

(async function () {
  const minimap = new Minimap();

  const blobServer = new BlobServer("https://ponyplace.z19.web.core.windows.net");
  minimap.templates.add("mlp_alliance", blobServer.getTemplate("mlp_alliance", {autoPick: true, mask: true}));
  minimap.templates.add("mlp", blobServer.getTemplate("mlp", {autoPick: true, mask: true}));

  await minimap.initialize();

  // Analytics
  minimap.rPlace!.embed._events._getEventTarget().addEventListener("confirm-pixel", () => {
    const now = new Date().getTime();
    const reddit = now + minimap.rPlace!.embed.nextTileAvailableIn * 1000;
    const safe = reddit + autoPickAfterPlaceTimeout;
    analytics.placedPixel('manual-browser', minimap.templates.currentTemplate.name, minimap.rPlace!.position.pos, minimap.rPlace!.embed.selectedColor, now, {
      reddit: reddit,
      safe: safe
    });
  });
  minimap.comparer!.addEventListener("computed", () => {
    if (Math.random() < 0.01) {
      analytics.statusUpdate(
        minimap.templates.currentTemplate.name,
        minimap.comparer!.countOfAllPixels,
        minimap.comparer!.countOfWrongPixels
      );
    }
  });
})();
