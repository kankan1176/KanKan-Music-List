# GitHubからFirebase管理機能を自動公開

PCへのZIPダウンロードや、コマンドプロンプトでの公開操作は不要です。

既存の楽曲検索インデックス更新と同じ、GitHub Actionsの `FIREBASE_SERVICE_ACCOUNT` シークレットを使います。秘密鍵の内容をチャットやソースへ貼り付けないでください。このワークフローを追加しても、新しい鍵は作成しません。

## 最初に一度だけ行う操作

1. GitHubのリポジトリで **Actions → Deploy Firebase admin functions** を開きます。
2. **Run workflow** を押し、ブランチを **main** にします。
3. **「初回のみON：既存DBルールを保持して管理機能を有効化」** にチェックを入れます。
4. 緑色の **Run workflow** を押します。
5. 実行結果が緑のチェックになったら、サイトの管理画面を再読み込みしてユーザー管理を開きます。

チェックをONにした場合だけ、サーバー機能の公開成功後にDBルールを更新します。現在のルールを取得し、許可条件に認証失効チェックを追加します。個人データの所有者制限・検証・インデックスは保持します。確認に成功してから管理機能を有効化します。適用前のルールは実行画面のArtifactsから7日間ダウンロードできます。

初期設定後は、`functions/`、`firebase.json`、関連スクリプトやこのワークフローをmainに更新すると自動で公開します。HTMLや画像だけの変更ではサーバー機能を再公開しません。通常の自動公開ではDBルールを変更せず、管理機能を意図的に停止した設定も保持します。既存のサイト公開・検索インデックス更新は変更しません。

## 赤い×になった場合

Actionsで該当の実行を開き、赤い×の付いた処理をクリックしてエラー文を確認します。秘密鍵は送らず、エラー文を共有してください。

- **FIREBASE_SERVICE_ACCOUNT が未設定**：Settings → Secrets and variables → Actions に、既存の認証設定があるか確認します。WebサイトへのGoogleログインだけではGitHub Actionsの認証になりません。
- **Permission denied / 403**：そのサービスアカウントに自動公開用の権限が不足しています。Google CloudコンソールのIAMで対象アカウントを確認します。公開にはCloud Functionsの更新権限、利用する実行サービスアカウントのService Account User権限、必要なCloud Run IAM操作等が必要です。初期設定にはRealtime Databaseのルール変更・書き込み権限も必要です。権限を一律に広げず、失敗した操作に応じて付与してください。
- **課金・APIに関するエラー**：FirebaseのBlazeプランと、Cloud Functions / Cloud Build / Artifact Registry / Cloud Runなど必要APIの状態を確認します。
- **公開後の処理が権限エラー**：Functionsの実行サービスアカウントにもFirebase Authenticationのユーザー取得・トークン失効とRealtime Databaseアクセスの権限が必要です。GitHubの公開用アカウントとは別の場合があります。

## 対象と検証の限界

対象は `kankan1176/KanKan-Music-List` の **main** と、Firebaseプロジェクト `kankan-session-room` の **account-controls** のみです。プルリクエストや別ブランチでは実行しません。権限チェックのテストが通った場合だけ公開します。同時実行を直列化し、途中の公開をキャンセルしません。

既存のシークレット値は読み出していません。有効性・権限・課金設定は最初のActions実行で確認します。ワークフローの追加だけで、初期設定や本番の動作確認が完了したとは扱いません。初回成功後は `docs/admin-account-controls.md` の「運用確認」も実施してください。
