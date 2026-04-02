/**
 *
 * Part of the MLP r/place Project, under the Apache License v2.0 or ISC.
 * SPDX-License-Identifier: Apache-2.0 OR ISC
 * SPDX-FileCopyrightText: Copyright CONTRIBUTORS.md
 *
 **
 *
 * @file Auto-selects the active paint color from the template pixel under the cursor.
 *
 **/

import type {TemplateImage} from "./template/templateImage";

const coordPillSelector = ".coord-pill";
const paletteRootSelector = "#color-palette";
const paletteButtonSelector = 'button[id^="color-"]';
const syncIntervalMs = 50;

interface TemplateImageSource {
  currentTemplate: TemplateImage | null;
  addEventListener(event: string, callback: (template: TemplateImage) => void): void;
}

interface PaletteButtonData {
  button: HTMLButtonElement;
  colorId: number;
  rgb: [number, number, number];
}

export class AutoColorPicker {
  private templateCanvas = document.createElement("canvas");
  private templateContext = this.templateCanvas.getContext("2d", {willReadFrequently: true})!;
  private templateVersion = 0;
  private syncHandle: number | null = null;
  private lastAppliedColorId: number | null = null;

  constructor(private templateSource: TemplateImageSource) {
    this.templateSource.addEventListener("update", (template) => {
      void this.updateTemplate(template);
    });
  }

  async start() {
    if (this.templateSource.currentTemplate)
      await this.updateTemplate(this.templateSource.currentTemplate);

    if (this.syncHandle === null)
      this.syncHandle = window.setInterval(() => {
        this.syncColor();
      }, syncIntervalMs);
  }

  private async updateTemplate(template: TemplateImage) {
    const templateVersion = ++this.templateVersion;
    const image = new Image();
    image.decoding = "async";
    image.src = template.src;

    try {
      if (typeof image.decode === "function") {
        await image.decode();
      } else {
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error(`Failed to decode template image ${template.src}`));
        });
      }
    } catch (error) {
      if (templateVersion === this.templateVersion)
        console.warn("Failed to decode template image for auto color picker", error);
      return;
    }

    if (templateVersion !== this.templateVersion)
      return;

    this.templateCanvas.width = template.width;
    this.templateCanvas.height = template.height;
    this.templateContext.clearRect(0, 0, template.width, template.height);
    this.templateContext.drawImage(image, 0, 0);
  }

  private syncColor() {
    const paletteButtons = this.getPaletteButtons();
    if (paletteButtons.length === 0) {
      this.lastAppliedColorId = null;
      return;
    }

    const coords = this.getCursorCoordinates();
    if (!coords)
      return;

    const pixel = this.getTemplatePixel(coords.x, coords.y);
    if (!pixel || pixel[3] !== 255)
      return;

    const targetButton = this.findClosestPaletteButton(pixel, paletteButtons);
    if (!targetButton)
      return;

    if (this.isPaletteButtonSelected(targetButton.button)) {
      this.lastAppliedColorId = targetButton.colorId;
      return;
    }

    if (this.lastAppliedColorId === targetButton.colorId)
      return;

    targetButton.button.click();
    this.lastAppliedColorId = targetButton.colorId;
  }

  private getCursorCoordinates() {
    const coordPill = document.querySelector(coordPillSelector);
    if (!(coordPill instanceof HTMLElement))
      return null;

    const coordMatch = coordPill.textContent?.match(/\((-?\d+)\s*,\s*(-?\d+)\)/);
    if (!coordMatch)
      return null;

    return {
      x: Number.parseInt(coordMatch[1], 10),
      y: Number.parseInt(coordMatch[2], 10)
    };
  }

  private getPaletteButtons(): PaletteButtonData[] {
    const paletteRoot = document.querySelector(paletteRootSelector);
    if (!(paletteRoot instanceof HTMLElement))
      return [];

    return [...paletteRoot.querySelectorAll(paletteButtonSelector)].flatMap((button) => {
      if (!(button instanceof HTMLButtonElement))
        return [];

      const rgb = parseRgb(button.style.backgroundColor || getComputedStyle(button).backgroundColor);
      const colorId = Number.parseInt(button.id.replace("color-", ""), 10);
      if (!rgb || Number.isNaN(colorId))
        return [];

      return [{
        button,
        colorId,
        rgb
      }];
    });
  }

  private getTemplatePixel(x: number, y: number): Uint8ClampedArray | null {
    if (x < 0 || y < 0 || x >= this.templateCanvas.width || y >= this.templateCanvas.height)
      return null;

    return this.templateContext.getImageData(x, y, 1, 1).data;
  }

  private findClosestPaletteButton(pixel: Uint8ClampedArray, paletteButtons: PaletteButtonData[]) {
    let bestButton: PaletteButtonData | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const paletteButton of paletteButtons) {
      const distance =
        Math.abs(pixel[0] - paletteButton.rgb[0]) +
        Math.abs(pixel[1] - paletteButton.rgb[1]) +
        Math.abs(pixel[2] - paletteButton.rgb[2]);
      if (distance >= bestDistance)
        continue;

      bestButton = paletteButton;
      bestDistance = distance;
      if (distance === 0)
        break;
    }

    return bestButton;
  }

  private isPaletteButtonSelected(button: HTMLButtonElement) {
    return button.className.includes("scale-[1.1]") || button.className.includes("dropshadow");
  }
}

function parseRgb(colorText: string): [number, number, number] | null {
  const colorMatch = colorText.match(/\d+/g);
  if (!colorMatch || colorMatch.length < 3)
    return null;

  return [
    Number.parseInt(colorMatch[0], 10),
    Number.parseInt(colorMatch[1], 10),
    Number.parseInt(colorMatch[2], 10)
  ];
}
