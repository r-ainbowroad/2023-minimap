
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
  }

  interface Embed extends HTMLElement {
    camera: Camera;
    selectedColor: number;
    nextTileAvailableIn: number;
    showColorPicker: boolean;

    wakeUp(): any;
    onConfirmPixel(): any;
  }
}
