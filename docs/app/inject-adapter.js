const fs = require('fs');
const path = require('path');

const testsDir = path.join(__dirname, 'docs', 'app', 'tests');

function injectAdapter(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            injectAdapter(fullPath);
        } else if (file === 'index.html') {
            let content = fs.readFileSync(fullPath, 'utf8');
            // Usuwamy stary tag jesli uzytkownik wzdrygal sie sam
            content = content.replace(/<script src="\.\.\/\.\.\/web-adapter\.js"><\/script>\n?/g, '');
            // Dodajemy przed </head>
            if (content.includes('</head>')) {
                content = content.replace('</head>', '  <script src="../../web-adapter.js"></script>\n</head>');
                fs.writeFileSync(fullPath, content);
                console.log(`Zintegrowano WebAdapter w: ${fullPath}`);
            }
        }
    }
}

injectAdapter(testsDir);
console.log('Gotowe!');
