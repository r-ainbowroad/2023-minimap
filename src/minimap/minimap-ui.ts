/**
 *
 * Part of the MLP r/place Project, under the Apache License v2.0 or ISC.
 * SPDX-License-Identifier: Apache-2.0 OR ISC
 * SPDX-FileCopyrightText: Copyright CONTRIBUTORS.md
 *
 **
 *
 * @file Inject the minimap UI.
 *
 **/

import {Template} from "../template/template";

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

mlpminimap #noSleep {
display: none;
}
</style>
<mlpminimap>
  <canvas class="map"></canvas>
  <div class="crosshair"></div>
  <div class="settings"></div>
  <div id="resizer"></div>
  <audio id="noSleep" src="https://hot-potato.reddit.com/media/interactions/select-color.mp3" playsinline></audio>
</mlpminimap>`;

class MinimapUI {
  mlpMinimapBlock: HTMLElement;
  imageCanvas: HTMLCanvasElement;
  imageCanvasCtx: CanvasRenderingContext2D;
  crosshairBlock: HTMLDivElement;
  settingsBlock: HTMLDivElement;

  constructor(mlpMinimapBlock: HTMLElement, 
              imageCanvas: HTMLCanvasElement, imageCanvasCtx: CanvasRenderingContext2D,
              crosshairBlock: HTMLDivElement, settingsBlock: HTMLDivElement) {
    this.mlpMinimapBlock = mlpMinimapBlock;
    this.imageCanvas = imageCanvas;
    this.imageCanvasCtx = imageCanvasCtx;
    this.crosshairBlock = crosshairBlock;
    this.settingsBlock = settingsBlock;
  }

  setTemplate(template: Template) {
    this.imageCanvas.width = template.template.getWidth();
    this.imageCanvas.height = template.template.getHeight();
    template.template.drawTo(this.imageCanvasCtx);
  }
}

export function createMinimapUI(document: Document): MinimapUI {
  const htmlObject = document.createElement("div");
  htmlObject.innerHTML = htmlBlock;
  document.querySelector("body")?.appendChild(htmlObject);

  const mlpMinimapBlock = htmlObject.querySelector("mlpminimap")! as HTMLElement;
  const imageCanvas = mlpMinimapBlock.querySelector(".map")! as HTMLCanvasElement;
  const imageCanvasCtx = imageCanvas.getContext("2d")!;
  const crosshairBlock = mlpMinimapBlock.querySelector(".crosshair")! as HTMLDivElement;
  const settingsBlock = mlpMinimapBlock.querySelector(".settings")! as HTMLDivElement;

  return new MinimapUI(mlpMinimapBlock, imageCanvas, imageCanvasCtx, crosshairBlock,
                       settingsBlock);
}
