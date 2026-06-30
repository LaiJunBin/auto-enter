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

if (finalRepo.startsWith("__") || finalVersion.startsWith("__")) {
    try {
        const pkg = require('./package.json');
        finalRepo = pkg.repository ? pkg.repository.url.replace('git+https://github.com/', '').replace('.git', '') : "LaiJunBin/auto-enter";
        finalVersion = `v${pkg.version}`;
    } catch (e) {
        finalRepo = "LaiJunBin/auto-enter";
        finalVersion = "v1.0.0";
    }
}

// 2. 判斷作業系統
// 2. 判斷作業系統與 CPU 架構
let binaryName = '';
const platform = process.platform;
const arch = process.arch; // ✨ 核心：獲取當前硬體架構 ('arm64' 或 'x64')

if (platform === 'win32') {
    binaryName = 'auto-enter-win.exe';
} else if (platform === 'linux') {
    binaryName = 'auto-enter-linux';
} else if (platform === 'darwin') {
    // 🍏 macOS 專屬：根據 CPU 架構動態分流下載不同的執行檔
    if (arch === 'arm64') {
        binaryName = 'auto-enter-mac-arm64'; // M1/M2/M3/M4 系列 Mac
    } else if (arch === 'x64') {
        binaryName = 'auto-enter-mac-x64';   // Intel 晶片 Mac
    } else {
        console.error(`【錯誤】不支援的 Mac 架構: ${arch}`);
        process.exit(1);
    }
} else {
    console.error(`【錯誤】不支援的作業系統: ${platform}`);
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
            process.exit(1);
        }

        const file = fs.createWriteStream(dest);
        res.pipe(file);

        // ❌ 原本是 file.on('finish', ...)
        // 🟢 改用 file.on('close', ...) 確保 Windows 核心完全釋放檔案鎖
        file.on('close', () => {
            if (process.platform !== 'win32') {
                fs.chmodSync(dest, '755');
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