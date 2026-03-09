// Simple debug script to test StatusBar component behavior

console.log('StatusBar debug test');

// Test the display tier logic directly
function getDisplayTier(terminalWidth) {
  return terminalWidth < 60 ? 'narrow' :
         terminalWidth <= 160 ? 'normal' : 'wide';
}

console.log('Display tier for width 180:', getDisplayTier(180));
console.log('Display tier for width 120:', getDisplayTier(120));
console.log('Display tier for width 59:', getDisplayTier(59));
console.log('Display tier for width 60:', getDisplayTier(60));
console.log('Display tier for width 160:', getDisplayTier(160));
console.log('Display tier for width 161:', getDisplayTier(161));

// Test priority filtering
const PRIORITY_BY_TIER = {
  narrow: ['critical', 'high'],
  normal: ['critical', 'high', 'medium'],
  wide: ['critical', 'high', 'medium', 'low'],
};

console.log('Allowed priorities for wide:', PRIORITY_BY_TIER.wide);
console.log('Session name priority should be "low" and should be allowed in wide mode');