import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const packagesRoot = path.resolve('packages');
const remakePkgPath = path.join(packagesRoot, 'robloxstudio-mcp-remake', 'package.json');

function run(cmd, cwd = process.cwd()) {
    console.log(`> ${cmd} (in ${cwd})`);
    execSync(cmd, { stdio: 'inherit', cwd });
}

try {
    // 1. Build core
    console.log('Building @robloxstudio-mcp/core...');
    run('npm run build', path.join(packagesRoot, 'core'));

    // 2. Build remake package
    console.log('Building robloxstudio-mcp-remake...');
    run('npm run build', path.join(packagesRoot, 'robloxstudio-mcp-remake'));

    // 3. Bump patch version
    console.log('Bumping version in robloxstudio-mcp-remake...');
    const pkg = JSON.parse(fs.readFileSync(remakePkgPath, 'utf8'));
    const versionParts = pkg.version.split('.').map(Number);
    versionParts[2] += 1;
    pkg.version = versionParts.join('.');
    fs.writeFileSync(remakePkgPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`New version: ${pkg.version}`);

    // 4. Publish
    console.log('Publishing to NPM...');
    run('npm publish', path.join(packagesRoot, 'robloxstudio-mcp-remake'));

    console.log('Successfully published robloxstudio-mcp-remake!');
} catch (error) {
    console.error('Publishing failed:', error.message);
    process.exit(1);
}
