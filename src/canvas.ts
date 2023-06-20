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

export class RedditCanvas {
  constructor(public canvas: HTMLCanvasElement, public embed: MonaLisa.Embed) {
    this.canvas = canvas;
    this.embed = embed;
  }
};

export async function getRedditCanvas() {
  const embed: MonaLisa.Embed = await new Promise((resolve) => {
    let interval = setInterval(() => {
      try {
        const embed = document.querySelector("mona-lisa-embed") as MonaLisa.Embed;
        console.log("Found embed. Good!");
        resolve(embed);
        clearInterval(interval);
      } catch (e) {
        console.error("Could not find `mona-lisa-embed`. Trying again...");
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

  return new RedditCanvas(rPlaceCanvas, embed);
}