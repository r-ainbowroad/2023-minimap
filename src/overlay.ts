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

import {TemplateController, TemplateData} from "./template/template";

export class Overlay {
  canvas: HTMLCanvasElement;
  templateController: TemplateController;
  template: TemplateData;
  overlayCanvas: HTMLCanvasElement;
  overlayContext: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement, templateController: TemplateController, template: TemplateData) {
    this.canvas = canvas;
    this.templateController = templateController;
    this.template = template;
    this.overlayCanvas = document.createElement('canvas');
    this.overlayContext = this.overlayCanvas.getContext('2d')!;
    this.inject();
    this.updateOverlayStyle();
  }

  static async create(canvas: HTMLCanvasElement, templateController: TemplateController) {
    return new Overlay(canvas, templateController, templateController.currentTemplate!);
  }

  collectTransformParents() {
    let nodesToFollow: HTMLElement[] = [];
    let current: Node | null = this.overlayCanvas;
    while (current) {
      if (current instanceof HTMLElement) {
        if (current.style.transform.includes("scale"))
          nodesToFollow.push(current);
        if (current.assignedSlot)
          current = current.assignedSlot;
        else if (current.parentNode)
          current = current.parentNode
      } else if (current instanceof ShadowRoot) {
        if (current.host)
          current = current.host;
      } else {
        current = null;
      }
    }
    return nodesToFollow;
  }

  inject() {
    this.canvas.parentElement!.appendChild(this.overlayCanvas);
    const canvasObserver = new MutationObserver(() => {
      this.updateOverlayStyle();
    });
    canvasObserver.observe(this.canvas, {attributes: true});
    const nodes = this.collectTransformParents();
    for (const node of nodes) {
      const canvasZoomObserver = new MutationObserver(() => {
        this.updateRenderingMode();
      });
      canvasZoomObserver.observe(node, {attributes: true, attributeFilter: ["style"]});
    }

    this.templateController.addEventListener("update", (template: TemplateData) => {
      console.log("overlay template update");
      this.applyTemplate(template);
      this.updateOverlayStyle();
    });
  }

  updateRenderingMode() {
    // TODO: Use visual viewport to be more correct here.
    const rect = this.overlayCanvas.getBoundingClientRect();
    if (rect.height < this.template.height * 8)
      this.overlayCanvas.style.imageRendering = 'auto';
    else
      this.overlayCanvas.style.imageRendering = 'pixelated';
  }

  updateOverlayStyle() {
    if (!this.template)
      return;
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
    this.updateRenderingMode();

    if (shouldApplyTemplate) {
      this.overlayContext = this.overlayCanvas.getContext('2d')!;
      this.applyTemplate();
    }
  }

  applyTemplate(template: TemplateData | undefined = undefined) {
    if (template instanceof TemplateData){
      this.template = template;
    }

    this.overlayCanvas.width = this.template.width * 3;
    this.overlayCanvas.height = this.template.height * 3;
    this.overlayContext.putImageData(this.template.getDithered3x(), 0, 0);
  }

  hide(){
    this.overlayCanvas.style.display = 'none';
  }

  show(){
    this.overlayCanvas.style.display = 'unset';
  }
}

export async function fallbackOverlay(canvas: HTMLCanvasElement, templateController: TemplateController) {
  const overlay = await Overlay.create(canvas, templateController);
}
