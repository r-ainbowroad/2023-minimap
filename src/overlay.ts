/**
 *
 * Part of the MLP r/place Project, under the Apache License v2.0 or ISC.
 * SPDX-License-Identifier: Apache-2.0 OR ISC
 * SPDX-FileCopyrightText: Copyright CONTRIBUTORS.md
 *
 **
 *
 * @file A backup overlay in case we don't support the site.
 *
 **/

import {ImageTemplate, updateLoop} from "./template/template";
import {AsyncWorkQueue, waitMs} from "./utils";

export class Overlay {
  canvas: HTMLCanvasElement;
  templateDict;
  template: ImageTemplate;
  overlayCanvas: HTMLCanvasElement;
  overlayContext: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement, templateDict, template: ImageTemplate) {
    this.canvas = canvas;
    this.templateDict = templateDict;
    this.template = template;
    this.overlayCanvas = document.createElement('canvas');
    this.overlayContext = this.overlayCanvas.getContext('2d')!;
    this.inject();
    this.updateOverlayStyle();
  }

  static async create(canvas: HTMLCanvasElement, templateDict) {
    const template = await ImageTemplate.fetchTemplate(templateDict.canvasUrl);
    return new Overlay(canvas, templateDict, template);
  }

  inject() {
    this.canvas.parentElement!.appendChild(this.overlayCanvas);
    const canvasObserver = new MutationObserver(() => {
      this.updateOverlayStyle();
    });
    canvasObserver.observe(this.canvas, {attributes: true});
  }

  updateOverlayStyle() {
    let style = getComputedStyle(this.canvas);
    let shouldApplyTemplate = false;
    const newWidth = this.template.width * 3;
    const newHeight = this.template.height * 3;
    if (this.overlayCanvas.width != newWidth) {
      shouldApplyTemplate = true;
      this.overlayCanvas.width = newWidth;
    }
    if (this.overlayCanvas.height != newWidth) {
      shouldApplyTemplate = true;
      this.overlayCanvas.height = newHeight;
    }
    this.overlayCanvas.style.position = 'absolute';
    const transformPos = (pos) => {
      if (pos == 'auto')
        return '0';
      return pos;
    };
    this.overlayCanvas.style.top = transformPos(style.top);
    this.overlayCanvas.style.left = transformPos(style.left);
    this.overlayCanvas.style.translate = style.translate;
    this.overlayCanvas.style.transform = style.transform;

    const widthFactor = parseFloat(style.width) / this.canvas.width;
    const heightFactor = parseFloat(style.height) / this.canvas.height;

    this.overlayCanvas.style.width = `${this.template.width * widthFactor}px`;
    this.overlayCanvas.style.height = `${this.template.height * heightFactor}px`;
    this.overlayCanvas.style.zIndex = `${parseInt(style.zIndex) + 1}`;
    this.overlayCanvas.style.pointerEvents = 'none';
    this.overlayCanvas.style.imageRendering = 'pixelated';

    if (shouldApplyTemplate) {
      this.overlayContext = this.overlayCanvas.getContext('2d')!;
      this.applyTemplate();
    }
  }

  applyTemplate(template: ImageTemplate | undefined = undefined) {
    if (template instanceof ImageTemplate){
      this.template = template;
    }
    const dithered = this.template.template.getDithered3x();
    this.overlayContext.putImageData(dithered, 0, 0);
  }
};

export async function fallbackOverlay(canvas: HTMLCanvasElement, templateDict) {
  const overlay = await Overlay.create(canvas, templateDict);
  
  const queue = new AsyncWorkQueue();
  // Start the update loop, runs in the background.
  updateLoop(queue, () => {return overlay.template;}, () => {overlay.applyTemplate();});
}
