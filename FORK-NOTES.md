# FORK NOTES — Quản lý fork tiếng Việt của Management Center

> Fork này thêm **tiếng Việt** (và sau này là các tính năng riêng) cho
> [Cli-Proxy-API-Management-Center](https://github.com/router-for-me/Cli-Proxy-API-Management-Center).
> **Backend (CLIProxyAPI) KHÔNG fork** — vẫn chạy 100% bản chính thức.

## Cấu trúc

```
main                      = upstream/main + tiếng Việt + tính năng riêng
.github/workflows/
  sync-upstream.yml       cron hàng ngày: merge upstream/main về, rồi chạy
                          scripts/sync-vi-keys.mjs để vi.json bám cấu trúc
                          en.json (key upstream thêm -> giữ tiếng Anh tạm;
                          key upstream xóa -> xóa khỏi vi). Xung đột không
                          tự phá được -> mở Issue.
  release.yml             mỗi khi main có commit: build dist/index.html ->
                          management.html -> tạo GitHub Release kèm asset.
scripts/sync-vi-keys.mjs  script đồng bộ cấu trúc vi.json theo en.json.
```

## Cách server nhận bản build

`config.yaml` của CLIProxyAPI trên tiny-server trỏ về fork:

```yaml
remote-management:
  panel-github-repository: "https://github.com/nguyenha935/Cli-Proxy-API-Management-Center"
```

Auto-updater gốc của CLIProxyAPI (mỗi 3h) sẽ:
1. Đọc release mới nhất của fork này
2. Tải asset `management.html`, kiểm tra digest
3. Ghi đè `~/cliproxyapi/static/management.html`

→ Tính năng UI mới của upstream tự về fork (qua sync-upstream), rồi tự
build + phát hành (qua release.yml), rồi tự được server kéo. Vòng kín.

## Quy ước khi thêm tính năng riêng

1. **en.json là nguồn sự thật về key.** Key mới của riêng fork cũng phải
   thêm vào en.json, nếu không `sync-vi-keys.mjs` sẽ dọn mất khỏi vi.json.
2. Thêm key dịch vào vi.json ngay nếu được; không thì để sync tự copy
   tiếng Anh (fallback của vi đã cấu hình là `en`, xem `src/i18n/index.ts`).
3. Xung đột merge với upstream: ưu tiên giữ tính năng upstream, phần riêng
   ghép lại sau — CI sẽ mở Issue nếu không tự merge được.

## Khi PR tiếng Việt được upstream merge

PR đóng góp: https://github.com/router-for-me/Cli-Proxy-API-Management-Center/pull/382

Nếu upstream merge bản dịch này:
1. Đợi sync-upstream kéo về (hoặc chạy tay).
2. Xóa dòng `panel-github-repository` trong config.yaml của server (hoặc
   trả về repo gốc) → server quay về dùng panel chính thức.
3. Nếu fork không còn tính năng riêng nào khác, dừng dùng fork.

## Lịch sử

- 2026-08-16: Tạo fork. Dịch đủ 1540 key từ en.json. Fallback của vi đặt
  là en (key chưa dịch hiện tiếng Anh, không hiện tiếng Trung). Đã deploy
  test trên tiny-server (~/cliproxyapi/static/management.html) thành công.
