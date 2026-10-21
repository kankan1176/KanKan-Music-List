# App Check の導入と確認

本体、管理画面、マイリスト（本人用・公開用）、OBS画面では、Firebase初期化の直後、Database/Authを使用する前に共通の `firebase-app-check.js` を実行します。Firebase 10.13.0 compat SDKの `ReCaptchaEnterpriseProvider` を使い、トークンの自動更新を有効にしています。サイトキーは公開用です。秘密鍵やデバッグトークンは保存しません。

## 公開後の確認

1. Firebase App CheckのWebアプリ登録先が、このコードのFirebase appIdと一致し、今回指定されたサイトキーで登録されていることを確認します。サイトキーの許可ドメインに `kankan1176.com` を登録してください。
2. Realtime Databaseは「モニタリング」のままにします。Authenticationの適用もこの変更では有効化しません。
3. 本番の `appcheck-test.html` を開き「App Check: 成功」「Realtime Database: 成功」を確認します。診断は小さな公開リビジョン値だけを読み、キャッシュ済みトークンを再利用します。成功表示だけでは、Database側の適用が有効になったことを意味しません。
4. 通常ブラウザのGoogleログイン・ゲスト、管理画面、本人マイリスト・公開マイリスト、iPad等のタブレット、OBSブラウザソースで実際に読み込み・更新を確認します。OBSとプレビューも同じ保護対象です。OBSの実機認証は通常のブラウザとは別に確認してください。
5. Firebase App Check > API > Realtime Databaseの指標で、実際の各クライアントから検証済みリクエストが届いていることを確認します。古いタブやOBSは再読み込みしてください。未検証・不正の正規クライアントが残っている間は強制しません。
6. 確認後にRealtime Databaseの適用を有効にします。問題が出た場合はすぐ「モニタリング」に戻します。

## 費用・制約

このコード変更はSparkプラン、請求先、API設定、ルール、既存データを変更しません。無料枠は無制限ではありません。課金を一切許可しない運用ではGoogle Cloudの請求先も未接続のまま維持し、reCAPTCHAの無料割り当てと使用量を確認してください。無料枠超過で認証が利用できなくなる可能性があります。短時間の強制トークン再取得や独自ポーリングは行いません。

App Checkは公開楽曲の一括収集を抑制する一層です。正規ブラウザによるコピーやアクセス集中を完全には防げません。利用者情報の保護には引き続きDatabaseの権限ルールが必要です。

## 検証範囲

`node scripts/check-app-check.cjs` は4画面の読み込み順、共通キーの使用、初期化の重複防止・自動更新・異常時の挙動を検証します。ローカル検証では実際のreCAPTCHA判定や本番App Check設定は検証できません。診断ページと各実機の確認後に適用を判断します。

参考: https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider
