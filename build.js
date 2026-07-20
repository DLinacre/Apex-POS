const fs = require('fs');
const path = require('path');

const srcDir = __dirname;
const destDir = path.join(__dirname, 'www');

// List of files and folders to copy
const filesToCopy = [
    'index.html',
    'app.js',
    'db.js',
    'styles.css',
    'tailwind-compiled.css',
    'manifest.json',
    'sw.js',
    '404.html',
    'privacy.html',
    'robots.txt',
    'sitemap.xml'
];

const dirsToCopy = [
    'assets'
];

// Clean destDir
if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true, force: true });
}
fs.mkdirSync(destDir);

// Copy files
filesToCopy.forEach(file => {
    const src = path.join(srcDir, file);
    const dest = path.join(destDir, file);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
    }
});

// Copy dirs
dirsToCopy.forEach(dir => {
    const src = path.join(srcDir, dir);
    const dest = path.join(destDir, dir);
    if (fs.existsSync(src)) {
        copyFolderSync(src, dest);
    }
});

function copyFolderSync(from, to) {
    fs.mkdirSync(to, { recursive: true });
    fs.readdirSync(from).forEach(element => {
        if (fs.lstatSync(path.join(from, element)).isDirectory()) {
            copyFolderSync(path.join(from, element), path.join(to, element));
        } else {
            fs.copyFileSync(path.join(from, element), path.join(to, element));
        }
    });
}

console.log('Build completed! Files copied to www/');
