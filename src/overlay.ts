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

import type {TemplateController, TemplateData} from "./template/template";
import type {TemplateImage} from "./template/templateImage";

type OverlayTemplate = TemplateData | TemplateImage;

interface OverlayTemplateSource {
  currentTemplate: OverlayTemplate | null;
  addEventListener(event: string, callback: (template: OverlayTemplate) => void): void;
}

export class Overlay {
  canvas: HTMLCanvasElement;
  templateController: OverlayTemplateSource | null;
  template: OverlayTemplate;
  overlayImage: HTMLImageElement;
  renderedTemplate: OverlayTemplate | null = null;
  renderedTemplateUrl: string | null = null;

  constructor(canvas: HTMLCanvasElement, templateOrController: OverlayTemplate | OverlayTemplateSource, template?: OverlayTemplate) {
    this.canvas = canvas;
    if (this.isOverlayTemplate(templateOrController)) {
      this.templateController = null;
      this.template = templateOrController;
    } else {
      this.templateController = templateOrController;
      this.template = template ?? templateOrController.currentTemplate!;
    }
    this.overlayImage = document.createElement('img');
    this.overlayImage.alt = "";
    this.inject();
    this.updateOverlayStyle();
  }

  static async create(canvas: HTMLCanvasElement, templateController: TemplateController) {
    return new Overlay(canvas, templateController, templateController.currentTemplate!);
  }

  collectTransformParents() {
    let nodesToFollow: HTMLElement[] = [];
    let current: Node | null = this.overlayImage;
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
    this.canvas.parentElement!.appendChild(this.overlayImage);
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

    this.templateController?.addEventListener("update", (template: OverlayTemplate) => {
      console.log("overlay template update");
      this.applyTemplate(template);
      this.updateOverlayStyle();
    });
  }

  updateRenderingMode() {
    // TODO: Use visual viewport to be more correct here.
    const rect = this.overlayImage.getBoundingClientRect();
    this.overlayImage.style.imageRendering = 'pixelated';
  }

  updateOverlayStyle() {
    if (!this.template)
      return;
    let style = getComputedStyle(this.canvas);
    this.overlayImage.style.position = 'absolute';
    const transformPos = (pos) => {
      if (pos == 'auto')
        return '0';
      return pos;
    };
    this.overlayImage.style.top = transformPos(style.top);
    this.overlayImage.style.left = transformPos(style.left);
    this.overlayImage.style.translate = style.translate;
    this.overlayImage.style.transform = style.transform;

    const layoutWidth = Number.parseFloat(style.width);
    const layoutHeight = Number.parseFloat(style.height);
    const widthFactor = (Number.isNaN(layoutWidth) ? this.canvas.clientWidth : layoutWidth) / this.canvas.width;
    const heightFactor = (Number.isNaN(layoutHeight) ? this.canvas.clientHeight : layoutHeight) / this.canvas.height;

    this.overlayImage.style.width = `${this.template.width * widthFactor}px`;
    this.overlayImage.style.height = `${this.template.height * heightFactor}px`;
    const zIndex = Number.parseInt(style.zIndex, 10);
    this.overlayImage.style.zIndex = Number.isNaN(zIndex) ? '1' : `${zIndex + 1}`;
    this.overlayImage.style.pointerEvents = 'none';
    this.overlayImage.style.objectFit = 'fill';
    this.updateMaskStyle(widthFactor, heightFactor);
    this.updateRenderingMode();

    this.applyTemplate();
  }

  applyTemplate(template: OverlayTemplate | undefined = undefined) {
    if (template) {
      this.template = template;
    }

    if (this.renderedTemplate === this.template && this.renderedTemplateUrl)
      return;

    const nextTemplateUrl = this.getTemplateUrl(this.template);
    if (this.renderedTemplateUrl == nextTemplateUrl)
      return;

    this.overlayImage.src = nextTemplateUrl;
    this.renderedTemplate = this.template;
    this.renderedTemplateUrl = nextTemplateUrl;
  }

  hide(){
    this.overlayImage.style.display = 'none';
  }

  show(){
    this.overlayImage.style.display = 'unset';
  }

  private isOverlayTemplate(value: OverlayTemplate | OverlayTemplateSource): value is OverlayTemplate {
    return "width" in value && "height" in value && (
      "src" in value || "drawTo" in value
    );
  }

  private getTemplateUrl(template: OverlayTemplate): string {
    if ("src" in template)
      return template.src;
    if ("drawTo" in template) {
      const canvas = document.createElement("canvas");
      canvas.width = template.width;
      canvas.height = template.height;
      const context = canvas.getContext("2d")!;
      template.drawTo(context);
      return canvas.toDataURL("image/png");
    }

    throw new Error("Unsupported overlay template type.");
  }

  private updateMaskStyle(widthFactor: number, heightFactor: number) {
    const maskImage = "radial-gradient(circle at center, white 45%, transparent 55%)";
    const maskWidth = `${Math.max(widthFactor, 0.01)}px`;
    const maskHeight = `${Math.max(heightFactor, 0.01)}px`;

    this.overlayImage.style.setProperty("mask-image", maskImage);
    this.overlayImage.style.setProperty("mask-repeat", "repeat");
    this.overlayImage.style.setProperty("mask-position", "0 0");
    this.overlayImage.style.setProperty("mask-size", `${maskWidth} ${maskHeight}`);
    this.overlayImage.style.setProperty("-webkit-mask-image", maskImage);
    this.overlayImage.style.setProperty("-webkit-mask-repeat", "repeat");
    this.overlayImage.style.setProperty("-webkit-mask-position", "0 0");
    this.overlayImage.style.setProperty("-webkit-mask-size", `${maskWidth} ${maskHeight}`);
  }
}

export async function fallbackOverlay(canvas: HTMLCanvasElement, templateController: TemplateController) {
  return Overlay.create(canvas, templateController);
}
