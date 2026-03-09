const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from public/
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`\n🎲 OSRS Game of Goose running!`);
  console.log(`   Board view:  http://localhost:${PORT}`);
  console.log(`   Admin panel: http://localhost:${PORT}/admin.html\n`);
});
