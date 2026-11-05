'use strict';
const assert = require('node:assert/strict');
const search = require('../song-search-core.js');
const keywords = 'Sweet Bitter Beauty Song,桜高軽音部 [平沢唯・秋山澪・田井中律・琴吹紬(CV:豊崎愛生、日笠陽子、佐藤聡美、寿美菜子)],けいおん!,SweetBitterBeautySong,桜高軽音部平沢唯秋山澪田井中律琴吹紬CV豊崎愛生、日笠陽子、佐藤聡美、寿美菜子,けいおん,ケイオン!,大森祥子,田村信二,小森茂生,まんがタイムきらら,アニソン,アニメソング';
// Only Q-column content: every match must come from search, not another column.
for (const separator of [',', '，', '、', '\n']) {
  const song = {title: 'test fixture', search: keywords.split(',').join(separator)};
  for (const phrase of keywords.split(',')) assert(search.matches(song, phrase), phrase);
  for (const query of ['けいおん', '平沢唯', '秋山澪', '田井中律', '琴吹紬', '小森茂生', '日笠陽子', 'Sweet Bitter Beauty Song', 'SweetBitterBeautySong', 'けいおん 平沢唯']) assert(search.matches(song,query), query);
  assert(!search.matches(song,'存在しない用語'));
}
assert(!search.matches({search:'first,second'},'firstsecond'), 'Comma must separate phrases');
console.log('PASS Q-column phrases and substrings: commas, full-width commas, Japanese commas and newlines; original song example, character names and creator names.');
