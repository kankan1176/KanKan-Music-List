/* Published snapshot of the ソートマスタ sheet. Update this snapshot when publishing sheet changes. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SLSortMaster=api;})(typeof globalThis==='object'?globalThis:this,()=>{
 'use strict';
 const definitions=[
 {
  "id": "music_01",
  "field": "genre6",
  "label": "音楽ジャンル",
  "group": "",
  "groupOrder": 1,
  "order": 1,
  "name": "ロック",
  "aliases": [
   "ロック"
  ],
  "categories": [
   "J-POP",
   "アニソン",
   "ボカロ",
   "K-POP",
   "洋楽"
  ],
  "enabled": true
 },
 {
  "id": "music_02",
  "field": "genre6",
  "label": "音楽ジャンル",
  "group": "",
  "groupOrder": 1,
  "order": 2,
  "name": "ポップス",
  "aliases": [
   "ポップス"
  ],
  "categories": [
   "J-POP",
   "アニソン",
   "ボカロ",
   "K-POP",
   "洋楽"
  ],
  "enabled": true
 },
 {
  "id": "music_03",
  "field": "genre6",
  "label": "音楽ジャンル",
  "group": "",
  "groupOrder": 1,
  "order": 3,
  "name": "ヒップホップ",
  "aliases": [
   "ヒップホップ"
  ],
  "categories": [
   "J-POP",
   "アニソン",
   "ボカロ",
   "K-POP",
   "洋楽"
  ],
  "enabled": true
 },
 {
  "id": "music_04",
  "field": "genre6",
  "label": "音楽ジャンル",
  "group": "",
  "groupOrder": 1,
  "order": 4,
  "name": "ラップ",
  "aliases": [
   "ラップ"
  ],
  "categories": [
   "J-POP",
   "アニソン",
   "ボカロ",
   "K-POP",
   "洋楽"
  ],
  "enabled": true
 },
 {
  "id": "music_05",
  "field": "genre6",
  "label": "音楽ジャンル",
  "group": "",
  "groupOrder": 1,
  "order": 5,
  "name": "合唱",
  "aliases": [
   "合唱"
  ],
  "categories": [
   "J-POP",
   "アニソン",
   "ボカロ",
   "K-POP",
   "洋楽"
  ],
  "enabled": true
 },
 {
  "id": "music_06",
  "field": "genre6",
  "label": "音楽ジャンル",
  "group": "",
  "groupOrder": 1,
  "order": 6,
  "name": "シティポップ",
  "aliases": [
   "シティポップ",
   "シティポップ唱"
  ],
  "categories": [
   "J-POP",
   "アニソン",
   "ボカロ",
   "K-POP",
   "洋楽"
  ],
  "enabled": true
 },
 {
  "id": "music_07",
  "field": "genre6",
  "label": "音楽ジャンル",
  "group": "",
  "groupOrder": 1,
  "order": 7,
  "name": "R&B",
  "aliases": [
   "R&B"
  ],
  "categories": [
   "J-POP",
   "アニソン",
   "ボカロ",
   "K-POP",
   "洋楽"
  ],
  "enabled": true
 },
 {
  "id": "music_08",
  "field": "genre6",
  "label": "音楽ジャンル",
  "group": "",
  "groupOrder": 1,
  "order": 8,
  "name": "ジャズ",
  "aliases": [
   "ジャズ"
  ],
  "categories": [
   "J-POP",
   "アニソン",
   "ボカロ",
   "K-POP",
   "洋楽"
  ],
  "enabled": true
 },
 {
  "id": "music_09",
  "field": "genre6",
  "label": "音楽ジャンル",
  "group": "",
  "groupOrder": 1,
  "order": 9,
  "name": "EDM",
  "aliases": [
   "EDM"
  ],
  "categories": [
   "J-POP",
   "アニソン",
   "ボカロ",
   "K-POP",
   "洋楽"
  ],
  "enabled": true
 },
 {
  "id": "music_10",
  "field": "genre6",
  "label": "音楽ジャンル",
  "group": "",
  "groupOrder": 1,
  "order": 10,
  "name": "クラシック",
  "aliases": [
   "クラシック"
  ],
  "categories": [
   "J-POP",
   "アニソン",
   "ボカロ",
   "K-POP",
   "洋楽"
  ],
  "enabled": true
 },
 {
  "id": "music_11",
  "field": "genre6",
  "label": "音楽ジャンル",
  "group": "",
  "groupOrder": 1,
  "order": 11,
  "name": "サンバ",
  "aliases": [
   "サンバ"
  ],
  "categories": [
   "J-POP",
   "アニソン",
   "ボカロ",
   "K-POP",
   "洋楽"
  ],
  "enabled": true
 },
 {
  "id": "music_12",
  "field": "genre6",
  "label": "音楽ジャンル",
  "group": "",
  "groupOrder": 1,
  "order": 12,
  "name": "インスト",
  "aliases": [
   "インスト"
  ],
  "categories": [
   "J-POP",
   "アニソン",
   "ボカロ",
   "K-POP",
   "洋楽"
  ],
  "enabled": true
 },
 {
  "id": "media_1_01",
  "field": "genre5",
  "label": "掲載媒体・関連作品",
  "group": "少年漫画",
  "groupOrder": 1,
  "order": 1,
  "name": "週刊少年ジャンプ",
  "aliases": [
   "週刊少年ジャンプ",
   "ジャンプ"
  ],
  "categories": [
   "アニソン"
  ],
  "enabled": true
 },
 {
  "id": "media_1_02",
  "field": "genre5",
  "label": "掲載媒体・関連作品",
  "group": "少年漫画",
  "groupOrder": 1,
  "order": 2,
  "name": "週刊少年マガジン",
  "aliases": [
   "週刊少年マガジン",
   "マガジン"
  ],
  "categories": [
   "アニソン"
  ],
  "enabled": true
 },
 {
  "id": "media_1_03",
  "field": "genre5",
  "label": "掲載媒体・関連作品",
  "group": "少年漫画",
  "groupOrder": 1,
  "order": 3,
  "name": "週刊少年サンデー",
  "aliases": [
   "週刊少年サンデー",
   "サンデー"
  ],
  "categories": [
   "アニソン"
  ],
  "enabled": true
 },
 {
  "id": "media_1_04",
  "field": "genre5",
  "label": "掲載媒体・関連作品",
  "group": "少年漫画",
  "groupOrder": 1,
  "order": 4,
  "name": "週刊少年チャンピオン",
  "aliases": [
   "週刊少年チャンピオン",
   "チャンピオン"
  ],
  "categories": [
   "アニソン"
  ],
  "enabled": true
 },
 {
  "id": "media_1_05",
  "field": "genre5",
  "label": "掲載媒体・関連作品",
  "group": "少年漫画",
  "groupOrder": 1,
  "order": 5,
  "name": "月刊コロコロコミック",
  "aliases": [
   "月刊コロコロコミック",
   "コロコロコミック"
  ],
  "categories": [
   "アニソン"
  ],
  "enabled": true
 },
 {
  "id": "media_2_01",
  "field": "genre5",
  "label": "掲載媒体・関連作品",
  "group": "少女漫画",
  "groupOrder": 2,
  "order": 1,
  "name": "ちゃお",
  "aliases": [
   "ちゃお"
  ],
  "categories": [
   "アニソン"
  ],
  "enabled": true
 },
 {
  "id": "media_2_02",
  "field": "genre5",
  "label": "掲載媒体・関連作品",
  "group": "少女漫画",
  "groupOrder": 2,
  "order": 2,
  "name": "りぼん",
  "aliases": [
   "りぼん"
  ],
  "categories": [
   "アニソン"
  ],
  "enabled": true
 },
 {
  "id": "media_2_03",
  "field": "genre5",
  "label": "掲載媒体・関連作品",
  "group": "少女漫画",
  "groupOrder": 2,
  "order": 3,
  "name": "なかよし",
  "aliases": [
   "なかよし"
  ],
  "categories": [
   "アニソン"
  ],
  "enabled": true
 },
 {
  "id": "media_2_04",
  "field": "genre5",
  "label": "掲載媒体・関連作品",
  "group": "少女漫画",
  "groupOrder": 2,
  "order": 4,
  "name": "マーガレット",
  "aliases": [
   "マーガレット"
  ],
  "categories": [
   "アニソン"
  ],
  "enabled": true
 },
 {
  "id": "media_2_05",
  "field": "genre5",
  "label": "掲載媒体・関連作品",
  "group": "少女漫画",
  "groupOrder": 2,
  "order": 5,
  "name": "花とゆめ",
  "aliases": [
   "花とゆめ"
  ],
  "categories": [
   "アニソン"
  ],
  "enabled": true
 },
 {
  "id": "media_2_06",
  "field": "genre5",
  "label": "掲載媒体・関連作品",
  "group": "少女漫画",
  "groupOrder": 2,
  "order": 6,
  "name": "LaLa",
  "aliases": [
   "LaLa"
  ],
  "categories": [
   "アニソン"
  ],
  "enabled": true
 },
 {
  "id": "media_2_07",
  "field": "genre5",
  "label": "掲載媒体・関連作品",
  "group": "少女漫画",
  "groupOrder": 2,
  "order": 7,
  "name": "Sho-Comi",
  "aliases": [
   "Sho-Comi"
  ],
  "categories": [
   "アニソン"
  ],
  "enabled": true
 },
 {
  "id": "media_2_08",
  "field": "genre5",
  "label": "掲載媒体・関連作品",
  "group": "少女漫画",
  "groupOrder": 2,
  "order": 8,
  "name": "月刊flowers",
  "aliases": [
   "月刊flowers"
  ],
  "categories": [
   "アニソン"
  ],
  "enabled": true
 },
 {
  "id": "voice_1_01",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "VOCALOID",
  "groupOrder": 1,
  "order": 1,
  "name": "初音ミク",
  "aliases": [
   "初音ミク"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_1_02",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "VOCALOID",
  "groupOrder": 1,
  "order": 2,
  "name": "GUMI（Megpoid）",
  "aliases": [
   "GUMI",
   "Megpoid",
   "GUMI（Megpoid）"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_1_03",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "VOCALOID",
  "groupOrder": 1,
  "order": 3,
  "name": "鏡音リン",
  "aliases": [
   "鏡音リン"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_1_04",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "VOCALOID",
  "groupOrder": 1,
  "order": 4,
  "name": "鏡音レン",
  "aliases": [
   "鏡音レン"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_1_05",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "VOCALOID",
  "groupOrder": 1,
  "order": 5,
  "name": "巡音ルカ",
  "aliases": [
   "巡音ルカ"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_1_06",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "VOCALOID",
  "groupOrder": 1,
  "order": 6,
  "name": "KAITO",
  "aliases": [
   "KAITO"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_1_07",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "VOCALOID",
  "groupOrder": 1,
  "order": 7,
  "name": "MEIKO",
  "aliases": [
   "MEIKO"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_1_08",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "VOCALOID",
  "groupOrder": 1,
  "order": 8,
  "name": "神威がくぽ",
  "aliases": [
   "神威がくぽ"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_1_09",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "VOCALOID",
  "groupOrder": 1,
  "order": 9,
  "name": "Flower（v4 flower）",
  "aliases": [
   "flower",
   "Flower",
   "v4 flower",
   "Flower（v4 flower）"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_2_01",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "CeVIO AI",
  "groupOrder": 2,
  "order": 1,
  "name": "可不（KAFU）",
  "aliases": [
   "可不",
   "KAFU",
   "可不（KAFU）"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_2_02",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "CeVIO AI",
  "groupOrder": 2,
  "order": 2,
  "name": "星界（SEIKAI）",
  "aliases": [
   "星界",
   "SEIKAI",
   "星界（SEIKAI）"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_2_03",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "CeVIO AI",
  "groupOrder": 2,
  "order": 3,
  "name": "裏命（RIME）",
  "aliases": [
   "裏命",
   "RIME",
   "裏命（RIME）"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_2_04",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "CeVIO AI",
  "groupOrder": 2,
  "order": 4,
  "name": "狐子（COKO）",
  "aliases": [
   "狐子",
   "COKO",
   "狐子（COKO）"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_2_05",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "CeVIO AI",
  "groupOrder": 2,
  "order": 5,
  "name": "羽累（HARU）",
  "aliases": [
   "羽累",
   "HARU",
   "羽累（HARU）"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_2_06",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "CeVIO AI",
  "groupOrder": 2,
  "order": 6,
  "name": "IA",
  "aliases": [
   "IA"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_2_07",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "CeVIO AI",
  "groupOrder": 2,
  "order": 7,
  "name": "ONE",
  "aliases": [
   "ONE"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_3_01",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "Synthesizer V",
  "groupOrder": 3,
  "order": 1,
  "name": "重音テト",
  "aliases": [
   "重音テト"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_3_02",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "Synthesizer V",
  "groupOrder": 3,
  "order": 2,
  "name": "小春六花",
  "aliases": [
   "小春六花"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_3_03",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "Synthesizer V",
  "groupOrder": 3,
  "order": 3,
  "name": "夏色花梨",
  "aliases": [
   "夏色花梨"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_3_04",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "Synthesizer V",
  "groupOrder": 3,
  "order": 4,
  "name": "花隈千冬",
  "aliases": [
   "花隈千冬"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_3_05",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "Synthesizer V",
  "groupOrder": 3,
  "order": 5,
  "name": "Megpoid",
  "aliases": [
   "Megpoid",
   "GUMI"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_3_06",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "Synthesizer V",
  "groupOrder": 3,
  "order": 6,
  "name": "Solaria",
  "aliases": [
   "Solaria",
   "SOLARIA"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_3_07",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "Synthesizer V",
  "groupOrder": 3,
  "order": 7,
  "name": "Eleanor Forte",
  "aliases": [
   "Eleanor Forte"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_4_01",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "UTAU",
  "groupOrder": 4,
  "order": 1,
  "name": "重音テト",
  "aliases": [
   "重音テト"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_4_02",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "UTAU",
  "groupOrder": 4,
  "order": 2,
  "name": "デフォ子",
  "aliases": [
   "デフォ子"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_4_03",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "UTAU",
  "groupOrder": 4,
  "order": 3,
  "name": "桃音モモ",
  "aliases": [
   "桃音モモ"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_4_04",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "UTAU",
  "groupOrder": 4,
  "order": 4,
  "name": "波音リツ",
  "aliases": [
   "波音リツ"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_4_05",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "UTAU",
  "groupOrder": 4,
  "order": 5,
  "name": "欲音ルコ",
  "aliases": [
   "欲音ルコ"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_4_06",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "UTAU",
  "groupOrder": 4,
  "order": 6,
  "name": "健音テイ",
  "aliases": [
   "健音テイ"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_4_07",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "UTAU",
  "groupOrder": 4,
  "order": 7,
  "name": "雪歌ユフ",
  "aliases": [
   "雪歌ユフ"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_4_08",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "UTAU",
  "groupOrder": 4,
  "order": 8,
  "name": "春歌ナナ",
  "aliases": [
   "春歌ナナ"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_4_09",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "UTAU",
  "groupOrder": 4,
  "order": 9,
  "name": "櫻歌ミコ",
  "aliases": [
   "櫻歌ミコ"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_4_10",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "UTAU",
  "groupOrder": 4,
  "order": 10,
  "name": "ゲキヤク",
  "aliases": [
   "ゲキヤク"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_4_11",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "UTAU",
  "groupOrder": 4,
  "order": 11,
  "name": "カゼヒキ",
  "aliases": [
   "カゼヒキ"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_4_12",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "UTAU",
  "groupOrder": 4,
  "order": 12,
  "name": "Mac音ナナ",
  "aliases": [
   "Mac音ナナ"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_5_01",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "VOICEVOX",
  "groupOrder": 5,
  "order": 1,
  "name": "ずんだもん",
  "aliases": [
   "ずんだもん"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_5_02",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "VOICEVOX",
  "groupOrder": 5,
  "order": 2,
  "name": "四国めたん",
  "aliases": [
   "四国めたん"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_5_03",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "VOICEVOX",
  "groupOrder": 5,
  "order": 3,
  "name": "春日部つむぎ",
  "aliases": [
   "春日部つむぎ"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_5_04",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "VOICEVOX",
  "groupOrder": 5,
  "order": 4,
  "name": "雨晴はう",
  "aliases": [
   "雨晴はう"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_5_05",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "VOICEVOX",
  "groupOrder": 5,
  "order": 5,
  "name": "冥鳴ひまり",
  "aliases": [
   "冥鳴ひまり"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_5_06",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "VOICEVOX",
  "groupOrder": 5,
  "order": 6,
  "name": "九州そら",
  "aliases": [
   "九州そら"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_5_07",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "VOICEVOX",
  "groupOrder": 5,
  "order": 7,
  "name": "波音リツ",
  "aliases": [
   "波音リツ"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_5_08",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "VOICEVOX",
  "groupOrder": 5,
  "order": 8,
  "name": "WhiteCUL",
  "aliases": [
   "WhiteCUL"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_5_09",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "VOICEVOX",
  "groupOrder": 5,
  "order": 9,
  "name": "もち子さん",
  "aliases": [
   "もち子さん"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_5_10",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "VOICEVOX",
  "groupOrder": 5,
  "order": 10,
  "name": "栗田まろん",
  "aliases": [
   "栗田まろん"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_5_11",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "VOICEVOX",
  "groupOrder": 5,
  "order": 11,
  "name": "東北ずん子",
  "aliases": [
   "東北ずん子"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_5_12",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "VOICEVOX",
  "groupOrder": 5,
  "order": 12,
  "name": "東北きりたん",
  "aliases": [
   "東北きりたん"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "voice_5_13",
  "field": "vocal_synths",
  "label": "ボカロ別",
  "group": "VOICEVOX",
  "groupOrder": 5,
  "order": 13,
  "name": "東北イタコ",
  "aliases": [
   "東北イタコ"
  ],
  "categories": [
   "ボカロ"
  ],
  "enabled": true
 },
 {
  "id": "publisher_other_kirara",
  "field": "genre5",
  "label": "掲載媒体・関連作品",
  "group": "その他",
  "groupOrder": 3,
  "order": 1,
  "name": "まんがタイムきらら",
  "aliases": [
   "まんがタイムきらら"
  ],
  "categories": [
   "アニソン"
  ],
  "enabled": true
 }
];
 const fields=['genre6','genre5','vocal_synths'];
 const normalize=value=>String(value??'').normalize('NFKC').trim().toLocaleLowerCase('ja');
 const active=field=>definitions.filter(row=>row.enabled&&row.field===field).sort((a,b)=>a.groupOrder-b.groupOrder||a.order-b.order);
 function choices(field,category){return [...new Set(active(field).filter(row=>!category||row.categories.includes(category)).map(row=>row.name))];}
 function aliases(field,value){
  const values=new Set([String(value)]),seen=new Set([normalize(value)]);
  // Overlapping aliases (for example GUMI/Megpoid) belong to one matching set.
  let changed=true;while(changed){changed=false;for(const row of active(field)){const names=[row.name,...row.aliases];if(!names.some(name=>seen.has(normalize(name))))continue;for(const name of names){values.add(name);const key=normalize(name);if(!seen.has(key)){seen.add(key);changed=true;}}}}
  return [...values];
 }
 function canonical(field,value){const rows=active(field);if(rows.some(row=>row.name===value))return value;const names=new Set(aliases(field,value).map(normalize));return rows.find(row=>[row.name,...row.aliases].some(name=>names.has(normalize(name))))?.name||value;}
 const matchCache=new Map();
 function matches(field,actual,selected){const key=JSON.stringify([field,selected]);let names=matchCache.get(key);if(!names){names=new Set(aliases(field,selected).map(normalize));matchCache.set(key,names);}return actual.some(value=>names.has(normalize(value)));}
 return{definitions,fields,choices,aliases,canonical,matches};
});
