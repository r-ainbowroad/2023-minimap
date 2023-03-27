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
import {Settings, CheckboxSetting, CycleSetting, ButtonSetting, DisplaySetting} from './minimap/minimap-components';
import {createMinimapUI} from './minimap/minimap-ui';
import {ImageTemplate} from './template/template';
import {Analytics} from './analytics';

(async function () {
  const embed: MonaLisa.Embed = await new Promise((resolve) => {
    let interval = setInterval(() => {
      try {
        const embed = document.querySelector("mona-lisa-embed") as MonaLisa.Embed;
        console.log("Found embed. Good!");
        resolve(embed);
        clearInterval(interval);
      } catch (e) {
        console.error("Found embed. Trying again...");
      }
    }, 1000);
  })!;

  const rPlaceCanvas: HTMLCanvasElement = await new Promise((resolve) => {
    let interval = setInterval(() => {
      try {
        const rPlaceCanvas: HTMLCanvasElement = embed!.shadowRoot!
          .querySelector("mona-lisa-share-container mona-lisa-canvas")!
          .shadowRoot!.querySelector("canvas")!;
        console.log("Found canvas. Good!");
        resolve(rPlaceCanvas);
        clearInterval(interval);
      } catch (e) {
        console.error("Failed to attach to canvas. Trying again...");
      }
    }, 1000);
  })!;

  // Move camera to center
  embed.camera.applyPosition({
    x: Math.floor(rPlaceCanvas.width / 2),
    y: Math.floor(rPlaceCanvas.height / 2),
    zoom: 0,
  });

  const rPlaceTemplatesGithubLfs = true;
  const rPlaceTemplateBaseUrl = rPlaceTemplatesGithubLfs
    ? "https://media.githubusercontent.com/media/r-ainbowroad/2023-minimap/main/templates"
    : "https://raw.githubusercontent.com/r-ainbowroad/2023-minimap/main/templates";
  const getRPlaceTemplateUrl = function (templateName: string, type: string) {
    return `${rPlaceTemplateBaseUrl}/${templateName}/${type}.png`;
  };
  const rPlaceTemplateNames: Array<string> = [];
  const rPlaceTemplates = new Map();
  const addRPlaceTemplate = function (templateName: string, options) {
    rPlaceTemplates.set(templateName, {
      canvasUrl: getRPlaceTemplateUrl(templateName, "canvas"),
      botUrl: options.bot ? getRPlaceTemplateUrl(templateName, "bot") : undefined,
      maskUrl: options.mask ? getRPlaceTemplateUrl(templateName, "mask") : undefined,
    });
    rPlaceTemplateNames.push(templateName);
  };
  addRPlaceTemplate("mlp", { bot: true, mask: true });
  addRPlaceTemplate("whiteout_mlp", { bot: true, mask: false });
  addRPlaceTemplate("r-ainbowroad", { bot: true, mask: true });
  addRPlaceTemplate("spain", { bot: true, mask: true });
  addRPlaceTemplate("phoenixmc", { bot: true, mask: true });
  let rPlaceTemplateName;
  let rPlaceTemplate;
  let rPlaceMask: Array<number> | undefined;
  const setRPlaceTemplate = function (templateName) {
    const template = rPlaceTemplates.get(templateName);
    if (template === undefined) {
      console.log("Invalid /r/place template name:", templateName);
      return;
    }
    rPlaceTemplateName = templateName;
    rPlaceTemplate = template;
  };
  setRPlaceTemplate(rPlaceTemplateNames[0]);

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
      const parsedData = this.coordinateBlock.innerText.match(/\(([0-9]+),([0-9]+)\) ([0-9.]+)x/);
      if (parsedData) {
        return {
          x: parseInt(parsedData[1]),
          y: parseInt(parsedData[2]),
          scale: parseFloat(parsedData[3]),
        };
      }
      return {
        x: 0,
        y: 0,
        scale: 0,
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
        const coordinateBlock = embed!.shadowRoot!
          .querySelector("mona-lisa-coordinates")!
          .shadowRoot!.querySelector("div")!;
        console.log("Found coordinate block. Good!");
        resolve(coordinateBlock);
        clearInterval(interval);
      } catch (e) {
        console.error("Failed to attach to coordinate block. Trying again...");
      }
    }, 1000);
  });

  const posParser = new PosParser(coordinateBlock);

  const minimapUI = createMinimapUI(document);
  const mlpMinimapBlock = minimapUI.mlpMinimapBlock;
  const crosshairBlock = minimapUI.crosshairBlock;
  const settingsBlock = minimapUI.settingsBlock;

  const maskCanvas = document.createElement("canvas")!;
  maskCanvas.width = rPlaceCanvas.width;
  maskCanvas.height = rPlaceCanvas.height;
  const maskCtx = maskCanvas.getContext("2d")!;

  let updateTemplate = function () {};

  async function downloadCanvas() {
    // Move camera to center. The entire canvas isn't loaded unless we do this.
    embed.camera.applyPosition({
      x: Math.floor(rPlaceCanvas.width / 2),
      y: Math.floor(rPlaceCanvas.height / 2),
      zoom: 0,
    });

    // Wait for the canvas to update.
    await waitMs(1000);

    const downloadLink = document.createElement('a');
    downloadLink.setAttribute('download', 'rplace.png');
    rPlaceCanvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob!);
      downloadLink.setAttribute('href', url);
      downloadLink.click();
    });
  }

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
        settings.getSetting("bot").enabled = false;
        updateTemplate();
      })
    );
    settings.addSetting(
      "bot",
      new CheckboxSetting("Bot", false, function (botSetting) {
        settings.getSetting("autoColor").enabled = false;
        updateTemplate();
      })
    );
    settings.addSetting(
      "botstability",
      new CheckboxSetting("Bot stability (🔇 Need to mute tab)", false)
    );
    setInterval(() => {
      if (settings.getSetting("botstability").enabled) {
        noSleepAudio.play();
      }
    }, 30000);

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
  
    settings.addSetting(
      "pythonBot",
      new ButtonSetting("Python bot", function (pythonBotSetting) {
        window.open("https://github.com/CloudburstSys/PonyPixel");
      })
    );

    const newDonateSetting = function (name, url) {
      return new ButtonSetting(`Donate (${name})`, function (donateSetting) {
        window.open(url);
      });
    };
    settings.addSetting(
      "donatePonywka",
      newDonateSetting(
        "Midnight Ponywka - primary dev, MLP template",
        "https://www.donationalerts.com/r/vovskic2002"
      )
    );
    settings.addSetting(
      "donateCloudburstSys",
      newDonateSetting(
        "Twi/Leah (@CloudburstSys) - primary Python dev",
        "https://ko-fi.com/cloudburstsys"
      )
    );
    settings.addSetting(
      "donateAlchEmi",
      newDonateSetting(
        "Ember Hearth (@Alch-Emi) - dev (priority, progress)",
        "https://paypal.me/alchemi336"
      )
    );
    settings.addSetting(
      "donateBb010g",
      newDonateSetting(
        "Dusk 💛 💜 (@bb010g) - dev (GitHub org, dev install, multi-template, UI, bot), r/ainbowroad template",
        "https://www.tgijp.org/"
      )
    );
    settings.addSetting(
      "donateOctylFractal",
      newDonateSetting(
        "octylFractal - dev (bugfixes), MLP template",
        "https://github.com/sponsors/octylFractal"
      )
    );
    settings.addSetting(
      "donateLumiereEleve",
      newDonateSetting("Lumière Élevé - Python dev", "https://buymeacoffee.com/belkasempaiowo")
    );
  }
  
  const settings = new Settings(settingsBlock, mlpMinimapBlock);
  initSettings(settings);

  const noSleepAudio = mlpMinimapBlock!.querySelector("#noSleep")! as HTMLAudioElement;
  noSleepAudio.volume = 0.1;

  let botLock = false;

  // Fetch template, returns a Promise<Uint8Array>, on error returns the response object
  function fetchTemplate(url) {
    return new Promise((resolve, reject) => {
      GM.xmlHttpRequest({
        method: "GET",
        responseType: "arraybuffer",
        url: `${url}?t=${new Date().getTime()}`,
        onload: function (res) {
          resolve(new Uint8Array(res.response));
        },
        onerror: function (res) {
          reject(res);
        },
      });
    });
  }

  function getPngDataUrlForBytes(bytes) {
    return "data:image/png;base64," + btoa(String.fromCharCode.apply(null, bytes));
  }

  updateTemplate = function () {
    botLock = true;
    const rPlaceTemplateUrl =
      rPlaceTemplate.botUrl !== undefined && settings.getSetting("bot").enabled
        ? rPlaceTemplate.botUrl
        : rPlaceTemplate.canvasUrl;

    ImageTemplate.fetchTemplate(rPlaceTemplateUrl, undefined)
      .then((imgTemplate) => {
        minimapUI.setTemplate(imgTemplate);
        minimapUI.recalculateImagePos(posParser.pos);
        botLock = false;
      }).catch((err) => {
        console.error("Error updating template", err);
      });;


    // Also update mask if needed
    if (typeof rPlaceTemplate.maskUrl !== "undefined") {
      fetchTemplate(rPlaceTemplate.maskUrl)
        .then((array) => {
          const img = new Image();
          img.src = getPngDataUrlForBytes(array);
          img.onload = () => {
            maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
            maskCtx.drawImage(img, 0, 0);
            loadMask();
          };
        })
        .catch((err) => {
          console.error("Error updating mask", err);
        });
    } else {
      // Free memory if we don't need it.
      rPlaceMask = undefined;
    }
  };
  setInterval(updateTemplate, 1 * 60 * 1000);
  updateTemplate();

  function loadMask() {
    const maskData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data;

    rPlaceMask = new Array(maskCanvas.width * maskCanvas.height);
    for (let i = 0; i < rPlaceMask.length; i++) {
      // Grayscale, pick green channel!
      rPlaceMask[i] = maskData[i * 4 + 1];
    }
  }

  const NEXT_ART_MIN_DIST = 100; // art within this range is considered the same
  let currentLocationIndex: number | null = null;
  function findNextArt() {
    const templateData = minimapUI.imageCanvasCtx.getImageData(0, 0, rPlaceCanvas.width, rPlaceCanvas.height).data;

    const locations: Array<{x: number, y: number}> = [];
    for (let i = 0; i < templateData.length; i += 4) {
      if (templateData[i + 3] === 0) continue;
      const x = (i / 4) % rPlaceCanvas.width;
      const y = Math.floor(i / 4 / rPlaceCanvas.width);

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
      embed.camera.applyPosition(nextLocation);
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
   * - If >= 75 pixels are missing from the crystal, 100% of the bots will be working there
   * - If 50 pixels are missing from the crystal, 67% of the bots will be working there
   * - If 25 pixels are missing from the crystal, 33% of the bots will be working there
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
      const maskValue = rPlaceMask![x + y * rPlaceCanvas.width];
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

  const paletteButtons = embed.shadowRoot!
    .querySelector("mona-lisa-color-picker")!
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

    embed.selectedColor = palette[correctColorID][3];
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

  const botCanvas = document.createElement("canvas");
  botCanvas.width = rPlaceCanvas.width;
  botCanvas.height = rPlaceCanvas.height;
  const botCtx = botCanvas.getContext("2d")!;

  function getDiff(botCanvasWidth, botCanvasHeight, botCtx, ctx): [number[][], number] {
    const currentData = botCtx.getImageData(0, 0, botCanvasWidth, botCanvasHeight).data;
    const templateData = ctx.getImageData(0, 0, botCanvasWidth, botCanvasHeight).data;

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
        const x = i % botCanvasWidth;
        const y = (i - x) / botCanvasWidth;
        diff.push([x, y]);
      }
    }

    return [diff, nCisPixels];
  }

  function waitMs(ms) {
    return new Promise<void>((resolve) =>
      setTimeout(() => {
        resolve();
      }, ms)
    );
  }

  function log(...args) {
    console.log(`[${new Date().toISOString()}]`, ...args);
  }

  function logError(...args) {
    console.error(`[${new Date().toISOString()}]`, ...args);
  }

  const botTimeout = 5000;
  const botAfterPlaceTimeout = 3000;
  (async () => {
    const analytics = new Analytics(new URL('http://example.com'));

    while (true) {
      // Update the minimap image (necessary for checking the diff)
      botCtx.clearRect(0, 0, botCanvas.width, botCanvas.height);
      botCtx.drawImage(minimapUI.imageCanvas, 0, 0);
      botCtx.globalCompositeOperation = "source-in";
      botCtx.drawImage(rPlaceCanvas, 0, 0);
      botCtx.globalCompositeOperation = "source-over";

      // Compute the diff
      const diffAndCisPixels = getDiff(botCanvas.width, botCanvas.height, botCtx, minimapUI.imageCanvasCtx);
      const diff = diffAndCisPixels[0];
      const nCisPixels = diffAndCisPixels[1];

      // Update the display with current stats
      const nMissingPixels = nCisPixels - diff.length;
      const percentage = ((100 * nMissingPixels) / nCisPixels).toPrecision(3);
      settings.getSetting("pixelDisplayProgress").content = html`<span style="font-weight: bold;"
        >${percentage}% (${nMissingPixels}/${nCisPixels})</span
      >`;

      if (settings.getSetting("bot").enabled && !botLock) {
        if (rPlaceTemplate.botUrl === undefined) {
          return;
        }
        embed.wakeUp();

        if (settings.getSetting("botstability").enabled) {
          // Move camera to center
          embed.camera.applyPosition({
            x: Math.floor(rPlaceCanvas.width / 2),
            y: Math.floor(rPlaceCanvas.height / 2),
            zoom: 0,
          });
        }

        const timeOutPillBlock = embed.shadowRoot!
          .querySelector("mona-lisa-status-pill")!
          .shadowRoot!.querySelector("div")! as HTMLElement;
        log(
          `Status: ${percentage}% (${nMissingPixels}/${nCisPixels}) [${timeOutPillBlock.innerText}]`
        );

        if (!embed.nextTileAvailableIn && diff.length > 0) {
          try {
            const randPixel = selectRandomPixel(diff);
            const imageDataRight = minimapUI.imageCanvasCtx.getImageData(randPixel.x, randPixel.y, 1, 1);
            autoColorPick(imageDataRight);
            embed.camera.applyPosition(randPixel);
            embed.showColorPicker = true;
            const selectedColor = embed.selectedColor;
            embed
              .onConfirmPixel()
              .then(() => {
                log(`Placed [x: ${randPixel.x}, y: ${randPixel.y}, color: ${selectedColor}]`);
                const now = new Date().getTime();
                const reddit = now + embed.nextTileAvailableIn * 1000;
                const safe = reddit + botAfterPlaceTimeout;
                analytics.placedPixel('bot-browser', randPixel, selectedColor, now,
                                      {reddit: reddit, safe: safe});
              })
              .catch(() => {
                logError(`FAILED! [x: ${randPixel.x}, y: ${randPixel.y}, color: ${selectedColor}]`);
              });
          } catch(err) {
            console.error("Error getting pixel to place", err);
          }
          await waitMs(botAfterPlaceTimeout);
        }
      }

      await waitMs(botTimeout);
    }
  })().then((r) => {});
})();
