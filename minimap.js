if (!arguments[0]) {
  const docBody = document.querySelector("body");
  const htmlBlock = `<style>
    mlpminimap {
      display: block;
      position: absolute;
      top: 0%;
      right: 0%;
      background-color: rgba(0,0,0,.75);
      border: 1px solid black;
      overflow: hidden;
    }
  </style>
  <mlpminimap>
    <h1>Please update minimap!</h1>
    <p>You can do it just clicking <a href="https://raw.githubusercontent.com/r-ainbowroad/minimap/d/main/minimap.user.js" target="_blank">here</p>
  </mlpminimap>`;
  const htmlObject = document.createElement("div");
  htmlObject.innerHTML = htmlBlock;
  docBody.appendChild(htmlObject);
  return;
}

const GM = arguments[0].GM;

(async function () {
  //document.querySelector("faceplate-toast")
  //document.createElement('mona-lisa-app').isFullScreen.globalState.state = true;

  const rPlaceCanvas = document
    .querySelector("mona-lisa-embed")
    .shadowRoot.querySelector("mona-lisa-share-container mona-lisa-canvas")
    .shadowRoot.querySelector("canvas");

  const rPlaceWidth = 2000;
  const rPlaceHeight = 1000;
  const rPlacePixelSize = 10;

  const rPlaceTemplateNormal =
    "https://raw.githubusercontent.com/r-ainbowroad/minimap/d/main/canvas2k.png";
  const rPlaceTemplateBot =
    "https://raw.githubusercontent.com/r-ainbowroad/minimap/d/main/bot2k.png";
  let rPlaceTemplate = rPlaceTemplateNormal;

  class Resizer {
    constructor(elResizer, elBlock) {
      var startX, startY, startWidth, startHeight;

      function doDrag(e) {
        elBlock.style.width = startWidth - e.clientX + startX + "px";
        elBlock.style.height = startHeight + e.clientY - startY + "px";
      }

      function stopDrag(e) {
        document.documentElement.removeEventListener(
          "mousemove",
          doDrag,
          false
        );
        document.documentElement.removeEventListener(
          "mouseup",
          stopDrag,
          false
        );
      }

      function initDrag(e) {
        startX = e.clientX;
        startY = e.clientY;
        startWidth = parseInt(
          document.defaultView.getComputedStyle(elBlock).width,
          10
        );
        startHeight = parseInt(
          document.defaultView.getComputedStyle(elBlock).height,
          10
        );
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

  class PosParser extends Emitter {
    parseCoordinateBlock() {
      const parsedData = this.coordinateBlock.innerText.match(
        /\(([0-9]+),([0-9]+)\) ([0-9.]+)x/
      );
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
        if (JSON.stringify(_root.pos) !== JSON.stringify(coordinatesData)) {
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
        const coordinateBlock = document
          .querySelector("mona-lisa-embed")
          .shadowRoot.querySelector("mona-lisa-coordinates")
          .shadowRoot.querySelector("div");
        console.log("Good!");
        resolve(coordinateBlock);
        clearInterval(interval);
      } catch (e) {
        console.error("Attaching failed... trying again...");
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
  
  mlpminimap .settings .clickable {
    cursor: pointer;
    user-select: none;
  }
</style>
<mlpminimap>
  <img class="map">
  <div class="crosshair"></div>
  <div class="settings">
  </div>
  <div id="resizer"></div>
</mlpminimap>`;

  class Settings {
    createSwitch(name, argname, def = false, callback = () => {}) {
      const _root = this;
      const elBlock = document.createElement("div");
      elBlock.classList.add("clickable");
      elBlock.innerText = `${name}: `;
      const elSwitch = document.createElement("span");
      elBlock.appendChild(elSwitch);
      this.rootEl.appendChild(elBlock);
      this.settingElements[argname] = {
        root: elBlock,
        status: elSwitch,
        enabled: def,
      };
      elBlock.addEventListener("click", () => {
        _root.settingElements[argname].enabled =
          !_root.settingElements[argname].enabled;
        callback();
      });
    }

    createButton(name, callback = () => {}) {
      const _root = this;
      const elBlock = document.createElement("div");
      elBlock.classList.add("clickable");
      elBlock.innerText = name;
      this.rootEl.appendChild(elBlock);
      elBlock.addEventListener("click", () => {
        callback();
      });
    }

    constructor(rootEl) {
      const _root = this;
      this.rootEl = rootEl;
      this.settingElements = {};

      requestAnimationFrame(function measure(time) {
        Object.keys(_root.settingElements).forEach((arg) => {
          _root.settingElements[arg].status.innerText = _root.settingElements[
            arg
          ].enabled
            ? "Enabled"
            : "Disabled";
        });
        requestAnimationFrame(measure);
      });
    }

    getParam(argname) {
      if (!this.settingElements[argname]) return;
      return this.settingElements[argname].enabled;
    }

    setParam(argname, stat) {
      if (!this.settingElements[argname]) return;
      this.settingElements[argname].enabled = stat;
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

  function updateTemplate() {
    GM.xmlHttpRequest({
      method: "GET",
      responseType: "arraybuffer",
      url: `${rPlaceTemplate}?t=${new Date().getTime()}`,
      onload: function (res) {
        imageBlock.src =
          "data:image/png;base64," +
          btoa(String.fromCharCode.apply(null, new Uint8Array(res.response)));
      },
    });
  }
  setInterval(updateTemplate, 1 * 60 * 1000);
  updateTemplate();

  const settingsBlock = mlpMinimapBlock.querySelector(".settings");
  const settings = new Settings(settingsBlock);
  settings.createSwitch("Auto color picker", "autocolor", false, () => {
    settings.setParam("bot", false);
  });
  settings.createSwitch("Bot", "bot", false, () => {
    settings.setParam("autocolor", false);
    if (settings.getParam("bot")) {
      rPlaceTemplate = rPlaceTemplateBot;
    } else {
      rPlaceTemplate = rPlaceTemplateNormal;
    }
    updateTemplate();
  });
  settings.createButton("Donate me plz", ()=>{
    window.open('https://www.donationalerts.com/r/vovskic2002');
  });

  const resizerBlock = mlpMinimapBlock.querySelector("#resizer");
  const resizerAction = new Resizer(resizerBlock, mlpMinimapBlock);

  function getMinimapSize() {
    return {
      width: mlpMinimapBlock.clientWidth,
      height: mlpMinimapBlock.clientHeight,
    };
  }

  const paletteButtons = document
    .querySelector("mona-lisa-embed")
    .shadowRoot.querySelector("mona-lisa-color-picker")
    .shadowRoot.querySelectorAll(".palette button.color");
  const palette = [];
  for (const paletteButton of paletteButtons) {
    const parsedData = paletteButton.children[0].style.backgroundColor.match(
      /rgb\(([0-9]{1,3}), ([0-9]{1,3}), ([0-9]{1,3})\)/
    );
    if (parsedData) {
      palette.push([parsedData[1], parsedData[2], parsedData[3]]);
    } else {
      palette.push([0, 0, 0]);
    }
  }

  function autoColorPick(imageData) {
    if (imageData.data[3] !== 255) return;

    const r = imageData.data[0];
    const g = imageData.data[1];
    const b = imageData.data[2];
    let diff = [];
    for (const color of palette) {
      diff.push(
        Math.abs(r - color[0]) + Math.abs(g - color[1]) + Math.abs(b - color[2])
      );
    }
    let correctColorID = 0;
    for (let i = 0; i < diff.length; i++) {
      if (diff[correctColorID] > diff[i]) correctColorID = i;
    }
    //console.log(correctColorID);
    paletteButtons[correctColorID].click();
  }

  function intToHex(int1) {
    return ("0" + int1.toString(16)).slice(-2);
  }
  posParser.addEventListener("posChanged", () => {
    const coordinatesData = posParser.pos;
    const minimapData = getMinimapSize();
    imageBlock.style.width = `${
      rPlaceWidth * rPlacePixelSize * coordinatesData.scale
    }px`;
    imageBlock.style.height = `${
      rPlaceHeight * rPlacePixelSize * coordinatesData.scale
    }px`;
    imageBlock.style["margin-left"] = `${
      -1 *
      ((coordinatesData.x * rPlacePixelSize + rPlacePixelSize / 2) *
        coordinatesData.scale -
        minimapData.width / 2)
    }px`;
    imageBlock.style["margin-top"] = `${
      -1 *
      ((coordinatesData.y * rPlacePixelSize + rPlacePixelSize / 2) *
        coordinatesData.scale -
        minimapData.height / 2)
    }px`;
    crosshairBlock.style.width = `${rPlacePixelSize * coordinatesData.scale}px`;
    crosshairBlock.style.height = `${
      rPlacePixelSize * coordinatesData.scale
    }px`;
    if (settings.getParam("autocolor")) {
      try {
        const imageData = ctx.getImageData(
          coordinatesData.x,
          coordinatesData.y,
          1,
          1
        );
        autoColorPick(imageData);
      } catch (e) {
        console.error(e);
      }
    }
  });

  let botWorkingRightNow = false;

  const botCanvas = document.createElement("canvas");
  botCanvas.width = rPlaceCanvas.width;
  botCanvas.height = rPlaceCanvas.height;
  const botCtx = botCanvas.getContext("2d");

  setInterval(async () => {
    if (settings.getParam("bot") && !botWorkingRightNow) {
      botWorkingRightNow = true;

      /*if(document.querySelector("faceplate-toast")){
			await new Promise(resolve => setTimeout(resolve,10000));
		}*/

      const placeButton = document
        .querySelector("mona-lisa-embed")
        .shadowRoot.querySelector("mona-lisa-color-picker")
        .shadowRoot.querySelector("button.confirm");
      if (placeButton) {
        botCtx.clearRect(0, 0, botCanvas.width, botCanvas.height);
        botCtx.drawImage(canvas, 0, 0);
        botCtx.globalCompositeOperation = "source-in";
        botCtx.drawImage(rPlaceCanvas, 0, 0);
        botCtx.globalCompositeOperation = "source-over";

        const currentData = botCtx.getImageData(
          0,
          0,
          botCanvas.width,
          botCanvas.height
        ).data;
        const templateData = ctx.getImageData(
          0,
          0,
          botCanvas.width,
          botCanvas.height
        ).data;

        const diff = [];

        for (let i = 0; i < templateData.length / 4; i++) {
          if (currentData[i * 4 + 3] === 0) continue;
          if (
            templateData[i * 4 + 0] !== currentData[i * 4 + 0] ||
            templateData[i * 4 + 1] !== currentData[i * 4 + 1] ||
            templateData[i * 4 + 2] !== currentData[i * 4 + 2]
          ) {
            const x = i % botCanvas.width;
            const y = (i - x) / botCanvas.width;
            diff.push([x, y]);
          }
        }

        if (diff.length > 0) {
          const randID = Math.floor(Math.random() * diff.length);
          const randPixel = diff[randID];
          document
            .querySelector("mona-lisa-embed")
            .selectPixel({ x: randPixel[0], y: randPixel[1] });
          await new Promise((resolve) => setTimeout(resolve, 1500));
          const imageDataRight = ctx.getImageData(
            randPixel[0],
            randPixel[1],
            1,
            1
          );
          autoColorPick(imageDataRight);
          botCtx.clearRect(0, 0, botCanvas.width, botCanvas.height);
          botCtx.drawImage(rPlaceCanvas, 0, 0);
          const imageDataNew = botCtx.getImageData(
            randPixel[0],
            randPixel[1],
            1,
            1
          );

          if (
            imageDataRight.data[0] !== imageDataNew.data[0] ||
            imageDataRight.data[1] !== imageDataNew.data[1] ||
            imageDataRight.data[2] !== imageDataNew.data[2]
          ) {
            placeButton.click();
          } else {
            console.log("Correct!");
          }
        }
      }
      botWorkingRightNow = false;
    }
  }, 1000);
})();
