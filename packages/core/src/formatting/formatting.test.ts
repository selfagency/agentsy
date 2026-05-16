import { describe, expect, it } from "vitest";

import { formatXmlLikeResponseForDisplay } from "./formatXmlLikeResponseForDisplay.js";
import { sanitizeNonStreamingModelOutput } from "./sanitizeNonStreamingModelOutput.js";

describe(formatXmlLikeResponseForDisplay, () => {
  it("formats xml-like blocks as markdown headings", () => {
    expect(formatXmlLikeResponseForDisplay("<note>important</note>")).toBe(
      "**Note**\nimportant"
    );
  });

  it("returns original text when no xml tags are found", () => {
    expect(formatXmlLikeResponseForDisplay("plain text")).toBe("plain text");
  });

  it("returns oversized xml-like input unchanged to avoid pathological regex work", () => {
    const oversized = `<note>${"x".repeat(1_000_001)}</note>`;
    expect(formatXmlLikeResponseForDisplay(oversized)).toBe(oversized);
  });

  it("formats multiple xml-like blocks while preserving surrounding text", () => {
    expect(
      formatXmlLikeResponseForDisplay(
        "Intro <note>important</note> outro <status>ok</status>"
      )
    ).toBe("Intro \n\n**Note**\nimportant\n\n outro \n\n**Status**\nok");
  });
});

describe(sanitizeNonStreamingModelOutput, () => {
  it("strips context tags and formats remaining xml-like blocks", () => {
    const input = "<user_info>secret</user_info><note>hello</note>";
    expect(sanitizeNonStreamingModelOutput(input)).toBe("**Note**\nhello");
  });
});
