function frame(p) {
  const t = Math.sin((Math.PI * p) / 100);
  const border = Math.round(26 + 44 * t);
  const borderColor = Math.round(28 + 44 * t);
  const glow = Math.round(14 + 38 * t);
  const blur = Math.round(4 + 16 * t);
  const spread = Math.round(5 * t);
  const bg = Math.round(7 + 19 * t);

  return [
    `  ${p}% {`,
    "    box-shadow:",
    `      0 0 0 1px color-mix(in srgb, var(--accent) ${border}%, transparent),`,
    `      0 0 ${blur}px ${spread}px color-mix(in srgb, var(--accent) ${glow}%, transparent);`,
    `    background: color-mix(in srgb, var(--accent) ${bg}%, transparent);`,
    `    border-color: color-mix(in srgb, var(--accent) ${borderColor}%, transparent);`,
    "  }",
  ].join("\n");
}

const lines = ["@keyframes desktop-update-glow {"];
lines.push("  0%,");
lines.push(frame(100).replace("  100%", "  100%"));

for (let p = 2; p < 100; p += 2) {
  lines.push(frame(p));
}

lines.push("}");
console.log(lines.join("\n"));