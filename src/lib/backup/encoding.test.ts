import { describe, expect, it } from "vitest";
import { base64ToBytes, bytesToBase64, extensionForMime, fromDataUrl, isZip, toArrayBuffer, toDataUrl } from "./encoding";

describe("base64", () => {
  it("round-trips buffers larger than one encoding chunk", () => {
    const bytes = new Uint8Array(100_000).map((_, i) => (i * 7 + 3) % 256);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });

  it("matches the platform encoder", () => {
    const text = "Kacchi biryani";
    expect(bytesToBase64(new TextEncoder().encode(text))).toBe(Buffer.from(text).toString("base64"));
  });
});

describe("data URLs", () => {
  it("encodes and decodes with the mime type", () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]);
    const url = toDataUrl(toArrayBuffer(bytes), "image/jpeg");
    expect(url).toBe("data:image/jpeg;base64,/9j/AQID");
    expect(fromDataUrl(url)).toEqual({ bytes, mime: "image/jpeg" });
  });

  it("accepts bare base64 and rejects everything else", () => {
    expect(fromDataUrl("/9j/AQID")?.bytes).toEqual(new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]));
    expect(fromDataUrl("data:text/plain,hello")).toBeNull();
    expect(fromDataUrl("data:image/jpeg;base64,")).toBeNull();
    expect(fromDataUrl("not base64 at all!")).toBeNull();
    expect(fromDataUrl(42)).toBeNull();
  });
});

describe("helpers", () => {
  it("copies a view into an exact-length buffer", () => {
    const view = new Uint8Array([1, 2, 3, 4, 5]).subarray(1, 3);
    expect([...new Uint8Array(toArrayBuffer(view))]).toEqual([2, 3]);
  });

  it("sniffs zip signatures", () => {
    expect(isZip(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0]))).toBe(true);
    expect(isZip(new Uint8Array([0x50, 0x4b, 0x05, 0x06]))).toBe(true);
    expect(isZip(new TextEncoder().encode('{"format":'))).toBe(false);
    expect(isZip(new Uint8Array([0x50]))).toBe(false);
  });

  it("maps mime types to file extensions", () => {
    expect(extensionForMime("image/jpeg")).toBe("jpg");
    expect(extensionForMime("IMAGE/PNG")).toBe("png");
    expect(extensionForMime("application/octet-stream")).toBe("jpg");
  });
});
