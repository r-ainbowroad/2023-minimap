import {Emitter} from "./utils";

const NEXT_ART_MIN_DIST = 100; // art within this range is considered the same
const FOCUS_AREA_SIZE = 75;

export class CanvasComparer extends Emitter {
  private compareCanvas: HTMLCanvasElement;
  rPlaceCanvas: HTMLCanvasElement;
  templateCanvas: HTMLCanvasElement;
  maskCanvas: HTMLCanvasElement;

  constructor(rPlaceCanvas: HTMLCanvasElement, templateCanvas: HTMLCanvasElement, maskCanvas: HTMLCanvasElement) {
    super();
    this.rPlaceCanvas = rPlaceCanvas;
    this.templateCanvas = templateCanvas;
    this.maskCanvas = maskCanvas;

    this.compareCanvas = document.createElement("canvas");
    this.compareCanvas.width = rPlaceCanvas.width;
    this.compareCanvas.height = rPlaceCanvas.height;
  }

  private currentLocationIndex: number | null = null;
  findNextArt() {
    const templateData = this.templateCanvas.getContext("2d")!.getImageData(0, 0, this.rPlaceCanvas.width, this.rPlaceCanvas.height).data;

    const locations: Array<{ x: number, y: number }> = [];
    for (let i = 0; i < templateData.length; i += 4) {
      if (templateData[i + 3] === 0) continue;
      const x = (i / 4) % this.rPlaceCanvas.width;
      const y = Math.floor(i / 4 / this.rPlaceCanvas.width);

      const isNearOtherArt = !!locations.find(
        (loc) => Math.abs(x - loc.x) < NEXT_ART_MIN_DIST && Math.abs(y - loc.y) < NEXT_ART_MIN_DIST
      );
      if (isNearOtherArt) continue;

      locations.push({x, y});
    }

    const sortedLocations = locations.sort((a, b) => {
      if (a.x < b.x) return -1;
      if (a.x > b.x) return 1;
      if (a.y < b.y) return -1;
      if (a.y > b.y) return 1;
      return 0;
    });

    if (sortedLocations.length > 0) {
      if (this.currentLocationIndex === null) {
        this.currentLocationIndex = 0;
      } else {
        this.currentLocationIndex++;
        if (this.currentLocationIndex >= sortedLocations.length) {
          this.currentLocationIndex = 0;
        }
      }
      return sortedLocations[this.currentLocationIndex];
    }
  }

  /**
   * In place Fisher–Yates shuffle.
   *
   * @param array Array to be shuffled. Modified in place.
   */
  private shuffle<T>(array: Array<T>) {
    for (let i: number = array.length; i > 0;) {
      const j = Math.floor(Math.random() * i--);
      const t = array[i];
      array[i] = array[j];
      array[j] = t;
    }
  }

  /**
   * Pick a pixel from a list of buckets
   *
   * The `position` argument is the position in the virtual pool to be selected.  See the
   * docs for `selectRandomPixelWeighted` for information on what this is hand how it
   * works
   *
   * @param {Map<number, [number, number][]>} buckets
   * @param {number} position
   * @return {[number, number]}
   */
  pickFromBuckets(buckets: Map<number, [number, number][]>, position) {
    // All of the buckets, sorted in order from highest priority to lowest priority
    const orderedBuckets = [...buckets.entries()] // Convert map to array of tuples
      .sort(([ka], [kb]) => kb - ka); // Order by key (priority) DESC

    // Select the position'th element from the buckets
    for (const [, bucket] of orderedBuckets) {
      if (bucket.length <= position) position -= bucket.length;
      else {
        this.shuffle(bucket);
        return bucket[position];
      }
    }

    // If for some reason this breaks, just return a random pixel from the largest bucket
    const value = Array.from(buckets.keys()).reduce((a, b) => Math.max(a, b), 0);
    const bucket = buckets.get(value)!;
    return bucket[Math.floor(Math.random() * bucket.length)];
  }

  /**
   * Select a random pixel weighted by the mask.
   *
   * The selection algorithm works as follows:
   * - Pixels are grouped into buckets based on the mask
   * - A virtual pool of {FOCUS_AREA_SIZE} of the highest priority pixels is defined.
   *   - If the highest priority bucket contains fewer than FOCUS_AREA_SIZE pixels, the
   *     next highest bucket is pulled from, and so on until the $FOCUS_AREA_SIZE pixel
   *     threshold is met.
   * - A pixel is picked from this virtual pool without any weighting
   *
   * This algorithm avoids the collision dangers of only using one bucket, while requiring
   * no delays, and ensures that the size of the selection pool is always constant.
   *
   * Another way of looking at this:
   * - If >= 75 pixels are missing from the crystal, 100% of the auto picks will be there
   * - If 50 pixels are missing from the crystal, 67% of the auto picks will be there
   * - If 25 pixels are missing from the crystal, 33% of the auto picks will be there
   *
   * @param {[number, number][]} diff
   * @return {[number, number]}
   */
  selectRandomPixelWeighted(diff) {
    // Mask
    const maskData = this.maskCanvas.getContext("2d")!.getImageData(0, 0, this.maskCanvas.width, this.maskCanvas.height).data;
    const rPlaceMask = new Array(this.maskCanvas.width * this.maskCanvas.height);
    for (let i = 0; i < rPlaceMask.length; i++) {
      // Grayscale, pick green channel!
      rPlaceMask[i] = maskData[i * 4 + 1];
    }

    // Build the buckets
    const buckets = new Map();
    var totalAvailablePixels = 0;
    for (let i = 0; i < diff.length; i++) {
      const coords = diff[i];
      const [x, y] = coords;
      const maskValue = rPlaceMask![x + y * this.rPlaceCanvas.width];
      if (maskValue === 0) {
        continue;
      }
      totalAvailablePixels++;
      const bucket = buckets.get(maskValue);
      if (bucket === undefined) {
        buckets.set(maskValue, [coords]);
      } else {
        bucket.push(coords);
      }
    }

    // Select from buckets
    // Position represents the index in the virtual pool that we are selecting
    const position = Math.floor(Math.random() * Math.min(FOCUS_AREA_SIZE, totalAvailablePixels));
    const pixel = this.pickFromBuckets(buckets, position);
    return pixel;
  }

  private _countOfAllPixels = 0;
  private _diff: number[][] = [];

  get countOfWrongPixels() {
    return this._diff.length;
  }

  get countOfAllPixels() {
    return this._countOfAllPixels;
  }

  get countOfRightPixels() {
    return this.countOfAllPixels - this.countOfWrongPixels;
  }

  computeDiff() {
    // Update the minimap image (necessary for checking the diff)
    const compareCtx = this.compareCanvas.getContext("2d")!;
    compareCtx.clearRect(0, 0, this.compareCanvas.width, this.compareCanvas.height);
    compareCtx.drawImage(this.templateCanvas, 0, 0);
    compareCtx.globalCompositeOperation = "source-in";
    compareCtx.drawImage(this.rPlaceCanvas, 0, 0);
    compareCtx.globalCompositeOperation = "source-over";

    // Compute the diff
    const currentData = compareCtx.getImageData(0, 0, this.compareCanvas.width, this.compareCanvas.height).data;
    const templateData = this.templateCanvas.getContext("2d")!.getImageData(0, 0, this.compareCanvas.width, this.compareCanvas.height).data;

    this._diff = [];
    this._countOfAllPixels = 0; // count of non-transparent pixels

    for (let i = 0; i < templateData.length / 4; i++) {
      if (currentData[i * 4 + 3] === 0) continue;
      this._countOfAllPixels++;
      if (
        templateData[i * 4 + 0] !== currentData[i * 4 + 0] ||
        templateData[i * 4 + 1] !== currentData[i * 4 + 1] ||
        templateData[i * 4 + 2] !== currentData[i * 4 + 2]
      ) {
        const x = i % this.compareCanvas.width;
        const y = (i - x) / this.compareCanvas.width;
        this._diff.push([x, y]);
      }
    }

    this.dispatchEvent(new Event("computed"));

    return [this._diff, this._countOfAllPixels];
  }

  /**
   * Select a random pixel.
   *
   * @return {{x: number, y: number}}
   */
  selectRandomPixelFromDiff() {
    let pixel;
    let isMaskNotEmpty = this.maskCanvas!.getContext('2d')!
        .getImageData(0, 0, this.maskCanvas!.width, this.maskCanvas!.height).data
        .some(channel => channel !== 0);
    if (!isMaskNotEmpty) {
      pixel = this._diff[Math.floor(Math.random() * this._diff.length)];
    } else {
      pixel = this.selectRandomPixelWeighted(this._diff);
    }
    const [x, y] = pixel;
    return {x, y};
  }

  private updateInterval: number | undefined = undefined;

  setInterval(ms) {
    this.updateInterval = setInterval(() => {
      this.computeDiff();
    }, ms);
  }

  clearInterval() {
    clearInterval(this.updateInterval);
  }
}