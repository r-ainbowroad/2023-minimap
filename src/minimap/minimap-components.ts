/**
 *
 * Part of the MLP r/place Project, under the Apache License v2.0 or ISC.
 * SPDX-License-Identifier: Apache-2.0 OR ISC
 * SPDX-FileCopyrightText: Copyright CONTRIBUTORS.md
 *
 **
 *
 * @file Minimap UI components.
 *
 **/

import {html, render} from 'uhtml';

export class CheckboxSetting {
  name: string;
  enabled: boolean;
  callback: Function;

  constructor(name, enabled = false, callback = function (setting) {}) {
    this.name = name;
    this.enabled = enabled;
    this.callback = callback;
  }
  // onchange(e) {
  //   this.enabled = e.target.checked;
  //   this.callback();
  // }
  onclick() {
    this.enabled = !this.enabled;
    this.callback(this);
  }
  htmlFor(ref, id) {
    // NOTE(Dusk): It looks like Reddit hijacks all native checkboxes.
    // const onchange = () => this.onchange();
    // return html.for(ref, id)`<label data-id=${id}>
    //   ${this.name}: <input type="checkbox" .checked=${this.enabled} onchange=${onchange} />
    // </label>`;
    const onclick = () => this.onclick();
    const classes = ["clickable"];
    this.enabled ? classes.push("alwaysshow") : null;
    return html.for(ref, id)`<div data-id=${id} class=${classes.join(" ")} onclick=${onclick}>
      ${this.name}: <span>${this.enabled ? "Enabled" : "Disabled"}</span>
    </div>`;
  }
}

export class CycleSetting {
  name: string;
  values: Array<string>;
  valueIx: number;
  callback: (setting) => void;
  alwaysShow: boolean;

  constructor(
    name,
    values = ["Unset"],
    valueIx = 0,
    callback = function (setting) {},
    alwaysShow = false
  ) {
    this.name = name;
    this.values = values;
    this.valueIx = valueIx;
    this.callback = callback;
    this.alwaysShow = alwaysShow;
  }
  get value() {
    return this.values[this.valueIx];
  }
  onclick() {
    this.valueIx = (this.valueIx + 1) % this.values.length;
    this.callback(this);
  }
  htmlFor(ref, id) {
    const onclick = () => this.onclick();
    const classes = ["clickable"];
    this.alwaysShow ? classes.push("alwaysshow") : null;
    return html.for(ref, id)`<div data-id=${id} class=${classes.join(" ")} onclick=${onclick}>
      ${this.name}: <span>${this.value}</span>
    </div>`;
  }
}

export class ButtonSetting {
  name: string;
  callback: (setting) => void;
  alwaysShow: boolean;

  constructor(name, callback = function (setting) {}, alwaysShow = false) {
    this.name = name;
    this.callback = callback;
    this.alwaysShow = alwaysShow;
  }
  onclick() {
    this.callback(this);
  }
  htmlFor(ref, id) {
    const onclick = () => this.onclick();
    const classes = ["clickable"];
    this.alwaysShow ? classes.push("alwaysshow") : null;
    return html.for(ref, id)`<div data-id=${id} class=${classes.join(" ")} onclick=${onclick}>
      ${this.name}
    </div>`;
  }
}

export class DisplaySetting {
  name: string;
  content: string;
  alwaysShow: boolean;

  constructor(name, content, alwaysShow = false) {
    this.name = name;
    this.content = content;
    this.alwaysShow = alwaysShow;
  }
  htmlFor(ref, id) {
    const classes: Array<string> = [];
    this.alwaysShow ? classes.push("alwaysshow") : null;
    return html.for(ref, id)`<div data-id=${id} class=${classes.join(" ")}>${this.name}: ${
      this.content
    }</div>`;
  }
}

export class Settings {
  settings: Array<any> = [];
  settingNames = new Map();
  settingsByName = new Map();

  constructor(settingsBlock, mlpMinimapBlock) {
    const _root = this;

    requestAnimationFrame(function measure(time) {
      render(settingsBlock, _root.htmlFor(mlpMinimapBlock, "settings"));
      requestAnimationFrame(measure);
    });
  }

  htmlFor(ref, id) {
    return html.for(ref, id)`${this.settings.map((setting) =>
      setting.htmlFor(this, this.settingNames.get(setting))
    )}`;
  }

  addSetting(name, setting) {
    this.settings.push(setting);
    this.settingNames.set(setting, name);
    this.settingsByName.set(name, setting);
  }

  getSetting(name) {
    return this.settingsByName.get(name);
  }
}