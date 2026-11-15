# hitoninaritai GitHub Pages 設置手順

1. このZIPを展開して **中身** を `hitoninaritai` のリポジトリのルートに配置します。`index.html` がルートにあることを確認してください。
2. GitHub リポジトリの **Settings → Pages → Build and deployment** で `Deploy from a branch`、ブランチ `main`、フォルダ `/(root)` を選んで Save。
3. 公開先は通常 `https://<GitHubユーザー名>.github.io/hitoninaritai/` です。反映を待ってからアクセスしてください。
4. iPhone Safari: 共有→ホーム画面に追加。Android Chrome: メニュー→ホーム画面に追加／アプリをインストール。
5. HTTPSで初回アクセス後、オフラインでも起動可能になります。ただし端末によってアプリインストール可否が異なります。

## 注意
- v1.0 RC1（受入テスト前）です。端末実機での表示、入力、保存、オフライン起動を確認してください。
- `src/`, `styles.css`, `manifest.webmanifest`, `icon.svg`, `sw.js` を必ず一緒に配置してください。
- セーブは閲覧ブラウザのIndexedDBに保存されます。定期的にJSONエクスポートしてください。
- 既存の `index.html` などがある場合、上書き前にバックアップしてください。
