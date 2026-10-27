# 補課系統（buke-app）

影片分段＋段落檢核的補課系統。學員看完一段影片、答對題目才解鎖下一段；名單分區匯入，補課記錄依區域匯出。

- 前端：Vite + React 18 + TypeScript
- 影片：YouTube 內嵌（需為「公開」或「不公開」）
- 資料庫：Firebase Firestore + Firebase Auth
- 部署：GitHub Pages（`npm run deploy`）

## 部署到 GitHub Pages

```bash
npm run build     # 產出 dist/
npm run deploy    # 把 dist 推到 gh-pages 分支
```

第一次部署：

1. `git remote add origin https://github.com/<帳號>/<repo>.git`
2. `git push -u origin master`
3. `npm run deploy`
4. repo → Settings → Pages → Source 選 `gh-pages` 分支
5. 網址：`https://<帳號>.github.io/<repo>/`
6. 把這個網域加進 Firebase → Authentication → Settings → 已授權網域

之後每次改版只要 `npm run deploy`。因為用 hash 路由（`/#/c/...`），重整頁面不會 404，不需要 404.html 轉址。

## 補課時數

時數 = **已通過段落的影片長度加總**，不是實際播放秒數（重看、暫停不會重複累計）。

- 學員端：課程卡片與課程頁標題下方會顯示「已補 X 小時 Y 分」，完課畫面顯示累計時數。
- 報表：補課總表多一欄「已補時數(分)」。
- 舊資料沒有 `watchedSec` 時，會用 `passed` 對照目前段落長度即時換算。
- 注意：段落時間碼日後若調整，已記錄的時數不會回溯改變（匯入當下的值會被保存）。

## 三種身分

| 身分 | 登入方式 | 權限 |
| --- | --- | --- |
| 學員 | 輸入手機號碼（匿名登入底層） | 上課、看自己的進度 |
| 課程管理員 | 帳號＋密碼 | 課程與題庫、管理員帳號、任何區域的名單與記錄 |
| 區域管理員 | 帳號＋密碼 | 只能匯入自己區域的名單、匯出自己區域的記錄 |

管理員帳號全部由**課程管理員在後台建立**，不需要進 Firebase Console 建帳號。
唯一的例外是第一次的「設定管理密碼」：開 `/#/admin` 按「第一次使用？設定管理密碼」，預設帳號是 `admin`。

## 第一次上線（Firebase Console，共四步）

1. **Authentication → 開始使用**：啟用「匿名」與「電子郵件/密碼」兩種登入方式。
2. **Firestore Database → 建立資料庫**（正式模式，選近的地區）。
3. **Firestore → 規則**：貼上 `firestore.rules` 全文並發布。
4. **Authentication → Settings → 已授權網域**：加入 GitHub Pages 網域（`localhost` 預設允許）。

完成後開 `/#/admin`：

1. 按「第一次使用？設定管理密碼」，設定 `admin` 的密碼。
2. 進「課程管理」建立課程（或載入示範課程）。
3. 進「管理員」建立區域管理員，把帳號密碼交給對方。

> 首次設定前，任何開到網站的人都能搶先設定 `admin` 密碼。請在部署後立刻完成。

## 開發

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run deploy
```

路由（hash）：

```
/                 學員首頁（未輸入電話會先跳到電話頁）
/#/c/<courseId>   上課畫面
/#/admin          管理後台
```

QA：網址加 `?qa=1` 會多一顆「跳結尾」按鈕。

## 資料結構

```
courses/{courseId}                              課程（含段落與題目）
admins/{uid}                                    管理員（uid = Firebase Auth uid）
accounts/{account}                              帳號 → 登入信箱對照（無密碼）
phones/{phoneKey}                               電話 → 區域索引（只能單筆查，不能列舉）
regions/{region}                                區域
regions/{region}/students/{phoneKey}            學員名單
regions/{region}/students/{phoneKey}/progress/{courseId}   補課進度
```

**為什麼用路徑分區而不是欄位過濾**：Firestore 規則只能檢查路徑，不能檢查查詢條件。名單放在區域路徑下，規則才能寫死「區域管理員只能碰自己的區」；如果只靠 `region` 欄位，規則無法阻止甲區把乙區整批撈走。

進度不開放 collection-group 查詢，避免一次匯出全庫；報表改為逐位學員讀取。

## 匯入名單

區域是固定清單，不能自由輸入（避免 `臺南`／`台南` 變成兩個區）：

```
北區　桃區　竹區　中區　園區　嘉區　南區　高區　國際
```

「學員名單」頁選好區域後，按**「下載空白範本」**會得到一個帶表頭的 CSV：

```
uid,區域,教室,組別,身份,姓名,電話
```

填好後可以：直接複製整塊貼到文字框，或另存 CSV 用「選擇檔案」。規則：

- 有表頭會自動對應欄位名稱；沒有表頭則照上面的順序。
- 電話只留數字，`+886` 會轉成 `0` 開頭；格式不對的列會列出來，不會匯入。
- 區域欄可留空，一律以頁面上選的區域為準；填了不同區域會提示，但仍以頁面選的為準。
- 同一支電話重複匯入＝覆蓋舊資料（要改某位學員的資料就重匯那一列）。

## 匯出補課記錄

「補課記錄」頁選區域 → 按「讀取」→「匯出 CSV」。格式是**一人一列、各課程一欄**的總表：

```
區域, uid, 教室, 組別, 身份, 姓名, 電話,
<課程A>, <課程B>, <課程C>, …, 完課數, 最後更新
```

課程欄的寫法：`✓` 表示該課已完課，`3/5` 表示已通過 3 段（共 5 段），空白表示沒有紀錄。可以勾「只列有紀錄的學員」。檔案帶 BOM，Excel 直接開不會亂碼。

## 安全模型（方便性 > 安全性）

- 課程：公開可讀（題目與正解都在裡面），只有管理員可寫。
- 名單：知道「區域＋電話」才能取得單筆；`list` 只開放給管理員，無法整批列舉。
- 進度：寫入端不做伺服器端身分驗證，知道路徑的人可以寫。這是為了讓匿名學員能記錄進度所做的取捨。
- 管理員密碼由 Firebase Auth 驗證，規則依 `admins/{uid}` 的 role/region 決定權限，不是前端假裝。

## 已知限制

1. 忘記密碼：區域管理員由課程管理員在「管理員」頁重設；`admin` 自己忘記要去 Firebase Console 重設（沒有更高一層可救）。
2. 進度報表是逐位學員讀取，一區數百人時會慢一點（會分批並行）。
3. 同一個電話只能對應一位學員（例如家長共用門號需另外處理）。
4. 影片若要「只聽不看」或更嚴格的跳轉限制，需改自架 HLS，YouTube 來源做不到。

`src/data/mockCourses.ts` 只作為「載入示範課程」的種子資料。
