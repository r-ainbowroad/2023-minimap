
declare namespace MonaLisa {
  interface Coordinate {
    x: number,
    y: number,
    zoom?: number
  }

  interface Pos {
    x: number,
    y: number,
    scale: number
  }

  interface Camera {
    applyPosition(point: Coordinate): any;
    cx: number;
    cy: number;
    zoom: number;
  }

  interface Embed extends HTMLElement {
    _events: any;
    camera: Camera;
    selectedColor: number;
    nextTileAvailableIn: number;
    showColorPicker: boolean;

    wakeUp(): any;
    onConfirmPixel(...args): any;
  }
}
