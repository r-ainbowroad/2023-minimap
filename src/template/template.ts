/**
 *
 * Part of the MLP r/place Project, under the Apache License v2.0 or ISC.
 * SPDX-License-Identifier: Apache-2.0 OR ISC
 * SPDX-FileCopyrightText: Copyright CONTRIBUTORS.md
 *
 **
 *
 * @file Interface for templating and the updating of templates.
 *
 **/
import EventEmitter from "../EventEmitter";
import {MqttMinimapClient} from "../realtime/mqttMinimapClient";
import {gm_fetch} from "../utils";
import {Notifications} from "../notifications/notifications";

export class TemplateData {
  private image: ImageData;

  constructor(image: ImageData) {
    this.image = image;
  }

  get width(): number {
    return this.image.width;
  }

  get height(): number {
    return this.image.height;
  }

  palettize(pallete) {
    const data = this.image.data;
    for (let i = 0; i < data.length / 4; i++) {
      const base = i * 4;
      const currentColor = data.slice(base, base + 3);
      const currentAlpha = data[base+ 3];
      if (currentColor[0] + currentColor[1] + currentColor[2] === 0) continue;
      if (currentColor[0] === 0 && currentColor[1] === 255 && currentColor[2] === 255 && currentAlpha === 254) continue;

      let newColor;
      let bestDiff = Infinity;
      for (const color of pallete) {
        const diff = Math.abs(currentColor[0] - color[0]) + Math.abs(currentColor[1] - color[1]) + Math.abs(currentColor[2] - color[2]);
        if (diff === 0)
          return color;
        if (diff < bestDiff) {
          bestDiff = diff;
          newColor = color;
        }
      }
      if (!newColor) newColor = [0, 0, 0];

      data[base] = newColor[0];
      data[base + 1] = newColor[1];
      data[base + 2] = newColor[2];
    }
  }

  drawTo(canvas: CanvasRenderingContext2D, x: number = 0, y: number = 0) {
    canvas.putImageData(this.image, x, y);
  }

  getDithered3x(): ImageData {
    const ret = new ImageData(this.image.width * 3, this.image.height * 3);
    for (let y = 0; y < this.image.height; ++y)
      for (let x = 0; x < this.image.width; ++x) {
        const sourceLoc = (y * this.image.width + x) * 4;
        const destLoc = ((y * 3 + 1) * ret.width + (x * 3 + 1)) * 4;
        for (let i = 0; i < 4; ++i)
          ret.data[destLoc + i] = this.image.data[sourceLoc + i];
      }
    return ret;
  }

  toDithered3x() {
    let newImage = this.getDithered3x();
    return new TemplateData(newImage);
  }
}

export class TemplateController extends EventEmitter {
  private baseURL = "https://cdn.minimap.brony.place/templates";
  private faction: string = "";
  currentTemplate: TemplateData | null = null;
  private lastId: string = "";
  private mqtt: MqttMinimapClient | null = null;
  private notifications: Notifications | null = null;

  constructor(mqtt: MqttMinimapClient, notifications: Notifications) {
    super();

    this.mqtt = mqtt;
    this.notifications = notifications;
  }

  private getBaseURL(faction: string, id: string) {
    return `${this.baseURL}/${faction}/full/${id}.png`;
  }

  private async fetchImage(url: string): Promise<TemplateData> {
    let resp = await gm_fetch({
      method: "GET",
      responseType: "arraybuffer",
      url
    });

    if (resp.status != 200)
      throw new HTTPResponseError(resp.status, resp.statusText);

    const bitmap = await createImageBitmap(new Blob([new Uint8ClampedArray(resp.response)]));
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(bitmap, 0 , 0);
    return new TemplateData(context.getImageData(0, 0, bitmap.width, bitmap.height));
  }

  private async fetchBaseImage(faction: string, id: string): Promise<TemplateData> {
    return this.fetchImage(this.getBaseURL(faction, id));
  }

  private async updateTemplate(update: TemplateData, x: number = 0, y: number = 0, raw: boolean = false): Promise<TemplateData> {
    const currentCanvas = document.createElement('canvas');
    currentCanvas.width = this.currentTemplate!.width;
    currentCanvas.height = this.currentTemplate!.height;
    const currentCtx = currentCanvas.getContext('2d') as CanvasRenderingContext2D;

    this.currentTemplate!.drawTo(currentCtx);

    if (raw) {
      update.drawTo(currentCtx, x, y);
    } else {
      const updateCanvas = document.createElement('canvas');
      updateCanvas.width = update.width;
      updateCanvas.height = update.height;
      const updateCtx = updateCanvas.getContext('2d', {willReadFrequently: true}) as CanvasRenderingContext2D;

      update.drawTo(updateCtx);

      for (let uy = 0; uy < update.height; uy++) {
        for (let ux = 0; ux < update.width; ux++) {
          let color = updateCtx.getImageData(ux, uy, 1, 1).data;

          if (color[0] == 0 && color[1] == 255 && color[2] == 255 && color[3] == 254) {
            // Nothing changed here. Skip it.
            continue;
          }

          currentCtx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${color[3]})`;
          currentCtx.clearRect(x + ux, y + uy, 1, 1);
          currentCtx.fillRect(x + ux, y + uy, 1, 1);
        }
      }
    }

    return new TemplateData(currentCtx.getImageData(0, 0, currentCanvas.width, currentCanvas.height));
  }

  private async resizeTemplate(top: number, bottom: number, left: number, right: number) {
    const canvas = document.createElement('canvas');
    canvas.width = (left + this.currentTemplate!.width + right);
    canvas.height = (top + this.currentTemplate!.height + bottom);
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

    this.currentTemplate!.drawTo(ctx, left, top);

    return new TemplateData(ctx.getImageData(0, 0, canvas.width, canvas.height));
  }

  async onUpdate(data: TemplateUpdate, retained: boolean) {
    if (data.type === "full") {
      const fullData = data as FullTemplateUpdate;

      if (this.lastId == fullData.id) return;

      this.currentTemplate = await this.fetchBaseImage(this.faction, fullData.id);
      this.emit("update", this.currentTemplate);
      this.lastId = fullData.id;
    }
    if (data.type === "diff") {
      const diffData = data as DiffTemplateUpdate;
      if (retained) {
        if (this.lastId != diffData.current_id) {
          if (this.lastId != diffData.previous_id) {
            // Get the current template then let stuff below work.
            this.currentTemplate = await this.fetchBaseImage(this.faction, diffData.previous_id);
          }
          // From this point, we'll fall down to the normal non-retained behaviour.
        } else {
          // Nothing else to do.
          return;
        }
      }
      // Handle resize if present
      if (diffData.resize) {
        this.currentTemplate = await this.resizeTemplate(
          diffData.resize.top ?? 0,
          diffData.resize.bottom ?? 0,
          diffData.resize.left ?? 0,
          diffData.resize.right ?? 0
        );
      }

      if (diffData.diff) {
        // We convert the RawDiffTemplateUpdate into a DiffTemplateUpdate via processTemplateImage
        let templateData = await this.fetchImage(diffData.diff);
        this.currentTemplate = await this.updateTemplate(templateData, diffData.x, diffData.y, diffData.raw ?? false);
      }
      this.emit("update", this.currentTemplate);
      if (diffData.current_id != null)
        this.lastId = diffData.current_id;
    }
  }

  setFaction(faction: string) {
    this.faction = faction;
  }

  async initiate() {
    this.mqtt!.addEventListener("updates", (data: TemplateUpdate, retained: boolean) => this.onUpdate(data, retained));
    this.mqtt!.addEventListener("faction", (faction: string) => this.setFaction(faction));

    return true;
  }
}

export class HTTPResponseError extends Error {
  constructor(status: number, message: string) {
    super(`[${status}] ${message}`);
  }
}

interface TemplateUpdate {
  type: "diff" | "full",
  message?: string
}

interface FullTemplateUpdate {
  type: "full",
  id: string
}

interface DiffTemplateUpdate {
  type: "diff",
  previous_id: string,
  current_id: string,
  x: number,
  y: number,
  raw: boolean,
  diff?: string,
  resize?: TemplateResizeUpdate
}

interface TemplateResizeUpdate {
  top?: number,
  bottom?: number,
  left?: number,
  right?: number
}