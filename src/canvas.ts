/**
 *
 * Part of the MLP r/place Project, under the Apache License v2.0 or ISC.
 * SPDX-License-Identifier: Apache-2.0 OR ISC
 * SPDX-FileCopyrightText: Copyright CONTRIBUTORS.md
 *
 **
 *
 * @file General purpose canvas handling, abstracts out site specific details.
 *
 **/

import {constants} from "./constants";
import {Emitter, waitMs} from "./utils";

export function waitForDocumentLoad() {
  return new Promise<void>((resolve) => {
    if (document.readyState == 'complete')
      resolve();
    const readystatechangeHandler = function() {
      if (document.readyState == 'complete') {
        document.removeEventListener('readystatechange', readystatechangeHandler);
        resolve();
      }
    };
    document.addEventListener('readystatechange', readystatechangeHandler);
  });
}

function findCanvasCandidates(root: Element | ShadowRoot, out: HTMLCanvasElement[]) {
  if (root instanceof HTMLCanvasElement)
    out.push(root);
  if (root instanceof HTMLElement && root.shadowRoot)
    findCanvasCandidates(root.shadowRoot, out);
  for (const child of root.children)
    findCanvasCandidates(child, out);
}

function rankCanvasCandidates(inout: HTMLCanvasElement[]) {
  inout.sort((a, b) => {
    // Compare size.
    const size = (a.width * a.height) - (b.width * b.height);
    if (size !== 0)
      return -size;
    
    // Compare opacity.
    const opacity = Number(window.getComputedStyle(a).opacity) -
                    Number(window.getComputedStyle(b).opacity);
    if (Number.isNaN(opacity))
      return 0;
    return -opacity;
  });
}

export function getMostLikelyCanvas() {
  let canvases:  HTMLCanvasElement[] = [];
  findCanvasCandidates(document.documentElement, canvases);
  rankCanvasCandidates(canvases);
  if (canvases.length === 0)
    return null;
  return canvases[0];
}

class MinimapPosition extends Emitter {
  rPlace: RedditCanvas;
  pos: MonaLisa.Pos;

  getCoordinates(): MonaLisa.Pos {
    return {
      zoom: Math.ceil(this.rPlace.embed.camera.zoom),
      x: Math.ceil(this.rPlace.embed.camera.cx - 0.5),
      y: Math.ceil(this.rPlace.embed.camera.cy - 0.5),
    };
  }

  isEquals(pos0: MonaLisa.Pos, pos1: MonaLisa.Pos): boolean {
    if (pos0.x !== pos1.x) return false;
    if (pos0.y !== pos1.y) return false;
    if (pos0.zoom !== pos1.zoom) return false;
    return true;
  };

  constructor(rPlace) {
    super();
    var _root = this;
    this.rPlace = rPlace;
    this.pos = {
      x: 0,
      y: 0,
      zoom: 0,
    };

    requestAnimationFrame(function measure(this: any, time) {
      const coordinatesData = _root.getCoordinates();
      if (!_root.isEquals(_root.pos, coordinatesData)) {
        _root.pos = coordinatesData;
        _root.dispatchEvent(new Event("posChanged"));
      }
      requestAnimationFrame(measure);
    });
  }
}

export class RedditCanvas {
  position: MinimapPosition;
  paletteButtons: NodeListOf<HTMLElement>;
  palette: number[][] = [];
  camera: any;

  constructor(public canvas: HTMLCanvasElement, public embed: MonaLisa.Embed) {
    this.canvas = canvas;
    this.embed = embed;
    this.camera = this.embed.camera;

    this.position = new MinimapPosition(this);
    this.paletteButtons = this.embed
      .shadowRoot!.querySelector("garlic-bread-color-picker")!
      .shadowRoot!.querySelectorAll(".palette button.color")!;
    for (const paletteButton of this.paletteButtons) {
      const parsedData = (paletteButton.children[0] as HTMLElement).style.backgroundColor.match(
        /rgb\(([0-9]{1,3}), ([0-9]{1,3}), ([0-9]{1,3})\)/
      );
      const colorID = parseInt(paletteButton.getAttribute("data-color")!);
      if (parsedData) {
        this.palette.push([+parsedData[1], +parsedData[2], +parsedData[3], colorID]);
      } else {
        this.palette.push([0, 0, 0, -1]);
      }
    }
  }
};

export async function getRedditCanvas() {
  for (let tries = constants.MaxSiteSpecificDetectAttempts; tries != 0; --tries) {
    try {
      const embed = document.querySelector("garlic-bread-embed") as MonaLisa.Embed;
      if (!embed) {
        console.log("Failed to find `garlic-bread-embed`");
        continue;
      }
      const rPlaceCanvas: HTMLCanvasElement = embed!.shadowRoot!
        .querySelector("div > garlic-bread-share-container > garlic-bread-camera > garlic-bread-canvas")!
        .shadowRoot!.querySelector("canvas")!;
      if (!rPlaceCanvas) {
        console.log("Failed to find `garlic-bread-canvas`");
        continue;
      }
      return new RedditCanvas(rPlaceCanvas, embed);
    } catch(error) {
      console.log("Failed to get the reddit canvas: ", error);
    } finally {
      console.log(`Retries left: ${tries}`);
      await waitMs(constants.SiteSpecificDetectRetryDelayMs);
    }
  }
  return undefined;
}
