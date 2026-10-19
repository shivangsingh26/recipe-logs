import { describe, expect, it } from "vitest";
import { fitWithin, NOT_AN_IMAGE_MESSAGE, processImage, UNSUPPORTED_IMAGE_MESSAGE } from "./image";

describe("fitWithin", () => {
  it("scales the longest edge down to the max, keeping the aspect ratio", () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(1600, 1200, 480)).toEqual({ width: 480, height: 360 });
  });

  it("never upscales", () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1600, 1600, 1600)).toEqual({ width: 1600, height: 1600 });
  });

  it("rounds to whole pixels and keeps at least 1px", () => {
    expect(fitWithin(1000, 333, 480)).toEqual({ width: 480, height: 160 });
    expect(fitWithin(10000, 10, 480)).toEqual({ width: 480, height: 1 });
  });

  it("rejects invalid sizes", () => {
    expect(() => fitWithin(0, 100, 480)).toThrow(RangeError);
    expect(() => fitWithin(Number.NaN, 100, 480)).toThrow(RangeError);
    expect(() => fitWithin(100, 100, 0)).toThrow(RangeError);
  });
});

describe("processImage", () => {
  it("rejects files that are not images", async () => {
    await expect(processImage(new Blob(["hello"], { type: "text/plain" }))).rejects.toThrow(NOT_AN_IMAGE_MESSAGE);
  });

  it("reports undecodable images clearly", async () => {
    // No image decoder in Node: the same path a browser takes for an unsupported format.
    await expect(processImage(new Blob(["not really a jpeg"], { type: "image/jpeg" }))).rejects.toThrow(
      UNSUPPORTED_IMAGE_MESSAGE,
    );
  });
});
