import { getFixupXLinks } from "./fixupx.js";

test("rewrites X and Twitter status links to fixupx", () => {
    expect(getFixupXLinks("https://x.com/user/status/12345?s=20"))
        .toEqual(["https://fixupx.com/user/status/12345?s=20"]);
    expect(getFixupXLinks("https://twitter.com/user/status/67890."))
        .toEqual(["https://fixupx.com/user/status/67890"]);
});

test("ignores non-tweet URLs and unrelated domains", () => {
    expect(getFixupXLinks("https://x.com/user and https://example.com/user/status/123"))
        .toEqual([]);
    expect(getFixupXLinks("x.com/user/status/123 and twitter.com/user/status/456"))
        .toEqual([]);
});

test("finds multiple tweet links in a message", () => {
    expect(getFixupXLinks("https://x.com/a/status/1 and http://x.com/b/status/2"))
        .toEqual([
            "https://fixupx.com/a/status/1",
            "http://fixupx.com/b/status/2"
        ]);
});