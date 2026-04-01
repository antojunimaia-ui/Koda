import isUnicodeSupported from "is-unicode-supported";

const unicode = isUnicodeSupported();

export const symbols = {
  // Always use these fun emojis, CMD handles them okay generally via substitution
  brain: "🧠",
  dir: "📂",
  lightning: "⚡",
  
  // These specific dingbats/arrows often break terribly in classic Windows CMD
  // U+276F ❯ breaks in CMD. Fallback to standard >
  arrow: unicode ? "❯" : ">",
  
  // Bullets and checks
  check: unicode ? "✔" : "V",
  cross: unicode ? "✖" : "X",
  info: unicode ? "ℹ" : "i",
  bullet: unicode ? "●" : "*",
  circle: unicode ? "○" : "o",
};

