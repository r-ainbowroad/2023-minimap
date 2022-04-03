// ==UserScript==
// @name        DO NOT DIRECTLY USE THIS IMPLEMENTATION OF r/Place MLP Minimap
// @namespace   http://tampermonkey.net/
// @description STOP; DO NOT DIRECTLY USE THIS
// @include     https://hot-potato.reddit.com/embed*
// @version     0.3
// @grant       GM.xmlHttpRequest
// @author      Ponywka, bb010g
// @connect     raw.githubusercontent.com
// @connect     media.githubusercontent.com
// @require     https://unpkg.com/uhtml@2.8.1
// ==/UserScript==

// To format: `npx prettier --print-width 100 -w minimap.impl.user.js`

const mlp_GM = "GM" in this ? this.GM : arguments[0].GM;
const mlp_uhtml = "uhtml" in this ? this.uhtml : arguments[0].uhtml;

const { html, render } = mlp_uhtml;

(async function () {
  //document.querySelector("faceplate-toast")
  //document.createElement('mona-lisa-app').isFullScreen.globalState.state = true;

  const embed = await new Promise((resolve) => {
    let interval = setInterval(() => {
      try {
        const embed = document.querySelector("mona-lisa-embed");
        console.log("Found embed. Good!");
        resolve(embed);
        clearInterval(interval);
      } catch (e) {
        console.error("Found embed. Trying again...");
      }
    }, 1000);
  });

  const rPlaceCanvas = await new Promise((resolve) => {
    let interval = setInterval(() => {
      try {
        const rPlaceCanvas = embed.shadowRoot
          .querySelector("mona-lisa-share-container mona-lisa-canvas")
          .shadowRoot.querySelector("canvas");
        console.log("Found canvas. Good!");
        resolve(rPlaceCanvas);
        clearInterval(interval);
      } catch (e) {
        console.error("Failed to attach to canvas. Trying again...");
      }
    }, 1000);
  });

  const rPlaceWidth = 2000;
  const rPlaceHeight = 1000;
  const rPlacePixelSize = 10;

  const rPlaceTemplatesGithubLfs = true;
  const getRPlaceTemplateCanvasUrl = function (templateName) {
    if (rPlaceTemplatesGithubLfs) {
      return `https://media.githubusercontent.com/media/r-ainbowroad/minimap/d/main/${templateName}/canvas2k.png`;
    }
    return `https://raw.githubusercontent.com/r-ainbowroad/minimap/d/main/${templateName}/canvas2k.png`;
  };
  const getRPlaceTemplateBotUrl = function (templateName) {
    if (rPlaceTemplatesGithubLfs) {
      return `https://media.githubusercontent.com/media/r-ainbowroad/minimap/d/main/${templateName}/bot2k.png`;
    }
    return `https://raw.githubusercontent.com/r-ainbowroad/minimap/d/main/${templateName}/canvas2k.png`;
  };
  const rPlaceTemplateNames = [];
  const rPlaceTemplates = new Map();
  const addRPlaceTemplate = function (templateName, options) {
    let bot = options.bot === undefined ? false : options.bot;
    rPlaceTemplates.set(templateName, {
      canvasUrl: getRPlaceTemplateCanvasUrl(templateName),
      botUrl: bot ? getRPlaceTemplateBotUrl(templateName) : undefined,
    });
    rPlaceTemplateNames.push(templateName);
  };
  addRPlaceTemplate("mlp", { bot: true });
  addRPlaceTemplate("r-ainbowroad", { bot: true });
  addRPlaceTemplate("spain", { bot: true });
  let rPlaceTemplateName;
  let rPlaceTemplate;
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
    constructor(elResizer, elBlock) {
      var startX, startY, startWidth, startHeight;

      function doDrag(e) {
        elBlock.style.width = startWidth - e.clientX + startX + "px";
        elBlock.style.height = startHeight + e.clientY - startY + "px";
      }

      function stopDrag(e) {
        document.documentElement.removeEventListener("mousemove", doDrag, false);
        document.documentElement.removeEventListener("mouseup", stopDrag, false);
      }

      function initDrag(e) {
        startX = e.clientX;
        startY = e.clientY;
        startWidth = parseInt(document.defaultView.getComputedStyle(elBlock).width, 10);
        startHeight = parseInt(document.defaultView.getComputedStyle(elBlock).height, 10);
        document.documentElement.addEventListener("mousemove", doDrag, false);
        document.documentElement.addEventListener("mouseup", stopDrag, false);
      }

      elResizer.addEventListener("mousedown", initDrag, false);
    }
  }

  class Emitter {
    constructor() {
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
        const coordinateBlock = embed.shadowRoot
          .querySelector("mona-lisa-coordinates")
          .shadowRoot.querySelector("div");
        console.log("Found coordinate block. Good!");
        resolve(coordinateBlock);
        clearInterval(interval);
      } catch (e) {
        console.error("Failed to attach to coordinate block. Trying again...");
      }
    }, 1000);
  });

  const posParser = new PosParser(coordinateBlock);

  const docBody = document.querySelector("body");
  const htmlBlock = `<style>
  mlpminimap {
    display: block;
    color: white;
    width: 400px;
    height: 300px;
    position: absolute;
    top: 0%;
    right: 0%;
    background-color: rgba(0,0,0,.75);
    border: 1px solid black;
    overflow: hidden;
  }

  mlpminimap .map {
    position: absolute;
    margin: 0;
    max-width: unset;
    display: block;
    image-rendering: pixelated;
    pointer-events: none;
  }

  mlpminimap .crosshair {
    position: absolute;
    top: 50%;
    left: 50%;
    border: 2px solid red;
    transform: translateX(-50%) translateY(-50%);
  }

  mlpminimap #resizer {
    position: absolute;
    bottom: 0%;
    left: 0%;
    width: 0px;
    height: 0px;
    border-bottom: 10px solid red;
    border-left: 10px solid red;
    border-top: 10px solid transparent;
    border-right: 10px solid transparent;
  }

  mlpminimap .settings {
    position: absolute;
    background-color: rgba(0,0,0,.75);
  }
  
  mlpminimap .settings > div{
    display: none;
  }
  
  mlpminimap .settings > .alwaysshow{
    display: block;
  }
  
  mlpminimap:hover .settings > div{
    display: block;
  }

  mlpminimap .settings .clickable {
    cursor: pointer;
    user-select: none;
  }
</style>
<mlpminimap>
  <img class="map">
  <div class="crosshair"></div>
  <div class="settings"></div>
  <div id="resizer"></div>
</mlpminimap>`;

  class CheckboxSetting {
    constructor(name, enabled = false, callback = function (setting) {}) {
      this.name = name;
      this.enabled = enabled;
      this.callback = callback;
    }
    // onchange(e) {
    //   this.enabled = e.target.checked;
    //   this.callback();
    // }
    onclick() {
      this.enabled = !this.enabled;
      this.callback(this);
    }
    htmlFor(ref, id) {
      // NOTE(Dusk): It looks like Reddit hijacks all native checkboxes.
      // const onchange = () => this.onchange();
      // return html.for(ref, id)`<label data-id=${id}>
      //   ${this.name}: <input type="checkbox" .checked=${this.enabled} onchange=${onchange} />
      // </label>`;
      const onclick = () => this.onclick();
      const classes = ["clickable"];
      this.enabled ? classes.push("alwaysshow") : null;
      return html.for(ref, id)`<div data-id=${id} class=${classes.join(" ")} onclick=${onclick}>
        ${this.name}: <span>${this.enabled ? "Enabled" : "Disabled"}</span>
      </div>`;
    }
  }

  class CycleSetting {
    constructor(
      name,
      values = ["Unset"],
      valueIx = 0,
      callback = function (setting) {},
      alwaysShow = false
    ) {
      this.name = name;
      this.values = values;
      this.valueIx = valueIx;
      this.callback = callback;
      this.alwaysShow = alwaysShow;
    }
    get value() {
      return this.values[this.valueIx];
    }
    onclick() {
      this.valueIx = (this.valueIx + 1) % this.values.length;
      this.callback(this);
    }
    htmlFor(ref, id) {
      const onclick = () => this.onclick();
      const classes = ["clickable"];
      this.alwaysShow ? classes.push("alwaysshow") : null;
      return html.for(ref, id)`<div data-id=${id} class=${classes.join(" ")} onclick=${onclick}>
        ${this.name}: <span>${this.value}</span>
      </div>`;
    }
  }

  class ButtonSetting {
    constructor(name, callback = function (setting) {}, alwaysShow = false) {
      this.name = name;
      this.callback = callback;
      this.alwaysShow = alwaysShow;
    }
    onclick() {
      this.callback(this);
    }
    htmlFor(ref, id) {
      const onclick = () => this.onclick();
      const classes = ["clickable"];
      this.alwaysShow ? classes.push("alwaysshow") : null;
      return html.for(ref, id)`<div data-id=${id} class=${classes.join(" ")} onclick=${onclick}>
        ${this.name}
      </div>`;
    }
  }

  class DisplaySetting {
    constructor(name, content, alwaysShow = false) {
      this.name = name;
      this.content = content;
      this.alwaysShow = alwaysShow;
    }
    htmlFor(ref, id) {
      const classes = [];
      this.alwaysShow ? classes.push("alwaysshow") : null;
      return html.for(ref, id)`<div data-id=${id} class=${classes.join(" ")}>${this.name}: ${
        this.content
      }</div>`;
    }
  }

  class Settings {
    settings = [];
    settingNames = new Map();
    settingsByName = new Map();

    constructor(settingsBlock, mlpMinimapBlock) {
      const _root = this;

      requestAnimationFrame(function measure(time) {
        render(settingsBlock, _root.htmlFor(mlpMinimapBlock, "settings"));
        requestAnimationFrame(measure);
      });
    }

    htmlFor(ref, id) {
      return html.for(ref, id)`${this.settings.map((setting) =>
        setting.htmlFor(this, this.settingNames.get(setting))
      )}`;
    }

    addSetting(name, setting) {
      this.settings.push(setting);
      this.settingNames.set(setting, name);
      this.settingsByName.set(name, setting);
    }

    getSetting(name) {
      return this.settingsByName.get(name);
    }
  }

  const htmlObject = document.createElement("div");
  htmlObject.innerHTML = htmlBlock;
  docBody.appendChild(htmlObject);
  const mlpMinimapBlock = htmlObject.querySelector("mlpminimap");

  const imageBlock = mlpMinimapBlock.querySelector(".map");
  const crosshairBlock = mlpMinimapBlock.querySelector(".crosshair");

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  imageBlock.onload = function () {
    canvas.width = this.naturalWidth;
    canvas.height = this.naturalHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(this, 0, 0);
  };

  let updateTemplate = function () {};

  const settingsBlock = mlpMinimapBlock.querySelector(".settings");
  const settings = new Settings(settingsBlock, mlpMinimapBlock);
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
    "pixelDisplayProgress",
    new DisplaySetting("Current progress", "Unknown", true)
  );
  settings.addSetting(
    "donate",
    new ButtonSetting("Donate me plz", function (donateSetting) {
      window.open("https://www.donationalerts.com/r/vovskic2002");
    })
  );

  let botWorkingRightNow = false;
  updateTemplate = function () {
    const previousBotWorkingRightNow = botWorkingRightNow;
    botWorkingRightNow = true;
    restoredBotWorkingRightNow = false;
    const restoreBotWorkingRightNow = function () {
      if (!restoredBotWorkingRightNow && previousBotWorkingRightNow !== true) {
        restoredBotWorkingRightNow = true;
        botWorkingRightNow = previousBotWorkingRightNow;
      }
    };
    const rPlaceTemplateUrl =
      rPlaceTemplate.botUrl !== undefined && settings.getSetting("bot").enabled
        ? rPlaceTemplate.botUrl
        : rPlaceTemplate.canvasUrl;
    setTimeout(restoreBotWorkingRightNow, 10 * 1000);
    mlp_GM.xmlHttpRequest({
      method: "GET",
      responseType: "arraybuffer",
      url: `${rPlaceTemplateUrl}?t=${new Date().getTime()}`,
      onload: function (res) {
        imageBlock.src =
          "data:image/png;base64," +
          btoa(String.fromCharCode.apply(null, new Uint8Array(res.response)));
        restoreBotWorkingRightNow();
      },
    });
  };
  setInterval(updateTemplate, 1 * 60 * 1000);
  updateTemplate();

  const resizerBlock = mlpMinimapBlock.querySelector("#resizer");
  const resizerAction = new Resizer(resizerBlock, mlpMinimapBlock);

  function getMinimapSize() {
    return {
      width: mlpMinimapBlock.clientWidth,
      height: mlpMinimapBlock.clientHeight,
    };
  }

  const paletteButtons = embed.shadowRoot
    .querySelector("mona-lisa-color-picker")
    .shadowRoot.querySelectorAll(".palette button.color");
  const palette = [];
  for (const paletteButton of paletteButtons) {
    const parsedData = paletteButton.children[0].style.backgroundColor.match(
      /rgb\(([0-9]{1,3}), ([0-9]{1,3}), ([0-9]{1,3})\)/
    );
    const colorID = parseInt(paletteButton.getAttribute("data-color"));
    if (parsedData) {
      palette.push([parsedData[1], parsedData[2], parsedData[3], colorID]);
    } else {
      palette.push([0, 0, 0, -1]);
    }
  }

  function autoColorPick(imageData) {
    if (imageData.data[3] !== 255) return;

    const r = imageData.data[0];
    const g = imageData.data[1];
    const b = imageData.data[2];
    let diff = [];
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
    const coordinatesData = posParser.pos;
    const minimapData = getMinimapSize();
    imageBlock.style.width = `${rPlaceWidth * rPlacePixelSize * coordinatesData.scale}px`;
    imageBlock.style.height = `${rPlaceHeight * rPlacePixelSize * coordinatesData.scale}px`;
    imageBlock.style["margin-left"] = `${
      -1 *
      ((coordinatesData.x * rPlacePixelSize + rPlacePixelSize / 2) * coordinatesData.scale -
        minimapData.width / 2)
    }px`;
    imageBlock.style["margin-top"] = `${
      -1 *
      ((coordinatesData.y * rPlacePixelSize + rPlacePixelSize / 2) * coordinatesData.scale -
        minimapData.height / 2)
    }px`;
    crosshairBlock.style.width = `${rPlacePixelSize * coordinatesData.scale}px`;
    crosshairBlock.style.height = `${rPlacePixelSize * coordinatesData.scale}px`;
    if (settings.getSetting("autoColor").enabled) {
      try {
        const imageData = ctx.getImageData(coordinatesData.x, coordinatesData.y, 1, 1);
        autoColorPick(imageData);
      } catch (e) {
        console.error(e);
      }
    }
  });

  const botCanvas = document.createElement("canvas");
  botCanvas.width = rPlaceCanvas.width;
  botCanvas.height = rPlaceCanvas.height;
  const botCtx = botCanvas.getContext("2d");

  function getDiff(botCanvasWidth, botCanvasHeight, botCtx, ctx) {
    const currentData = botCtx.getImageData(0, 0, botCanvasWidth, botCanvasHeight).data;
    const templateData = ctx.getImageData(0, 0, botCanvasWidth, botCanvasHeight).data;

    const diff = [];
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
    return new Promise((resolve) =>
      setTimeout(() => {
        resolve();
      }, ms)
    );
  }

  const botTimeout = 1000;
  const botAfterPlaceTimeout = 3000;
  (async () => {
    while (true) {
      // Update the minimap image (necessary for checking the diff)
      botCtx.clearRect(0, 0, botCanvas.width, botCanvas.height);
      botCtx.drawImage(canvas, 0, 0);
      botCtx.globalCompositeOperation = "source-in";
      botCtx.drawImage(rPlaceCanvas, 0, 0);
      botCtx.globalCompositeOperation = "source-over";

      // Compute the diff
      const diffAndCisPixels = getDiff(botCanvas.width, botCanvas.height, botCtx, ctx);
      const diff = diffAndCisPixels[0];
      const nCisPixels = diffAndCisPixels[1];

      // Update the display with current stats
      const nMissingPixels = nCisPixels - diff.length;
      const percentage = ((100 * nMissingPixels) / nCisPixels).toPrecision(3);
      settings.getSetting("pixelDisplayProgress").content = html`<span style="font-weight: bold;"
        >${percentage}% (${nMissingPixels}/${nCisPixels})</span
      >`;

      if (settings.getSetting("bot").enabled && !botWorkingRightNow) {
        if (rPlaceTemplate.botUrl === undefined) {
          return;
        }
        botWorkingRightNow = true;

        embed.wakeUp();

        if (!embed.nextTileAvailableIn && diff.length > 0) {
          const randID = Math.floor(Math.random() * diff.length);
          const randPixel = diff[randID];
          const imageDataRight = ctx.getImageData(randPixel[0], randPixel[1], 1, 1);
          autoColorPick(imageDataRight);
          embed.camera.applyPosition({
            x: randPixel[0],
            y: randPixel[1],
          });
          embed.showColorPicker = true;
          embed.onConfirmPixel();
          console.log(
            `[${Date()}] Placed [x: ${randPixel[0]}, y: ${randPixel[1]}, color: ${
              embed.selectedColor
            }]`
          );
          await waitMs(botAfterPlaceTimeout);
        }

        botWorkingRightNow = false;
      }

      await waitMs(botTimeout);
    }
  })().then((r) => {});
})();

// vim:et:sw=2
