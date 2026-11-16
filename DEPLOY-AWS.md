# 搬到 AWS（前端託管）

## 結論

**可以只搬前端，程式不用改一行。** 原因：

1. 這個專案是純靜態 SPA（`npm run build` 產出 `dist/`），沒有任何後端程式碼。
2. 資料庫是瀏覽器**直連 Firebase Firestore**，跟網頁放在哪裡無關。
3. 我們沒有使用 Firebase Auth，所以連「授權網域」都不用設定。

也就是說：把 `dist/` 放到任何有 HTTPS 的地方，功能就完整了。

唯一要注意的是 **Vimeo 的允許嵌入網域**要改成新的公司網域（這正是搬家的目的）。

---

## 前置條件

| 項目 | 說明 |
| --- | --- |
| 公司網域 | 子網域即可，例如 `learn.example.com` |
| DNS 控制權 | 能新增 CNAME／A 紀錄（或由 IT 代為設定） |
| AWS 帳號 | 能建立 S3、CloudFront、ACM（或 Amplify） |
| 憑證 | CloudFront 用的憑證必須建在 **us-east-1**（維吉尼亞北部），這是 AWS 的硬規定 |

---

## 方案 A：AWS Amplify Hosting（不熟 AWS 建議這個）

特色：連 GitHub repo，push 就自動建置部署，自訂網域與 SSL 都由它處理，不用碰 S3 權限與 CloudFront 設定。

1. AWS Console → Amplify → **Host your web app** → GitHub
2. 授權 GitHub，選 `krad1985/buke-app`、分支 `master`
3. Build settings 會自動偵測 Vite，確認是：
   - Build command：`npm run build`
   - Output directory：`dist`
4. Deploy（第一次約 2–4 分鐘）
5. **Domain management** → Add domain → 輸入公司網域 → 依指示在 DNS 加 CNAME
6. 憑證由 Amplify 自動申請（不用自己去 ACM）

之後改版：`git push` 到 `master`，Amplify 自動重建並部署。

費用：小型內部系統大約每月 0–3 美元（建置分鐘數 + 流量）。

---

## 方案 B：S3 + CloudFront（公司資安要求較嚴時）

### 一次性設定

1. **S3 bucket**（例如 `buke-app-web`）
   - 區域建議 `ap-northeast-1`（東京）或 `ap-southeast-1`（新加坡）
   - **不要**開啟「靜態網站託管」：S3 網站端點只有 HTTP，沒有 HTTPS
   - 保持「封鎖所有公開存取」為開
2. **ACM 憑證**
   - 切換到 **us-east-1** 再申請，網域填 `learn.example.com`
   - 用 DNS 驗證，等狀態變為 Issued
3. **CloudFront distribution**
   - Origin：選上面的 S3 bucket，Origin access 選 **Origin access control (OAC)**，並依提示把 bucket policy 套用
   - Viewer protocol policy：**Redirect HTTP to HTTPS**
   - Default root object：`index.html`
   - Alternate domain name (CNAME)：`learn.example.com`
   - Custom SSL certificate：選 us-east-1 那張
   - 錯誤頁面（可選）：403/404 → `/index.html`、回應碼 200（目前用 hash 路由，其實不會用到）
4. **DNS**：在 Route 53（或公司 DNS）新增 CNAME 指向 CloudFront 網域，例如 `dxxxx.cloudfront.net`

### 每次改版

```bash
npm run deploy:aws
```

需要先設定兩個環境變數（PowerShell）：

```powershell
$env:S3_BUCKET="buke-app-web"
$env:CF_DIST_ID="E1234567890"
npm run deploy:aws
```

（cmd 用 `set S3_BUCKET=... && set CF_DIST_ID=... && npm run deploy:aws`）

這支腳本會：建置 → 同步 `dist/` 到 S3（`assets/` 長快取、`index.html` 不快取）→ 清 CloudFront 快取。需要先安裝並設定 AWS CLI（`aws configure`）。

手動版指令：

```bash
npm run build
aws s3 sync dist/ s3://buke-app-web --delete
aws cloudfront create-invalidation --distribution-id <DIST_ID> --paths "/*"
```

（`index.html` 一定要清快取；`assets/` 的檔名有 hash，可以長期快取。）

費用：每月約 1–3 美元（靜態檔案 + 少量流量）。

---

## 關於 Amplify 連結 GitHub

Amplify 連結 GitHub 用的是 **AWS Amplify GitHub App**，安裝時可以只授權指定 repo（Only select repositories），所以「多個指定 repo」技術上沒問題。

但有兩個現實問題：

1. **政策問題**：公司 AWS 去授權一個員工的個人 GitHub repo，多數公司不會核准（等於把部署權限綁在個人帳號上）。
2. **風險問題**：程式碼與部署流程都在個人帳號下，你離職或帳號被盜，公司就失去部署能力。

如果公司不讓連 GitHub，有三條路：

| 做法 | 說明 |
| --- | --- |
| **S3 + CloudFront（建議）** | 完全不需要 GitHub。本機或 IT 用 `npm run deploy:aws` 上傳，AWS 只看到一個 S3 bucket |
| Amplify 手動部署 | Amplify 支援「不使用 Git 供應商」的上傳方式（上傳建置好的 zip），不連結 GitHub，但每次改版要手動上傳 |
| 把 repo 搬到公司組織 | 長解。GitHub 支援轉移 repo 並保留歷史，之後 Amplify／CI 都能正常接 |

以你們的狀況（個人 repo + 公司 AWS），我會直接走 **S3 + CloudFront**：設定一次，之後每次改版一行指令，不牽涉任何帳號授權。



| 方案 | 為什麼不適合 |
| --- | --- |
| EC2 / Lightsail | 為了放幾個靜態檔開一台伺服器，要自己管 OS、憑證、更新 |
| Elastic Beanstalk | 那是給有後端程式的應用，這個專案沒有 |
| S3 靜態網站託管（不配 CloudFront） | 只有 HTTP，瀏覽器會標「不安全」 |

---

## 搬完要做的驗證

1. 首頁載入（`https://learn.example.com/`）
2. 學員登入（學員代碼或手機）→ 課程列表出現
3. 進入課程 → 影片播放 → 段落跳轉 → 答題
4. 後台 `/#/admin` 登入 → 課程列表 → 學員名單
5. **Vimeo**：把 `learn.example.com` 加入 Vimeo 的「可嵌入何處」，再測一次 Vimeo 課程

第 5 點是這次搬家的主因，記得同步做，否則 Vimeo 課仍然不能播。

---

## 需要注意的地方

1. **不要改 `vite.config.ts` 的 `base: './'`**。相對路徑讓它在網域根目錄或子目錄都能跑。
2. **路由是 hash（`/#/c/...`）**，所以不需要設定 SPA fallback；重新整理不會 404。
3. **`index.html` 不要快取太久**，否則改版後使用者會看到舊版。Amplify 自動處理；S3+CloudFront 要靠 invalidation。
4. **換網域後，GitHub Pages 那份仍然存在**，只是 Vimeo 課程在那邊會失效（網域沒被允許）。要嘛保留當備援（只放 YouTube 課），要嘛把 repo 的 Pages 關掉。
5. **Firestore 規則不用改**，跟主機無關。
6. 前端打包裡有 Firebase 的 `apiKey`，那是公開設定、不是機密；能保護資料的只有規則（目前是防君子全開）。

---

## 需要我協助的部分

- 我可以把「S3 + CloudFront」的部署指令包成 `npm run deploy:aws`（需要你提供 bucket 名稱與 distribution id）
- Amplify 走的是 GitHub 自動部署，不需要我改任何東西
- 搬完若 Vimeo 還是不播，把網域給我，我再確認一次嵌入設定
