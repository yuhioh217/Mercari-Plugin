# Mercari 正版陀螺台灣可買搜尋助手

這是一個 Tempermonkey userscript。打開 Mercari 時，它會自動導向「最新上架、尚未售完」的 Beyblade / 陀螺搜尋頁，並把看起來像正版、價格相對原價沒有溢價太多的商品用綠框標出來。

## 功能

- 自動搜尋最新上架商品：
  `status=on_sale&sort=created_time&order=desc`
- 預設搜尋關鍵字：`ベイブレードX タカラトミー`
- 用綠框標示候選商品。
- 排除常見風險字，例如仿品、非正規、故障、破損、零件-only、已售出等。
- 可以在右下角面板調整「原價基準」和「最高溢價倍率」。
- 可選擇隱藏疑似不符合的商品。
- 可選擇發現候選商品時跳出桌面通知。

## 安裝

1. 安裝瀏覽器擴充功能 Tempermonkey。
2. 在 GitHub 打開 `mercari-beyblade-tw-finder.user.js` 的 Raw 頁面。
3. Tempermonkey 會跳出安裝畫面，按 Install。
4. 前往 `https://jp.mercari.com/` 或 `https://gl.mercari.com/`。

## 建議設定

依照你正在找的商品類型，在右下角面板調整「原價基準 JPY」：

| 商品類型 | 原價基準 |
| --- | ---: |
| Booster | 1400-1600 JPY |
| Starter | 1980-2200 JPY |
| Set / deck set | 3300-4000 JPY |
| Stadium / battle set | 2750-7000 JPY |

範例：如果 Starter 原價約 `1980 JPY`，你最多接受 35% 溢價：

- 原價基準：`1980`
- 最高倍率：`1.35`
- 候選商品最高價：約 `2673 JPY`

## 注意

Mercari 搜尋列表通常無法穩定顯示每件商品是否真的能跨境寄到台灣。這個腳本會先幫你縮小到「未售出 + 最新上架 + 價格合理 + 看起來是正版」的候選清單，但能不能寄台灣仍要以商品頁或結帳頁顯示為準。

如果漏掉你想看的商品，可以把搜尋關鍵字放寬，例如：

- `ベイブレードX`
- `ベイブレード タカラトミー`
- `BEYBLADE X`

## 發佈到 GitHub 前

建議修改 userscript metadata 裡的這幾行：

```js
// @namespace    https://github.com/your-name/mercari-beyblade-tw-finder
// @author       Kyle
```

主檔案是：

```text
mercari-beyblade-tw-finder.user.js
```
