const fs = require('fs');
const path = require('path');

const excludeDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'out', 'coverage', '.vscode'];
const includeExts = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.html'];
const rootDir = process.cwd();
const outputFile = path.join(rootDir, 'codebase.md');

let outputContent = '# Revana Technologies Codebase\n\nThis document contains the entire source code of the Revana Technologies project.\n\n';

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            if (!excludeDirs.includes(file)) {
                walkDir(filePath);
            }
        } else {
            const ext = path.extname(file);
            if (includeExts.includes(ext) && file !== 'package-lock.json' && file !== 'codebase.md') {
                try {
                    const content = fs.readFileSync(filePath, 'utf8');
                    const relativePath = path.relative(rootDir, filePath).replace(/\\/g, '/');
                    outputContent += `## File: ${relativePath}\n\n`;
                    outputContent += '```' + ext.substring(1) + '\n';
                    outputContent += content;
                    outputContent += '\n```\n\n';
                } catch (e) {
                    console.error(`Error reading ${filePath}:`, e);
                }
            }
        }
    }
}

walkDir(rootDir);
fs.writeFileSync(outputFile, outputContent);
console.log('Successfully generated codebase.md');
