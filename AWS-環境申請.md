# AWS 環境申請（給 IT／雲端架構團隊）

## 【專案需求】純前端靜態網站（SPA）AWS 託管環境

### 1. 系統架構與技術型態

- **應用類型**：純前端單頁應用程式（Static SPA），建置產物只有 HTML / CSS / JS / 字型與圖片等靜態資源。
- **後端與資料庫**：本系統**沒有**自建後端。無需 EC2、ECS、Lambda、RDS 或 API Gateway。
- **資料來源**：瀏覽器直接連線 **Google Firebase Firestore**（既有服務，非本次申請範圍）。
- **身分驗證**：無。沒有 Cognito、沒有 OAuth、沒有伺服器端 session。
- **機密管理**：無。前端不含任何伺服器端金鑰或 secrets。

> **請注意**：學員姓名、手機、學習進度等資料儲存於 **Firebase（Google Cloud）**，不在 AWS。
> 若公司對個資存放地有規範，請一併由資安／法務確認（本申請僅涵蓋網站託管）。

### 2. 所需 AWS 資源

| 資源 | 設定 |
| --- | --- |
| **Amazon S3** | 1 個私有 bucket 存放建置產物；開啟 Block all public access |
| **Amazon CloudFront** | 1 個 distribution，以 **OAC** 讀取上述 bucket（不使用公開 bucket、不使用舊式 OAI） |
| **AWS Certificate Manager** | 憑證必須建立於 **us-east-1**（CloudFront 的硬性要求） |
| **Route 53／公司 DNS** | 子網域指向 CloudFront（例：`learn.<公司網域>`） |
| **AWS WAF**（選配） | 依公司規範掛載既有規則 |

**不需要**：S3 靜態網站託管功能（該端點只有 HTTP，無 HTTPS）。

#### 路由說明（與一般 SPA 不同，請勿套用通用設定）

本系統使用 **hash 路由**（網址形如 `/#/c/<courseId>`），路徑不會送到伺服器，因此：

- **不需要**設定 CloudFront Custom Error Responses 將 403/404 導向 `index.html`。
- 若設定該規則，反而會把「資產 404」或「OAC 設定錯誤的 403」都變成 200 首頁，導致問題難以排查。

（若未來改用 History 路由，再另行申請調整。）

#### 快取策略（必要）

| 路徑 | Cache-Control |
| --- | --- |
| `/index.html` | `no-cache, no-store, must-revalidate` |
| `/assets/*`（檔名含 hash） | `public, max-age=31536000, immutable` |

若 `index.html` 被 CDN 長快取，改版後使用者會停留在舊版。

### 3. 網域與資安

- **HTTPS**：強制（CloudFront 設定 Redirect HTTP to HTTPS）。
- **建議回應標頭**：HSTS、`X-Content-Type-Options: nosniff`（可用 CloudFront Response Headers Policy）。
- **WAF**：若為對外服務，建議掛載公司既有規則；純內部使用可略。

### 4. 對外連線需求（重要）

網站會在瀏覽器端載入以下外部網域；若公司有 egress 代理、CSP 或防火牆白名單，請一併放行：

| 用途 | 網域 |
| --- | --- |
| 資料庫 | `firestore.googleapis.com`（`*.googleapis.com`） |
| 字型 | `fonts.googleapis.com`、`fonts.gstatic.com` |
| 影片（YouTube） | `www.youtube.com`（iframe API 與嵌入） |
| 影片（Vimeo） | `player.vimeo.com`、`i.vimeocdn.com` |

若公司要求 CSP，需要允許上述來源的 `script-src`、`frame-src`、`connect-src`、`font-src`。

### 5. 部署與權限交付

**現況說明（請據此設計權限）**：程式碼目前位於開發者的個人 GitHub repo，公司不建議連結。
因此短期採 **手動本機部署**（開發者建置後上傳），**不是 CI/CD 自動化流程**。

需要的 IAM 權限（建議以單一 deployment user／role，範圍限縮到指定資源）：

```
s3:ListBucket            # aws s3 sync 需要列舉 bucket 內容
s3:PutObject
s3:DeleteObject
cloudfront:CreateInvalidation
cloudfront:GetInvalidation
```

資源範圍：

- S3：僅限該 bucket（`arn:aws:s3:::buke-app-web` 與 `arn:aws:s3:::buke-app-web/*`）
- CloudFront：僅限該 distribution ARN

不需要 Console 操作權限。

**中長期建議**：將 repo 轉移至公司 GitHub 組織，之後可改為 GitHub Actions + OIDC（免長期金鑰）自動部署。

### 6. 費用預估

靜態檔案 + 少量流量（每月數 GB 以內）：**約 USD 1–3／月**（S3 儲存 + CloudFront 流量 + invalidation）。
WAF 另計（約 USD 5–10／月起）。

### 7. 驗收項目

1. `https://learn.<公司網域>/` 可開啟，HTTPS 正常
2. 課程列表載入（代表 Firestore 連線成功）
3. 進入課程 → 影片播放 → 段落跳轉 → 答題
4. `/#/admin` 後台登入
5. Vimeo 課程可播放（需同時在 Vimeo 後台將此網域加入允許清單）

### 8. 交付清單

- [ ] S3 bucket 名稱
- [ ] CloudFront distribution ID 與網域
- [ ] 子網域與 DNS 設定完成
- [ ] ACM 憑證狀態 Issued（us-east-1）
- [ ] deployment 憑證（access key 或 SSO profile）
- [ ] 是否掛載 WAF、是否啟用 access log
