const fs = require('fs');
const path = 'src/lib/email.ts';
let content = fs.readFileSync(path, 'utf8');

// Fix 1: Fix broken sendOrderStatusEmail - replace backtick with );
// Look for the pattern: `  `;` followed by blank line + /** Build per-template...
// We need to find the broken line and fix it
const brokenPattern = /\n  `;\n\n  \/\*\n   \* Build per-template email body HTML/;
const match = content.match(brokenPattern);
if (match) {
  console.log('Found broken pattern at index:', match.index);
  content = content.replace(brokenPattern, '\n  });\n\n  /**\n   * Build per-template email body HTML');
  console.log('Fixed broken sendOrderStatusEmail closing');
} else {
  console.log('Broken pattern not found, trying alternative...');
  // Try alternative pattern
  const altPattern = /`;\n\n  \/\*\n   \* Build per-template/;
  const altMatch = content.match(altPattern);
  if (altMatch) {
    console.log('Found alt pattern');
    content = content.replace(altPattern, '});\n\n  /**\n   * Build per-template');
  }
}

// Fix 2: Remove duplicate buildTemplateBody (my version) that's now orphaned
// The original buildTemplateBody is at lines ~289-427
// My duplicate was inserted inside sendOrderStatusEmail but now that's fixed
// We need to find and remove my duplicate
// My duplicate starts with: /**\n   * Build per-template email body HTML\n   */\n  function buildTemplateBody(
// And ends with: return baseTemplate(buildTemplateBody(template, data));\n}\n\n/**\n * Send order status update email

// Actually, after fix 1, the duplicate buildTemplateBody is now at top level
// and will conflict with the original. Let's find and remove it.
// The duplicate starts after the fixed sendOrderStatusEmail closing

fs.writeFileSync(path, content, 'utf8');
console.log('Done!');