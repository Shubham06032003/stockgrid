import fs from 'fs';

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  return parseInt(hex.slice(0,2), 16) + ' ' + parseInt(hex.slice(2,4), 16) + ' ' + parseInt(hex.slice(4,6), 16);
}

// 1. Fix index.css
let css = fs.readFileSync('src/index.css', 'utf-8');
css = css.replace(/#([0-9a-fA-F]{3,6})/g, (match) => {
  return hexToRgb(match);
});
css = css.replace(/background-color: var\(--color-background\);/g, 'background-color: rgb(var(--color-background));');
css = css.replace(/color: var\(--color-on-surface\);/g, 'color: rgb(var(--color-on-surface));');
fs.writeFileSync('src/index.css', css);

// 2. Fix tailwind.config.js
let tw = fs.readFileSync('tailwind.config.js', 'utf-8');
tw = tw.replace(/'var\(--color-([a-zA-Z0-9-]+)\)'/g, (match, p1) => {
  return "'rgb(var(--color-" + p1 + ") / <alpha-value>)'";
});

fs.writeFileSync('tailwind.config.js', tw);
