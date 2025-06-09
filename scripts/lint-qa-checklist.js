const fs = require('fs');
const path = require('path');

const checklistPath = path.join(__dirname, '../QA_CHECKLIST.md');
const content = fs.readFileSync(checklistPath, 'utf8');
const unchecked = content.match(/- \[ \]/g);
if (unchecked && unchecked.length > 0) {
  console.warn(`\n⚠️  There are ${unchecked.length} unchecked QA items in QA_CHECKLIST.md!`);
  process.exit(1);
} else {
  console.log('✅ All QA checklist items are checked!');
  process.exit(0);
} 