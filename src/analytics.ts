/**
 *
 * Part of the MLP r/place Project, under the Apache License v2.0 or ISC.
 * SPDX-License-Identifier: Apache-2.0 OR ISC
 * SPDX-FileCopyrightText: Copyright CONTRIBUTORS.md
 *
 **
 *
 * @file Keep track of various statistics. Mostly used to know how many pixels per second we have.
 *
 **/

import {v4 as uuidv4} from 'uuid';

function formatLog(...args) {
  const formattedArgs = args.map((arg) => {
    if (Array.isArray(arg)) {
      return JSON.stringify(arg);
    } else if (typeof arg === 'object' && arg !== null) {
      return JSON.stringify(arg);
    } else {
      return arg;
    }
  });

  return formattedArgs.join(" ");
}

export class Analytics {
  #endpoint: URL;
  #uuid: uuidv4;

  constructor(endpoint: URL) {
    this.#endpoint = endpoint;
    this.#uuid = uuidv4();
  }

  private send(data) {
    GM.xmlHttpRequest({
      url: this.#endpoint.toString(),
      method: 'POST',
      data: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json"
      }
    });
  }

  async placedPixel(type: string, template: string, pos: {x: number, y: number}, color: number, timestamp: number,
                    nextPixelPlace: {reddit: number, safe: number}) {
    const data = {
      id: this.#uuid,
      event: 'pixel',
      type: type,
      template: template,
      pos: {
        x: pos.x,
        y: pos.y
      },
      color: color,
      timestamp: timestamp / 1000,
      nextPixelPlace: nextPixelPlace
    };

    this.send(data);
  }

  async logError(...args) {
    const data = {
      id: this.#uuid,
      event: 'error',
      timestamp: new Date().getTime() / 1000,
      message: formatLog(...args)
    };

    this.send(data);
  }

  async statusUpdate(template: string, correctPixels: number, totalPixels: number) {
    const data = {
      id: this.#uuid,
      event: 'status',
      timestamp: Date.now() / 1000,
      template: template,
      correctPixels: correctPixels,
      totalPixels: totalPixels
    };

    this.send(data);
  }
}
