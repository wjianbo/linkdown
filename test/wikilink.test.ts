import test from "node:test";
import assert from "node:assert/strict";

import { parseWikilink } from "../src/core/wikilink.js";

test("parses a plain wikilink", () => {
  assert.deepEqual(parseWikilink("[[运动三定律]]"), {
    raw: "[[运动三定律]]",
    targetTitle: "运动三定律",
    label: "运动三定律",
  });
});

test("parses alias and anchor combinations", () => {
  assert.deepEqual(parseWikilink("[[运动三定律#第二定律|牛顿定律]]"), {
    raw: "[[运动三定律#第二定律|牛顿定律]]",
    targetTitle: "运动三定律",
    anchor: "第二定律",
    label: "牛顿定律",
  });
});
