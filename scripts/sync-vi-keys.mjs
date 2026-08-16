#!/usr/bin/env node
/**
 * sync-vi-keys.mjs
 *
 * Giữ vi.json đồng bộ cấu trúc với en.json (nguồn sự thật về key):
 *  - Key có trong en.json mà thiếu trong vi.json  -> thêm vào, copy tạm
 *    nội dung tiếng Anh (fallback của vi cũng là en nên hiển thị vẫn đúng,
 *    chờ dịch sau).
 *  - Key có trong vi.json mà upstream đã xóa      -> xóa khỏi vi.json.
 *
 * en.json luôn là chuẩn cấu trúc: mọi key riêng của fork (ví dụ
 * language.vietnamese) cũng phải tồn tại trong en.json để không bị
 * script này dọn mất khi đồng bộ.
 *
 * Chạy từ thư mục gốc của repo:  node scripts/sync-vi-keys.mjs
 * Output: JSON { added, removed } để CI đọc.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const enPath = path.join(root, 'src', 'i18n', 'locales', 'en.json');
const viPath = path.join(root, 'src', 'i18n', 'locales', 'vi.json');

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const vi = JSON.parse(fs.readFileSync(viPath, 'utf8'));

let added = 0;
let removed = 0;

const sync = (target, source) => {
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object') {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      sync(target[key], value);
    } else if (!(key in target)) {
      // Chưa kịp dịch: giữ nguyên tiếng Anh để UI vẫn đọc được.
      target[key] = value;
      added += 1;
    }
  }
  for (const key of Object.keys(target)) {
    if (!(key in source)) {
      delete target[key];
      removed += 1;
    }
  }
};

sync(vi, en);

fs.writeFileSync(viPath, `${JSON.stringify(vi, null, 2)}\n`);
console.log(JSON.stringify({ added, removed }));
