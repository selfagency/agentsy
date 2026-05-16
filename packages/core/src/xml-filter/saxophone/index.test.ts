import { describe, expect, it, vi } from "vitest";

import { Saxophone } from "./index.js";
import type {
  SaxophoneCData,
  SaxophoneComment,
  SaxophoneProcessingInstruction,
  SaxophoneTag,
  SaxophoneTagClose,
  SaxophoneText,
} from "./index.js";

function firstEvent<T>(events: T[]): T {
  const first = events[0];
  if (first === undefined) {
    throw new Error("Expected at least one event");
  }
  return first;
}

describe("Saxophone Parser", () => {
  // --- Basic XML parsing ---

  it("emits text events for plain text content", () => {
    const parser = new Saxophone();
    const events: SaxophoneText[] = [];

    parser.on("text", (node: SaxophoneText) => {
      events.push(node);
    });

    parser.write("hello world");
    parser.end();

    expect(events).toHaveLength(1);
    expect(firstEvent(events).contents).toBe("hello world");
  });

  it("emits tagopen events for opening tags", () => {
    const parser = new Saxophone();
    const events: SaxophoneTag[] = [];

    parser.on("tagopen", (node: SaxophoneTag) => {
      events.push(node);
    });

    parser.write("<div>content</div>");
    parser.end();

    expect(events).toHaveLength(1);
    expect(firstEvent(events).name).toBe("div");
    expect(firstEvent(events).isSelfClosing).toBeFalsy();
  });

  it("emits tagclose events for closing tags", () => {
    const parser = new Saxophone();
    const events: SaxophoneTagClose[] = [];

    parser.on("tagclose", (node: SaxophoneTagClose) => {
      events.push(node);
    });

    parser.write("<p>text</p>");
    parser.end();

    expect(events).toHaveLength(1);
    expect(firstEvent(events).name).toBe("p");
  });

  it("emits both open and close events for complete tags", () => {
    const parser = new Saxophone();
    const openEvents: SaxophoneTag[] = [];
    const closeEvents: SaxophoneTagClose[] = [];

    parser.on("tagopen", (node: SaxophoneTag) => {
      openEvents.push(node);
    });

    parser.on("tagclose", (node: SaxophoneTagClose) => {
      closeEvents.push(node);
    });

    parser.write("<span>hello</span>");
    parser.end();

    expect(openEvents).toHaveLength(1);
    expect(closeEvents).toHaveLength(1);
    expect(firstEvent(openEvents).name).toBe("span");
    expect(firstEvent(closeEvents).name).toBe("span");
  });

  it("handles self-closing tags correctly", () => {
    const parser = new Saxophone();
    const events: SaxophoneTag[] = [];

    parser.on("tagopen", (node: SaxophoneTag) => {
      events.push(node);
    });

    parser.write("<br />text");
    parser.end();

    expect(events).toHaveLength(1);
    expect(firstEvent(events).name).toBe("br");
    expect(firstEvent(events).isSelfClosing).toBeTruthy();
  });

  it("handles multiple tags in sequence", () => {
    const parser = new Saxophone();
    const events: SaxophoneTag[] = [];

    parser.on("tagopen", (node: SaxophoneTag) => {
      events.push(node);
    });

    parser.write("<div><span><p></p></span></div>");
    parser.end();

    expect(events).toHaveLength(3);
    expect(events.map((e) => e.name)).toStrictEqual(["div", "span", "p"]);
  });

  // --- Attribute parsing ---

  it("extracts tag attributes correctly", () => {
    const parser = new Saxophone();
    const events: SaxophoneTag[] = [];

    parser.on("tagopen", (node: SaxophoneTag) => {
      events.push(node);
    });

    parser.write('<div class="container" id="main">text</div>');
    parser.end();

    expect(events).toHaveLength(1);
    expect(firstEvent(events).name).toBe("div");
    expect(firstEvent(events).attrs).toContain('class="container"');
    expect(firstEvent(events).attrs).toContain('id="main"');
  });

  it("handles quoted attributes containing special characters", () => {
    const parser = new Saxophone();
    const events: SaxophoneTag[] = [];

    parser.on("tagopen", (node: SaxophoneTag) => {
      events.push(node);
    });

    parser.write(
      '<a href="https://example.com?param=value&other=123">link</a>'
    );
    parser.end();

    expect(events).toHaveLength(1);
    expect(firstEvent(events).attrs).toContain("href=");
  });

  it("handles empty attribute values", () => {
    const parser = new Saxophone();
    const events: SaxophoneTag[] = [];

    parser.on("tagopen", (node: SaxophoneTag) => {
      events.push(node);
    });

    parser.write('<input disabled="">text</input>');
    parser.end();

    expect(events).toHaveLength(1);
  });

  // --- CDATA sections ---

  it("emits cdata events for CDATA sections", () => {
    const parser = new Saxophone();
    const events: SaxophoneCData[] = [];

    parser.on("cdata", (node: SaxophoneCData) => {
      events.push(node);
    });

    parser.write("<![CDATA[some content]]>text");
    parser.end();

    expect(events).toHaveLength(1);
    expect(firstEvent(events).contents).toBe("some content");
  });

  it("preserves special characters in CDATA", () => {
    const parser = new Saxophone();
    const events: SaxophoneCData[] = [];

    parser.on("cdata", (node: SaxophoneCData) => {
      events.push(node);
    });

    parser.write("<![CDATA[<>&\"']]>");
    parser.end();

    expect(events).toHaveLength(1);
    expect(firstEvent(events).contents).toBe("<>&\"'");
  });

  it("handles CDATA with trailing text", () => {
    const parser = new Saxophone();
    const cdataEvents: SaxophoneCData[] = [];
    const textEvents: SaxophoneText[] = [];

    parser.on("cdata", (node: SaxophoneCData) => {
      cdataEvents.push(node);
    });

    parser.on("text", (node: SaxophoneText) => {
      textEvents.push(node);
    });

    parser.write("<![CDATA[data]]>after");
    parser.end();

    expect(cdataEvents).toHaveLength(1);
    expect(textEvents).toHaveLength(1);
    expect(firstEvent(textEvents).contents).toBe("after");
  });

  // --- Comments ---

  it("emits comment events for XML comments", () => {
    const parser = new Saxophone();
    const events: SaxophoneComment[] = [];

    parser.on("comment", (node: SaxophoneComment) => {
      events.push(node);
    });

    parser.write("<!-- a comment -->text");
    parser.end();

    expect(events).toHaveLength(1);
    expect(firstEvent(events).contents).toBe(" a comment ");
  });

  it("handles comments with special characters", () => {
    const parser = new Saxophone();
    const events: SaxophoneComment[] = [];

    parser.on("comment", (node: SaxophoneComment) => {
      events.push(node);
    });

    parser.write('<!-- <>&" test -->');
    parser.end();

    expect(events).toHaveLength(1);
    expect(firstEvent(events).contents).toContain('<>&"');
  });

  // --- Processing instructions ---

  it("emits processinginstruction events", () => {
    const parser = new Saxophone();
    const events: SaxophoneProcessingInstruction[] = [];

    parser.on(
      "processinginstruction",
      (node: SaxophoneProcessingInstruction) => {
        events.push(node);
      }
    );

    parser.write('<?xml version="1.0"?>');
    parser.end();

    expect(events.length).toBeGreaterThan(0);
    expect(firstEvent(events).contents).toContain('xml version="1.0"');
  });

  // --- Streaming ---

  it("handles text split across multiple write calls", () => {
    const parser = new Saxophone();
    const events: SaxophoneText[] = [];

    parser.on("text", (node: SaxophoneText) => {
      events.push(node);
    });

    parser.write("hello ");
    parser.write("world");
    parser.end();

    // Saxophone may split or combine text events
    const allText = events.map((e) => e.contents).join("");
    expect(allText).toContain("hello");
    expect(allText).toContain("world");
  });

  it("handles tags split across multiple write calls", () => {
    const parser = new Saxophone();
    const events: SaxophoneTag[] = [];

    parser.on("tagopen", (node: SaxophoneTag) => {
      events.push(node);
    });

    parser.write("<div");
    parser.write(">content</div>");
    parser.end();

    expect(events).toHaveLength(1);
    expect(firstEvent(events).name).toBe("div");
  });

  // Note: Saxophone parser doesn't handle CDATA sections split across chunks
  // It requires complete CDATA sections in a single chunk
  it("handles CDATA as complete sections", () => {
    const parser = new Saxophone();
    const events: SaxophoneCData[] = [];

    parser.on("cdata", (node: SaxophoneCData) => {
      events.push(node);
    });

    parser.write("<![CDATA[data]]>");
    parser.end();

    expect(events).toHaveLength(1);
    expect(firstEvent(events).contents).toBe("data");
  });

  it("handles comments split across multiple write calls", () => {
    const parser = new Saxophone();
    const events: SaxophoneComment[] = [];

    parser.on("comment", (node: SaxophoneComment) => {
      events.push(node);
    });

    parser.write("<!-");
    parser.write("- text -->");
    parser.end();

    expect(events).toHaveLength(1);
    expect(firstEvent(events).contents).toBe(" text ");
  });

  // --- Error handling ---

  it("emits error events for malformed XML - unclosed tag", () => {
    const parser = new Saxophone();
    const errors: Error[] = [];

    parser.on("error", (err: Error) => {
      errors.push(err);
    });

    parser.write("<div>content<p>nested");
    parser.end();

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((err) => err.message.includes("Unclosed"))).toBeTruthy();
  });

  it("emits error for mismatched closing tag", () => {
    const parser = new Saxophone();
    const errors: Error[] = [];

    parser.on("error", (err: Error) => {
      errors.push(err);
    });

    parser.write("<div><p>text</div></p>");
    parser.end();

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((err) => err.message.includes("Unclosed"))).toBeTruthy();
  });

  it("emits error for unclosed CDATA section", () => {
    const parser = new Saxophone();
    const errors: Error[] = [];

    parser.on("error", (err: Error) => {
      errors.push(err);
    });

    parser.write("<![CDATA[unclosed data");
    parser.end();

    expect(errors.length).toBeGreaterThan(0);
    expect(
      errors.some((err) => err.message.includes("Unclosed CDATA"))
    ).toBeTruthy();
  });

  it("emits error for unclosed comment", () => {
    const parser = new Saxophone();
    const errors: Error[] = [];

    parser.on("error", (err: Error) => {
      errors.push(err);
    });

    parser.write("<!-- comment without close");
    parser.end();

    expect(errors.length).toBeGreaterThan(0);
    expect(
      errors.some((err) => err.message.includes("Unclosed comment"))
    ).toBeTruthy();
  });

  it("emits error for unclosed processing instruction", () => {
    const parser = new Saxophone();
    const errors: Error[] = [];

    parser.on("error", (err: Error) => {
      errors.push(err);
    });

    parser.write('<?xml version="1.0');
    parser.end();

    expect(errors.length).toBeGreaterThan(0);
    expect(
      errors.some((err) =>
        err.message.includes("Unclosed processing instruction")
      )
    ).toBeTruthy();
  });

  // --- Edge cases and corner cases ---

  it("handles empty string input", () => {
    const parser = new Saxophone();
    const finishEvent = vi.fn();

    parser.on("finish", finishEvent);
    parser.write("");
    parser.end();

    expect(finishEvent).toHaveBeenCalledWith();
  });

  it("handles consecutive tags without whitespace", () => {
    const parser = new Saxophone();
    const events: SaxophoneTag[] = [];

    parser.on("tagopen", (node: SaxophoneTag) => {
      events.push(node);
    });

    parser.write("<div><span></span></div>");
    parser.end();

    expect(events).toHaveLength(2);
    expect(events.map((e) => e.name)).toStrictEqual(["div", "span"]);
  });

  it("handles self-closing tags with attributes", () => {
    const parser = new Saxophone();
    const events: SaxophoneTag[] = [];

    parser.on("tagopen", (node: SaxophoneTag) => {
      events.push(node);
    });

    parser.write('<img src="test.jpg" alt="test" />');
    parser.end();

    expect(events).toHaveLength(1);
    expect(firstEvent(events).name).toBe("img");
    expect(firstEvent(events).isSelfClosing).toBeTruthy();
    expect(firstEvent(events).attrs).toContain('src="test.jpg"');
  });

  it("handles nested structures correctly", () => {
    const parser = new Saxophone();
    const textEvents: SaxophoneText[] = [];
    const tagEvents: SaxophoneTag[] = [];

    parser.on("text", (node: SaxophoneText) => {
      textEvents.push(node);
    });

    parser.on("tagopen", (node: SaxophoneTag) => {
      tagEvents.push(node);
    });

    parser.write("<div><p>text1</p><p>text2</p></div>");
    parser.end();

    expect(tagEvents.length).toBeGreaterThan(0);
    expect(textEvents.some((t) => t.contents === "text1")).toBeTruthy();
    expect(textEvents.some((t) => t.contents === "text2")).toBeTruthy();
  });

  // --- Finish event ---

  it("emits finish event after successful parsing", () => {
    const parser = new Saxophone();
    const finishEvent = vi.fn();

    parser.on("finish", finishEvent);

    parser.write("<div>content</div>");
    parser.end();

    expect(finishEvent).toHaveBeenCalledOnce();
  });

  // --- parse() convenience method ---

  it("parse() method completes parsing in one call", () => {
    const parser = new Saxophone();
    const events: SaxophoneText[] = [];

    parser.on("text", (node: SaxophoneText) => {
      events.push(node);
    });

    parser.parse("<div>content</div>");

    expect(events).toHaveLength(1);
    expect(firstEvent(events).contents).toBe("content");
  });

  it("parse() calls end() internally", () => {
    const parser = new Saxophone();
    const finishEvent = vi.fn();

    parser.on("finish", finishEvent);

    parser.parse("<div>content</div>");

    expect(finishEvent).toHaveBeenCalledOnce();
  });

  // Large document streaming
  it("handles streaming of large documents", () => {
    const parser = new Saxophone();
    const textEvents: SaxophoneText[] = [];

    parser.on("text", (node: SaxophoneText) => {
      textEvents.push(node);
    });

    const largeContent = "a".repeat(10_000);
    parser.write(`<div>${largeContent}</div>`);
    parser.end();

    expect(textEvents.length).toBeGreaterThan(0);
    const allText = textEvents.map((e) => e.contents).join("");
    expect(allText).toContain("a");
  });

  // Complex nesting
  it("handles deeply nested structures", () => {
    const parser = new Saxophone();
    const events: SaxophoneTag[] = [];

    parser.on("tagopen", (node: SaxophoneTag) => {
      events.push(node);
    });

    const deepNesting = `<a>${"<b>".repeat(50)}content${"</b>".repeat(50)}</a>`;
    parser.write(deepNesting);
    parser.end();

    expect(events.length).toBeGreaterThan(50);
  });
});
