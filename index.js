#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

// =================================================================
// 佔位符：這些欄位會在 GitHub Actions CI/CD 流程中被動態替換
// =================================================================
const REPO = "__GITHUB_REPO__";       
const VERSION = "__RELEASE_VERSION__"; 
// =================================================================

const args = process.argv.slice(2);

// 1. 安全防護：如果是本地直接執行未替換的 index.js，嘗試動態去抓 package.json 作為備援
let finalRepo = REPO;
let finalVersion = VERSION;

if (REPO === "__GITHUB_REPO__" || VERSION === "__RELEASE_VERSION__") {
    try {
        const pkg = require('./package.json');
        // 預設你的 GitHub 帳號，或者從 repository 欄位解析
        finalRepo = pkg.repository ? pkg.repository.replace('github:', '') : "lai.junbin/auto-enter";
        finalVersion = `v${pkg.version}`;
    } catch (e) {
        // 如果連 package.json 也沒有，給予預設開發提示
        finalRepo = "lai.junbin/auto-enter";
        finalVersion = "v1.0.0";
    }
}

// 2. 判斷作業系統
let binaryName = '';
if (process.platform === 'win32') binaryName = 'auto-enter-win.exe';
else if (process.platform === 'darwin') binaryName = 'auto-enter-mac';
else if (process.platform === 'linux') binaryName = 'auto-enter-linux';
else {
    console.error("【錯誤】不支援的作業系統。");
    process.exit(1);
}

const localBinaryDir = path.join(__dirname, 'bin');
const localBinaryPath = path.join(localBinaryDir, binaryName);

if (!fs.existsSync(localBinaryDir)) {
    fs.mkdirSync(localBinaryDir, { recursive: true });
}

// 下載二進位檔 (處理 GitHub Redirects)
function downloadBinary(url, dest, callback) {
    https.get(url, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
            downloadBinary(res.headers.location, dest, callback);
            return;
        }
        if (res.statusCode !== 200) {
            console.error(`【錯誤】無法從 GitHub Release 下載執行引擎 (Status: ${res.statusCode})`);
            console.error(`[網址]: ${url}`);
            process.exit(1);
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => {
            file.close();
            if (process.platform !== 'win32') {
                fs.chmodSync(dest, '755'); // 賦予 Mac/Linux 執行權限
            }
            callback();
        });
    });
}

function runBinary() {
    const child = spawn(localBinaryPath, args, { stdio: 'inherit' });
    child.on('close', (code) => process.exit(code));
}

// 主流程
if (fs.existsSync(localBinaryPath)) {
    runBinary();
} else {
    console.log(`[*] 偵測到新環境，正在從 GitHub 獲取最新引擎 (${binaryName}) [${finalVersion}]...`);
    const downloadUrl = `https://github.com/${finalRepo}/releases/download/${finalVersion}/${binaryName}`;
    downloadBinary(downloadUrl, localBinaryPath, () => {
        console.log("[*] 引擎準備就緒！");
        runBinary();
    });
}