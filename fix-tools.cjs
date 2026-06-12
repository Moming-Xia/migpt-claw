const fs = require('fs');
const path = require('path');

const files = [
  'D:/Code/migpt-claw/skills/migpt-smart-home/index.ts',
  'D:/Code/migpt-claw/skills/migpt-speaker-control/index.ts',
  'D:/Code/migpt-claw/index.ts'
];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const updated = content.replaceAll('parameters', 'parameters');
  fs.writeFileSync(file, updated, 'utf8');
  console.log('Updated:', file, '- was replaced:', content !== updated);
}
