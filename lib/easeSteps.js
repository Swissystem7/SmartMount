function easeSteps(current, target, n) {
  if (n < 1) return [];
  const out = [];
  for (let i = 1; i <= n; i++) {
    const v = current + (target - current) * (1 - Math.cos(Math.PI * i / n)) / 2;
    out.push(Math.round(v * 10) / 10);
  }
  return out;
}

module.exports = { easeSteps };
