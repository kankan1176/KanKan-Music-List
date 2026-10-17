# 管理者によるアカウント・端末操作

## 実装内容

管理画面の「ユーザー管理」に以下を追加します。

- Googleアカウントの全端末を強制ログアウト。Firebase Authenticationの更新トークンを失効させ、Realtime Databaseでも以前のログインからのアクセスを拒否します。
- 対象ユーザー、またはログインユーザー・ゲスト全体へ、楽曲キャッシュの削除を指示。
- ゲストの名前を変更。参加中のルーム内表示と、対象ブラウザの保存名を更新。
- 指示を受信・処理した端末数の確認。

削除対象は公開楽曲マスターのIndexedDBと、このサイトが管理する公開楽曲のレスポンスキャッシュのみです。マイリスト、表示設定、ログイン情報、ブラウザの他サイトのキャッシュは消しません。メモリ上の未保存編集を保持するため、自動再読み込みは行いません。最新データを取り直す場合は、編集を保存してから再読み込みしてください。

端末は60秒ごと、認証状態の変更時、画面へ戻った時、オンライン復帰時に指示を確認します。未接続端末のローカルデータは次回アクセス時に反映されます。対象ブラウザがサイトのデータを完全に消すと匿名UIDが変わるため、旧ゲストへの個別指示は新しいUIDには引き継がれません。全体キャッシュ削除は未ログイン状態にも適用します。

## GitHubから自動公開する場合

PCでのダウンロード・コマンド操作を省く場合は、[GitHub自動公開の手順](firebase-auto-deploy.md)を利用してください。初回はActionsの「Deploy Firebase admin functions」から初期設定をONにして実行します。以後、関連コードのmain更新で自動公開します。通常の自動公開はDBルールや管理機能の停止設定を変更しません。

## PCから手動で本番適用する場合

**コードの公開だけでは有効になりません。** Firebaseのサーバー機能と権限ルールを適用し、初期設定を有効化する必要があります。ブラウザには管理者の認証鍵を渡しません。管理者は従来と同じくGoogleログインと `/admins/<uid> = true` の両方が必要です。

Firebaseプロジェクトは `kankan-session-room`、Functionsのリージョンは `asia-northeast1`、対象Realtime Databaseは既存の `kankan-session-room-default-rtdb` です。Cloud Functionsの利用・デプロイには課金プラン、必要API、デプロイ権限が必要です。

リポジトリを取得した、Node.js 22とFirebase CLIを利用できる端末で以下を実行してください。

```sh
npm ci --prefix functions
node scripts/check-account-control-service.cjs
firebase login
firebase deploy --project kankan-session-room --only functions:account-controls
```

次に、同じプロジェクトに対するRealtime Database管理権限を持つApplication Default Credentialsを設定してください。Google Cloud CLIを使用する場合の例です。サービスアカウント鍵をソースやチャットに貼り付けないでください。

```sh
gcloud auth application-default login
node scripts/configure-account-controls.cjs
node scripts/configure-account-controls.cjs --apply
```

最初の実行はバックアップのみです。`--apply` はその時点の本番ルールを取得し、既存の許可条件に認証失効チェックを追加します。ルートに包括的な許可がある場合は、秘密の管理データを保護できないため停止します。ルール更新が途中で競合した場合も停止します。

既存ルール全体を置き換える雛形は使用しません。既存の `.validate`、インデックス、個人データの所有者制限を保持します。バックアップは実行ディレクトリの `.account-controls-backup/` に保存します。ルールの適用・再取得確認が成功した後にだけ `/adminControl/config` を `{enabled:true, securityRulesVersion:1, configuredAt:...}` に設定します。

実行環境のApplication Default Credentialsが別プロジェクトのものでないことと、Firebaseコンソールでデプロイ結果を確認してください。適用後、管理画面のユーザー管理に対象が表示されることを確認します。

## 運用確認

管理者とは別のテスト用Googleアカウントとゲストを用意します。

1. Googleアカウントを強制ログアウトし、元のログイン状態でDBへアクセスできず、再ログインすると利用できることを確認。
2. ゲスト名を変更し、ルーム表示と、同じブラウザを再起動した後の名前が更新されることを確認。
3. 個別・全体キャッシュ削除を実行し、受信端末数が更新され、保存済みマイリストが保持されることを確認。
4. オフラインの対象をオンラインに戻し、保留中の指示が適用されることを確認。
5. 管理者以外が管理操作を呼び出しても拒否されることを確認。

自分自身への強制ログアウトは誤操作防止のため無効です。同じ秒に再ログインした場合は認証失効時刻と同値になることがあるため、少し待って再ログインしてください。

一時停止する場合はFirebaseコンソールから `/adminControl/config/enabled` を `false` にします。新しい管理操作と端末への指示配信は停止しますが、実行済みの認証失効は維持されます。ルールの復元は認証失効チェックも解除するため、バックアップを確認して慎重に行ってください。

## 検証の範囲

`node scripts/check-account-control-service.cjs` は、管理者権限、実行許可、対象制限、認証失効の呼び出し、指示と受信確認、ルール変換を依存注入によって検証します。Firebase本番への認証・デプロイを代替するテストではありません。ブラウザ側の動作はChromiumで応答を模擬して検証しています。本番のFirebase Authentication・Functions・Realtime Databaseを通した確認は、上記の適用後に必要です。
