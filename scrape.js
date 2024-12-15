const puppeteer = require('puppeteer');
const fs = require('fs');

// メルカリで"薪"を検索した結果のURL
const searchUrl = 'https://jp.mercari.com/search?keyword=%E8%96%AA';

async function scrapeData() {
  const browser = await puppeteer.launch({ headless: true }); // ヘッドレスモードでブラウザを起動
  const page = await browser.newPage(); // 新しいタブを開く

  try {
    await page.goto(searchUrl, { 
      waitUntil: 'networkidle0', // すべてのリソース（画像やAPI）を読み込むのを待つ
      timeout: 60000 // タイムアウトを60秒に設定
    });
    console.log('検索ページ取得完了');

    // 商品リストのセレクタが表示されるまで待つ（最大60秒）
    await page.waitForSelector('li[data-testid="item-cell"]', { timeout: 60000 });
    console.log('商品リストが見つかりました');

    // 商品リストを取得
    const items = await page.evaluate(() => {
      const productElements = document.querySelectorAll('li[data-testid="item-cell"]'); // 商品リストの修正したセレクタ
      const results = [];

      productElements.forEach(element => {
        // 商品名
        const title = element.querySelector('span[data-testid="thumbnail-item-name"]') ? 
          element.querySelector('span[data-testid="thumbnail-item-name"]').textContent.trim() : '';

        // 価格
        const price = element.querySelector('span.number__6b270ca7') ? 
          element.querySelector('span.number__6b270ca7').textContent.trim() : '';

        // 商品詳細ページURL
        const url = element.querySelector('a[data-testid="thumbnail-link"]') ? 
          'https://jp.mercari.com' + element.querySelector('a[data-testid="thumbnail-link"]').getAttribute('href') : '';

        results.push({ title, price, url });
      });

      return results;
    });

    console.log('取得した商品リスト:', items);

    // 商品詳細ページを個別に取得して発送元地域を含めたデータを取得
    for (let item of items) {
      const itemPage = await browser.newPage();
      await itemPage.goto(item.url, { waitUntil: 'networkidle0', timeout: 60000 });

      // 発送元地域のセレクタを修正
      const region = await itemPage.evaluate(() => {
        const regionElement = document.querySelector('span[data-testid="発送元の地域"]');  // 修正したセレクタ
        return regionElement ? regionElement.textContent.trim() : '地域情報なし';
      });

      item.region = region;  // 発送元地域を追加

      // 詳細情報を表示
      console.log('商品名:', item.title);
      console.log('価格:', item.price);
      console.log('詳細URL:', item.url);
      console.log('発送元地域:', item.region);
      console.log('----------------------');

      // 7件の情報をJSONに保存
      if (items.indexOf(item) === 6) { // 7件目まで
        fs.writeFileSync('scrapedData.json', JSON.stringify(items, null, 2));
        console.log('データ保存完了');
      }

      await itemPage.close();  // 各商品ページを閉じる
    }

  } catch (err) {
    console.error('Error during scraping:', err);
  } finally {
    await browser.close(); // ブラウザを閉じる
  }
}

scrapeData();
