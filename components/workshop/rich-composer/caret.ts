"use client";

/**
 * Compute the (x, y) coordinates of a textarea caret, relative to the
 * textarea's top-left content box (same space as a child with
 * `position: absolute; left/top` inside a `position: relative` wrapper).
 *
 * Uses the mirror-div technique: clone styles + text up to the caret and
 * measure the marker **inside the mirror** (not vs the real textarea's
 * viewport rect). Comparing mirror coords to the textarea's
 * getBoundingClientRect is wrong when the mirror is parked at body (0,0)
 * and the composer sits at the bottom of the chat dock — that produced
 * huge negative Y and pinned the @ popover to the top of the chat panel.
 */
export function getCaretCoordinates(
  textarea: HTMLTextAreaElement,
  position: number,
): { x: number; y: number; height: number } | null {
  const value = textarea.value;
  if (typeof window === "undefined" || typeof document === "undefined") return null;

  const div = document.createElement("div");
  copyStyles(textarea, div);
  div.style.position = "absolute";
  div.style.visibility = "hidden";
  div.style.whiteSpace = "pre-wrap";
  div.style.wordWrap = "break-word";
  // Park off-screen; only relative geometry inside the mirror matters.
  div.style.top = "0";
  div.style.left = "-9999px";
  div.style.width = `${textarea.clientWidth}px`;
  // Height must not clip multi-line content for measurement.
  div.style.height = "auto";
  div.style.overflow = "hidden";

  const before = document.createElement("span");
  // Preserve trailing newlines so the caret drops to the next line.
  before.textContent = value.substring(0, position).replace(/\n$/g, "\n\u200b");
  div.appendChild(before);

  const marker = document.createElement("span");
  marker.textContent = "\u200b";
  div.appendChild(marker);

  document.body.appendChild(div);

  try {
    // offsetTop/Left are relative to the offset parent (the mirror div).
    const x = marker.offsetLeft - textarea.scrollLeft;
    const y = marker.offsetTop - textarea.scrollTop;
    const height = marker.offsetHeight || parseFloat(getComputedStyle(textarea).lineHeight) || 16;
    return { x, y, height };
  } finally {
    document.body.removeChild(div);
  }
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
