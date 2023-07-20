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
import {waitForDocumentLoad, getMostLikelyCanvas, RedditCanvas, getRedditCanvas} from './canvas';
import {Settings, CheckboxSetting, CycleSetting, ButtonSetting, DisplaySetting} from './minimap/minimap-components';
import {createMinimapUI} from './minimap/minimap-ui';
import {overlay} from './overlay';
import {ImageTemplate, Template, updateLoop} from './template/template';
import {AsyncWorkQueue, waitMs} from './utils';
import {Analytics} from './analytics';

const analytics = new Analytics(new URL('http://ponyplace-compute.ferrictorus.com/analytics/placepixel'));

function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

function logError(...args) {
  console.error(`[${new Date().toISOString()}]`, ...args);
  analytics.logError(...args);
}

(async function () {
  await waitForDocumentLoad();
  await waitMs(1000);
  let canvas = getMostLikelyCanvas();
  if (!canvas) {
    logError("Could not find a canvas, shutting down overlay.")
    return;
  }
  log("Found canvas: ", canvas);

  var redditCanvas: RedditCanvas | null = null;
  const origin = new URL(window.location.href).origin;
  if (origin.endsWith('reddit.com') || origin.endsWith('place.equestria.dev')) {
    console.log("Known site detected. Attempting to load site specific handler.");
    redditCanvas = await getRedditCanvas();
    if (redditCanvas)
      canvas = redditCanvas.canvas;
  }

  const rPlaceTemplateNames: Array<string> = [];
  const rPlaceTemplates = new Map();

  // // const githubTemplateUrlBase = "https://raw.githubusercontent.com/r-ainbowroad/2023-minimap/main/templates";
  // const githubLfsTemplateUrlBase = "https://media.githubusercontent.com/media/r-ainbowroad/2023-minimap/main/templates";
  // const getGithubLfsTemplateUrl = function (templateName: string, type: string) {
  //   return `${githubLfsTemplateUrlBase}/${templateName}/${type}.png`;
  // };
  // const addGithubLfsTemplate = function (templateName: string, options) {
  //   rPlaceTemplates.set(templateName, {
  //     canvasUrl: getGithubLfsTemplateUrl(templateName, "canvas"),
  //     autoPickUrl: options.autoPick ? getGithubLfsTemplateUrl(templateName, "autoPick") : undefined,
  //     maskUrl: options.mask ? getGithubLfsTemplateUrl(templateName, "mask") : undefined,
  //   });
  //   rPlaceTemplateNames.push(templateName);
  // };
  
  const azureBlobTemplateUrlBase = "https://ponyplace.z19.web.core.windows.net";
  const getAzureBlobTemplateUrl = function (templateName: string, type: string) {
    return `${azureBlobTemplateUrlBase}/${templateName}/${type}.png`;
  };
  const addAzureBlobTemplate = function (templateName: string, options) {
    rPlaceTemplates.set(templateName, {
      canvasUrl: getAzureBlobTemplateUrl(templateName, "canvas"),
      autoPickUrl: options.autoPick ? getAzureBlobTemplateUrl(templateName, "autopick") : undefined,
      maskUrl: options.mask ? getAzureBlobTemplateUrl(templateName, "mask") : undefined,
    });
    rPlaceTemplateNames.push(templateName);
  };

  addAzureBlobTemplate("mlp", { autoPick: true, mask: true });
  addAzureBlobTemplate("mlp_alliance", { autoPick: true, mask: true });
  
  // allies that haven't updated their canvas to support 2023
  // addAzureBlobTemplate("r-ainbowroad", { autoPick: false, mask: false });
  // addAzureBlobTemplate("spain", { autoPick: false, mask: false });
  // addAzureBlobTemplate("phoenixmc", { autoPick: false, mask: false });
  
  let rPlaceTemplateName;
  let rPlaceTemplate;
  let rPlaceMask: Array<number> | undefined;
  const setRPlaceTemplate = function (templateName) {
    const template = rPlaceTemplates.get(templateName);
    if (template === undefined) {
      logError("Invalid /r/place template name:", templateName);
      return;
    }
    rPlaceTemplateName = templateName;
    rPlaceTemplate = template;
  };
  setRPlaceTemplate(rPlaceTemplateNames[0]);

  if (!redditCanvas) {
    // Start overlay async.
    logError("Failed to find site specific handler. Falling back to overlay.");
    setRPlaceTemplate(rPlaceTemplateNames[1]);
    overlay(canvas, rPlaceTemplate);
    // Don't load the settings interface, some pixel game sites will ban you for mousedown/mouseup
    // events.
    return;
  }

  // Move camera to center
  redditCanvas.embed.camera.applyPosition({
    x: Math.floor(canvas.width / 2),
    y: Math.floor(canvas.height / 2),
    zoom: 0,
  });

  class Resizer {
    constructor(elResizer, elBlock, callback = () => {}) {
      var startX, startY, startWidth, startHeight;

      function doDrag(e) {
        elBlock.style.width = startWidth - e.clientX + startX + "px";
        elBlock.style.height = startHeight + e.clientY - startY + "px";
        callback();
      }

      function stopDrag(e) {
        document.documentElement.removeEventListener("mousemove", doDrag, false);
        document.documentElement.removeEventListener("mouseup", stopDrag, false);
      }

      function initDrag(e) {
        startX = e.clientX;
        startY = e.clientY;
        startWidth = parseInt(document.defaultView!.getComputedStyle(elBlock).width, 10);
        startHeight = parseInt(document.defaultView!.getComputedStyle(elBlock).height, 10);
        document.documentElement.addEventListener("mousemove", doDrag, false);
        document.documentElement.addEventListener("mouseup", stopDrag, false);
      }

      elResizer.addEventListener("mousedown", initDrag, false);
    }
  }

  class Emitter extends EventTarget {
    constructor() {
      super();
      var delegate = document.createDocumentFragment();
      ["addEventListener", "dispatchEvent", "removeEventListener"].forEach(
        (f) => (this[f] = (...xs) => delegate[f](...xs))
      );
    }
  }

  const posEqualsPos = function (pos0, pos1) {
    if (pos0.x !== pos1.x) {
      return false;
    }
    if (pos0.y !== pos1.y) {
      return false;
    }
    if (pos0.scale !== pos1.scale) {
      return false;
    }
    return true;
  };

  class PosParser extends Emitter {
    coordinateBlock: HTMLDivElement;
    pos: MonaLisa.Pos;

    parseCoordinateBlock() {
      if (redditCanvas!.embed.camera) {
        return {
          scale: Math.ceil(redditCanvas!.embed.camera.zoom),
          x: Math.ceil(redditCanvas!.embed.camera.cx),
          y: Math.ceil(redditCanvas!.embed.camera.cy),
        };
      }
      return {
        scale: 0,
        x: 0,
        y: 0,
      };
    }

    constructor(coordinateBlock) {
      super();
      var _root = this;
      this.coordinateBlock = coordinateBlock;
      this.pos = {
        x: 0,
        y: 0,
        scale: 0,
      };

      requestAnimationFrame(function measure(time) {
        const coordinatesData = _root.parseCoordinateBlock();
        if (!posEqualsPos(_root.pos, coordinatesData)) {
          _root.pos = coordinatesData;
          _root.dispatchEvent(new Event("posChanged"));
        }
        requestAnimationFrame(measure);
      });
    }
  }

  const coordinateBlock = await new Promise((resolve) => {
    let interval = setInterval(() => {
      try {
        const coordinateBlock = redditCanvas!.embed!.shadowRoot!
          .querySelector("garlic-bread-status-pill")!.shadowRoot!
          .querySelector("garlic-bread-coordinates")!.shadowRoot!;
        console.log("Found coordinate block. Good!");
        resolve(coordinateBlock);
        clearInterval(interval);
      } catch (e) {
        logError("Failed to attach to coordinate block. Trying again...");
      }
    }, 1000);
  });

  const posParser = new PosParser(coordinateBlock);

  const minimapUI = createMinimapUI(document);
  const mlpMinimapBlock = minimapUI.mlpMinimapBlock;
  const crosshairBlock = minimapUI.crosshairBlock;
  const settingsBlock = minimapUI.settingsBlock;

  const maskCanvas = document.createElement("canvas")!;
  maskCanvas.width = canvas.width;
  maskCanvas.height = canvas.height;
  const maskCtx = maskCanvas.getContext("2d")!;

  let updateTemplate: () => Promise<void>;

  async function downloadCanvas() {
    // Move camera to center. The entire canvas isn't loaded unless we do this.
    redditCanvas!.embed.camera.applyPosition({
      x: Math.floor(canvas!.width / 2),
      y: Math.floor(canvas!.height / 2),
      zoom: 0,
    });

    // Wait for the canvas to update.
    await waitMs(1000);

    const downloadLink = document.createElement('a');
    downloadLink.setAttribute('download', 'rplace.png');
    canvas!.toBlob((blob) => {
      const url = URL.createObjectURL(blob!);
      downloadLink.setAttribute('href', url);
      downloadLink.click();
    });
  }

  const enableAutoPickSetting = await GM.getValue('enableAutoPick', false);

  function initSettings(settings: Settings, ) {
    settings.addSetting(
      "templateName",
      new CycleSetting(
        "Template",
        rPlaceTemplateNames,
        0,
        function (templateNameSetting) {
          setRPlaceTemplate(templateNameSetting.value);
          updateTemplate();
        },
        true
      )
    );
    settings.addSetting(
      "findArt",
      new ButtonSetting("Find our art!", function () {
        findNextArt();
      })
    );
    settings.addSetting(
      "autoColor",
      new CheckboxSetting("Auto color picker", false, function (autoColorSetting) {
        // settings.getSetting("autoPick").enabled = false;
        updateTemplate();
      })
    );
    settings.addSetting(
      "autoPick",
      new CheckboxSetting("Use the priority-based template", enableAutoPickSetting, function (autoPickSetting) {
        GM.setValue('enableAutoPick', autoPickSetting.enabled);
        // settings.getSetting("autoColor").enabled = false;
        updateTemplate();
      })
    );
    settings.addSetting(
      "pixelDisplayProgress",
      new DisplaySetting("Current progress", "Unknown", true)
    );

    settings.addSetting(
      "downloadCanvas",
      new ButtonSetting("Download r/place Canvas", () => {
        downloadCanvas();
      })
    );
  }
  
  const settings = new Settings(settingsBlock, mlpMinimapBlock);
  initSettings(settings);

  const noSleepAudio = mlpMinimapBlock!.querySelector("#noSleep")! as HTMLAudioElement;
  noSleepAudio.volume = 0.1;

  const paletteButtons = redditCanvas.embed.shadowRoot!
    .querySelector("garlic-bread-color-picker")!
    .shadowRoot!.querySelectorAll(".palette button.color")! as NodeListOf<HTMLElement>;
  const palette: number[][] = [];
  for (const paletteButton of paletteButtons) {
    const parsedData = (paletteButton.children[0] as HTMLElement).style.backgroundColor.match(
      /rgb\(([0-9]{1,3}), ([0-9]{1,3}), ([0-9]{1,3})\)/
    );
    const colorID = parseInt(paletteButton.getAttribute("data-color")!);
    if (parsedData) {
      palette.push([+parsedData[1], +parsedData[2], +parsedData[3], colorID]);
    } else {
      palette.push([0, 0, 0, -1]);
    }
  }

  let template: Template | undefined = undefined;
  const templateWorkQueue = new AsyncWorkQueue();

  function loadMask() {
    const maskData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data;

    rPlaceMask = new Array(maskCanvas.width * maskCanvas.height);
    for (let i = 0; i < rPlaceMask.length; i++) {
      // Grayscale, pick green channel!
      rPlaceMask[i] = maskData[i * 4 + 1];
    }
  }

  function getClosestPalletColor(rgb) {
    let bestColor;
    let bestDiff = 255;
    for (const color of palette) {
      const diff = Math.abs(rgb[0] - color[0]) + Math.abs(rgb[1] - color[1]) + Math.abs(rgb[2] - color[2]);
      if (diff === 0)
        return color;
      if (diff < bestDiff) {
        bestDiff = diff;
        bestColor = color;
      }
    }
    return bestColor;
  }

  function palettizeTemplate(templ: Template) {
    const data = templ.template.getImageData();
    const width = templ.template.getWidth();
    const height = templ.template.getHeight();
    for (let i = 0; i < data.length / 4; i++) {
      const base = i * 4;
      const currentColor = data.slice(base, base + 3);
      if (currentColor[0] + currentColor[1] + currentColor[2] === 0) continue;
      const newColor = getClosestPalletColor(currentColor);
      data[base] = newColor[0];
      data[base + 1] = newColor[1];
      data[base + 2] = newColor[2];
    }
  }

  const applyTemplate = (templ: Template) => {
    palettizeTemplate(templ);
    minimapUI.setTemplate(templ);
    minimapUI.recalculateImagePos(posParser.pos);
    maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    if (templ.mask) {
      templ.mask.drawTo(maskCtx);
      loadMask();
    } else {
      rPlaceMask = undefined;
    }
  }

  updateTemplate = function() {
    return templateWorkQueue.enqueue(async () => {
      const rPlaceTemplateUrl =
        rPlaceTemplate.autoPickUrl !== undefined && settings.getSetting("autoPick").enabled
          ? rPlaceTemplate.autoPickUrl
          : rPlaceTemplate.canvasUrl;
      template = await ImageTemplate.fetchTemplate(rPlaceTemplateUrl, rPlaceTemplate.maskUrl);
      applyTemplate(template);
    });
  };
  await updateTemplate();
  updateLoop(templateWorkQueue, () => {
    return template!;
  }, () => {
    applyTemplate(template!);
  });

  const NEXT_ART_MIN_DIST = 100; // art within this range is considered the same
  let currentLocationIndex: number | null = null;
  function findNextArt() {
    const templateData = minimapUI.imageCanvasCtx.getImageData(0, 0, canvas!.width, canvas!.height).data;

    const locations: Array<{x: number, y: number}> = [];
    for (let i = 0; i < templateData.length; i += 4) {
      if (templateData[i + 3] === 0) continue;
      const x = (i / 4) % canvas!.width;
      const y = Math.floor(i / 4 / canvas!.width);

      const isNearOtherArt = !!locations.find(
        (loc) => Math.abs(x - loc.x) < NEXT_ART_MIN_DIST && Math.abs(y - loc.y) < NEXT_ART_MIN_DIST
      );
      if (isNearOtherArt) continue;

      locations.push({ x, y });
    }

    const sortedLocations = locations.sort((a, b) => {
      if (a.x < b.x) return -1;
      if (a.x > b.x) return 1;
      if (a.y < b.y) return -1;
      if (a.y > b.y) return 1;
      return 0;
    });

    if (sortedLocations.length > 0) {
      if (currentLocationIndex === null) {
        currentLocationIndex = 0;
      } else {
        currentLocationIndex++;
        if (currentLocationIndex >= sortedLocations.length) {
          currentLocationIndex = 0;
        }
      }
      const nextLocation = sortedLocations[currentLocationIndex];
      console.log(`Moving to art at: [x: ${nextLocation.x}, y: ${nextLocation.y}]`);
      redditCanvas!.embed.camera.applyPosition(nextLocation);
    }
  }

  /**
   * In place Fisher–Yates shuffle.
   * 
   * @param array Array to be shuffled. Modified in place.
   */
  function shuffle<T>(array: Array<T>) {
    for (let i: number = array.length; i > 0;) {
      const j = Math.floor(Math.random() * i--);
      const t = array[i];
      array[i] = array[j];
      array[j] = t;
    }
  }

  /**
   * Pick a pixel from a list of buckets
   *
   * The `position` argument is the position in the virtual pool to be selected.  See the
   * docs for `selectRandomPixelWeighted` for information on what this is hand how it
   * works
   *
   * @param {Map<number, [number, number][]>} buckets
   * @param {number} position
   * @return {[number, number]}
   */
  function pickFromBuckets(buckets: Map<number, [number, number][]>, position) {
    // All of the buckets, sorted in order from highest priority to lowest priority
    const orderedBuckets = [...buckets.entries()] // Convert map to array of tuples
      .sort(([ka], [kb]) => kb - ka); // Order by key (priority) DESC

    // Select the position'th element from the buckets
    for (const [, bucket] of orderedBuckets) {
      if (bucket.length <= position) position -= bucket.length;
      else {
        shuffle(bucket);
        return bucket[position];
      }
    }

    // If for some reason this breaks, just return a random pixel from the largest bucket
    const value = Array.from(buckets.keys()).reduce((a, b) => Math.max(a, b), 0);
    const bucket = buckets.get(value)!;
    return bucket[Math.floor(Math.random() * bucket.length)];
  }

  const FOCUS_AREA_SIZE = 75;
  /**
   * Select a random pixel weighted by the mask.
   *
   * The selection algorithm works as follows:
   * - Pixels are grouped into buckets based on the mask
   * - A virtual pool of {FOCUS_AREA_SIZE} of the highest priority pixels is defined.
   *   - If the highest priority bucket contains fewer than FOCUS_AREA_SIZE pixels, the
   *     next highest bucket is pulled from, and so on until the $FOCUS_AREA_SIZE pixel
   *     threshold is met.
   * - A pixel is picked from this virtual pool without any weighting
   *
   * This algorithm avoids the collision dangers of only using one bucket, while requiring
   * no delays, and ensures that the size of the selection pool is always constant.
   *
   * Another way of looking at this:
   * - If >= 75 pixels are missing from the crystal, 100% of the auto picks will be there
   * - If 50 pixels are missing from the crystal, 67% of the auto picks will be there
   * - If 25 pixels are missing from the crystal, 33% of the auto picks will be there
   *
   * @param {[number, number][]} diff
   * @return {[number, number]}
   */
  function selectRandomPixelWeighted(diff) {
    // Build the buckets
    const buckets = new Map();
    var totalAvailablePixels = 0;
    for (let i = 0; i < diff.length; i++) {
      const coords = diff[i];
      const [x, y] = coords;
      const maskValue = rPlaceMask![x + y * canvas!.width];
      if (maskValue === 0) {
        continue;
      }
      totalAvailablePixels++;
      const bucket = buckets.get(maskValue);
      if (bucket === undefined) {
        buckets.set(maskValue, [coords]);
      } else {
        bucket.push(coords);
      }
    }

    // Select from buckets
    // Position represents the index in the virtual pool that we are selecting
    const position = Math.floor(Math.random() * Math.min(FOCUS_AREA_SIZE, totalAvailablePixels));
    const pixel = pickFromBuckets(buckets, position);
    return pixel;
  }

  /**
   * Select a random pixel.
   *
   * @param {[number, number][]} diff
   * @return {{x: number, y: number}}
   */
  function selectRandomPixel(diff) {
    var pixel;
    if (rPlaceTemplate.maskUrl === undefined || rPlaceMask === undefined) {
      pixel = diff[Math.floor(Math.random() * diff.length)];
    } else {
      pixel = selectRandomPixelWeighted(diff);
    }
    const [x, y] = pixel;
    return { x, y };
  }

  const resizerBlock = mlpMinimapBlock.querySelector("#resizer");
  const resizerAction = new Resizer(resizerBlock, mlpMinimapBlock, () => {
    minimapUI.recalculateImagePos(posParser.pos);
  });

  function autoColorPick(imageData) {
    if (imageData.data[3] !== 255) return;

    const r = imageData.data[0];
    const g = imageData.data[1];
    const b = imageData.data[2];
    let diff: number[] = [];
    for (const color of palette) {
      diff.push(Math.abs(r - color[0]) + Math.abs(g - color[1]) + Math.abs(b - color[2]));
    }
    let correctColorID = 0;
    for (let i = 0; i < diff.length; i++) {
      if (diff[correctColorID] > diff[i]) correctColorID = i;
    }

    redditCanvas!.embed.selectedColor = palette[correctColorID][3];
  }

  function intToHex(int1) {
    return ("0" + int1.toString(16)).slice(-2);
  }

  posParser.addEventListener("posChanged", () => {
    minimapUI.recalculateImagePos(posParser.pos);
    if (settings.getSetting("autoColor").enabled) {
      try {
        const imageData = minimapUI.imageCanvasCtx.getImageData(posParser.pos.x, posParser.pos.y, 1, 1);
        autoColorPick(imageData);
      } catch (e) {
        console.error(e);
      }
    }
  });

  const autoPickCanvas = document.createElement("canvas");
  autoPickCanvas.width = canvas.width;
  autoPickCanvas.height = canvas.height;
  const autoPickCtx = autoPickCanvas.getContext("2d")!;

  function getDiff(autoPickCanvasWidth, autoPickCanvasHeight, autoPickCtx, ctx): [number[][], number] {
    const currentData = autoPickCtx.getImageData(0, 0, autoPickCanvasWidth, autoPickCanvasHeight).data;
    const templateData = ctx.getImageData(0, 0, autoPickCanvasWidth, autoPickCanvasHeight).data;

    const diff: number[][] = [];
    var nCisPixels = 0; // count of non-transparent pixels

    for (let i = 0; i < templateData.length / 4; i++) {
      if (currentData[i * 4 + 3] === 0) continue;
      nCisPixels++;
      if (
        templateData[i * 4 + 0] !== currentData[i * 4 + 0] ||
        templateData[i * 4 + 1] !== currentData[i * 4 + 1] ||
        templateData[i * 4 + 2] !== currentData[i * 4 + 2]
      ) {
        const x = i % autoPickCanvasWidth;
        const y = (i - x) / autoPickCanvasWidth;
        diff.push([x, y]);
      }
    }

    return [diff, nCisPixels];
  }

  function sendAnalytics() {
    const now = new Date().getTime();
    const reddit = now + redditCanvas!.embed.nextTileAvailableIn * 1000;
    const safe = reddit + autoPickAfterPlaceTimeout;
    analytics.placedPixel('manual-browser', rPlaceTemplateName, posParser.pos, redditCanvas!.embed.selectedColor, now,
                          {reddit: reddit, safe: safe});
  }
  redditCanvas.embed._events._getEventTarget().addEventListener("confirm-pixel", sendAnalytics);

  const autoPickTimeout = 5000;
  const autoPickAfterPlaceTimeout = 3000;

  function autoPick(isClickedManually: boolean = false) {
    templateWorkQueue.enqueue(async () => {
      // Update the minimap image (necessary for checking the diff)
      autoPickCtx.clearRect(0, 0, autoPickCanvas.width, autoPickCanvas.height);
      autoPickCtx.drawImage(minimapUI.imageCanvas, 0, 0);
      autoPickCtx.globalCompositeOperation = "source-in";
      autoPickCtx.drawImage(canvas!, 0, 0);
      autoPickCtx.globalCompositeOperation = "source-over";

      // Compute the diff
      const diffAndCisPixels = getDiff(autoPickCanvas.width, autoPickCanvas.height, autoPickCtx, minimapUI.imageCanvasCtx);
      const diff = diffAndCisPixels[0];
      const nCisPixels = diffAndCisPixels[1];

      // Analytics
      if (
          (isClickedManually && Math.random() < 0.5) || // If it being called manually (by clicking the button) - send request by 50% chance
          Math.random() < 0.01 // If it being called by timeout - send request by 1% chance
      ) {
        analytics.statusUpdate(rPlaceTemplateName, nCisPixels, diff.length);
      }

      // Update the display with current stats
      const nMissingPixels = nCisPixels - diff.length;
      const percentage = ((100 * nMissingPixels) / nCisPixels).toPrecision(3);
      settings.getSetting("pixelDisplayProgress").content = html`<span style="font-weight: bold;"
        >${percentage}% (${nMissingPixels}/${nCisPixels})</span
      >`;

      if (isClickedManually && template) {
        if (rPlaceTemplate.autoPickUrl === undefined) {
          return;
        }

        const timeOutPillBlock = redditCanvas!.embed.shadowRoot!
          .querySelector("garlic-bread-status-pill")!
          .shadowRoot!.querySelector("div")! as HTMLElement;
        log(
          `Status: ${percentage}% (${nMissingPixels}/${nCisPixels}) [${timeOutPillBlock.innerText}]`
        );

        if ((!redditCanvas!.embed.nextTileAvailableIn || isClickedManually) && diff.length > 0) {
          try {
            const randPixel = selectRandomPixel(diff);
            const imageDataRight = minimapUI.imageCanvasCtx.getImageData(randPixel.x, randPixel.y, 1, 1);
            const currentColor = autoPickCtx.getImageData(randPixel.x, randPixel.y, 1, 1);
            autoColorPick(imageDataRight);
            redditCanvas!.embed.camera.applyPosition(randPixel);
            redditCanvas!.embed.showColorPicker = true;
            const selectedColor = redditCanvas!.embed.selectedColor;
            log(`Ready to place pixel [x: ${randPixel.x}, y: ${randPixel.y}, color: ${selectedColor}, current-color: ${currentColor.data}, new-color: ${imageDataRight.data}]`);
          } catch(err) {
            console.error("Error getting pixel to place", err);
          }
        }
      }
    });
  }

  const actions = redditCanvas.embed.shadowRoot!
    .querySelector("garlic-bread-color-picker")!
    .shadowRoot!.querySelector('div > div > div.actions')! as HTMLDivElement;
  const button = document.createElement('button');
  button.innerText = "Pick Priority Pixel";
  button.setAttribute('style', "height:44px; min-width: 44px; padding: 0px; border: var(--pixel-border); box-sizing: border-box; background-color: #ffffff; flex: 1 1 0%; cursor:pointer;  color: rgb(18, 18, 18); font-size 20px; position:relative; --button-border-width: 4px; border-image-slice: 1; margin-left: 16px;");
  button.onclick = () => {autoPick(true);};
  actions.appendChild(button);

  (async () => {
    while (true) {
      await waitMs(autoPickTimeout);
      autoPick(false);
    }
  })();
})();
