"use client";

/**
 * Compute the (x, y) coordinates of a textarea caret, relative to the
 * textarea's top-left corner. Returns null if the element or selection
 * can't be measured.
 *
 * Uses the well-known "mirror div" technique: clone the textarea's text
 * up to the caret, copy its styles, and measure where the trailing
 * character lands. This is the same approach Lexical and ProseMirror use
 * for inline mention popovers.
 */
export function getCaretCoordinates(
  textarea: HTMLTextAreaElement,
  position: number,
): { x: number; y: number; height: number } | null {
  const value = textarea.value;
  if (typeof window === "undefined" || typeof document === "undefined") return null;

  // Build a mirror div with the same styling.
  const div = document.createElement("div");
  copyStyles(textarea, div);
  div.style.position = "absolute";
  div.style.visibility = "hidden";
  div.style.whiteSpace = "pre-wrap";
  div.style.wordWrap = "break-word";
  div.style.top = "0";
  div.style.left = "0";
  div.style.width = `${textarea.clientWidth}px`;

  // Two spans: text up to caret, then a marker span for the caret position.
  const before = document.createElement("span");
  before.textContent = value.substring(0, position);
  div.appendChild(before);

  const marker = document.createElement("span");
  marker.textContent = value.substring(position) || ".";
  div.appendChild(marker);

  document.body.appendChild(div);
  const beforeRect = before.getBoundingClientRect();
  const markerRect = marker.getBoundingClientRect();
  document.body.removeChild(div);

  const taRect = textarea.getBoundingClientRect();
  // The mirror is laid out in the same coordinate space; subtract textarea top.
  const x = markerRect.left - taRect.left;
  const y = (beforeRect.top === markerRect.top ? markerRect.top : beforeRect.bottom) - taRect.top;
  const height = markerRect.height || 16;
  return { x, y, height };
}

const COPY_STYLE_PROPS = [
  "boxSizing",
  "width",
  "height",
  "overflowX",
  "overflowY",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderStyle",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "fontStretch",
  "fontSize",
  "fontSizeAdjust",
  "lineHeight",
  "fontFamily",
  "textAlign",
  "textTransform",
  "textIndent",
  "textDecoration",
  "letterSpacing",
  "wordSpacing",
  "tabSize",
] as const;

function copyStyles(src: HTMLElement, dst: HTMLElement) {
  const cs = window.getComputedStyle(src);
  for (const prop of COPY_STYLE_PROPS) {
    (dst.style as unknown as Record<string, string>)[prop] = cs.getPropertyValue(prop);
  }
}
