const fs = require('fs');
const path = require('path');

const testsDir = path.join(__dirname, 'docs', 'app', 'tests');

const PATCH_SNIPPET = `
// Nous: patch sendResults byuc dołączania wszystkich pól expInfo (participant, session, date ...)
(function() {
    if (typeof window.electronTest !== 'undefined' && window.electronTest.sendResults) {
        var _orig = window.electronTest.sendResults;
        window.electronTest.sendResults = function(data) {
            return _orig(Object.assign({}, typeof expInfo !== 'undefined' ? expInfo : {}, data));
        };
    }
})();
`;

function injectAdapter(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            injectAdapter(fullPath);
        } else if (file === 'index.html') {
            let content = fs.readFileSync(fullPath, 'utf8');
            content = content.replace(/<script src="\.\.\/\.\.\/web-adapter\.js"><\/script>\n?/g, '');
            if (content.includes('</head>')) {
                content = content.replace('</head>', '  <script src="../../web-adapter.js"></script>\n</head>');
                fs.writeFileSync(fullPath, content);
                console.log(`Zintegrowano WebAdapter w: ${fullPath}`);
            }
        }
    }
}

function patchSendResults(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            patchSendResults(fullPath);
        } else if (file.endsWith('.js')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('window.electronTest.sendResults') && !content.includes('// Nous: patch sendResults')) {
                content += '\n' + PATCH_SNIPPET;
                fs.writeFileSync(fullPath, content);
                console.log(`Zaaplikowano patch expInfo w: ${fullPath}`);
            }
        }
    }
}

injectAdapter(testsDir);
patchSendResults(testsDir);
console.log('Gotowe!');
