import { describe, expect, it } from "vitest";
import { detectInstallPlatform } from "./platform";

const UA = {
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0 Mobile/15E148 Safari/604.1",
  ipadDesktopMode:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15",
  android:
    "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0 Mobile Safari/537.36",
  macChrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0 Safari/537.36",
};

describe("detectInstallPlatform", () => {
  it("recognises iPhone browsers, including Chrome on iOS", () => {
    expect(detectInstallPlatform(UA.iphone, 5)).toBe("ios");
    expect(detectInstallPlatform(UA.iphoneChrome, 5)).toBe("ios");
  });

  it("treats a touch-enabled 'Macintosh' as an iPad, a real Mac as other", () => {
    expect(detectInstallPlatform(UA.ipadDesktopMode, 5)).toBe("ios");
    expect(detectInstallPlatform(UA.ipadDesktopMode, 0)).toBe("other");
    expect(detectInstallPlatform(UA.macChrome)).toBe("other");
  });

  it("recognises Android", () => {
    expect(detectInstallPlatform(UA.android, 5)).toBe("android");
  });
});
