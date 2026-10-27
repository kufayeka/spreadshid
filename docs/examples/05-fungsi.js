import { FUNCTION_NAMES } from '@kufayeka/sheet/core';

// semua fungsi yang bisa dipakai di rumus, diambil dari library itu sendiri
console.log(FUNCTION_NAMES.length + ' fungsi:');
for (let i = 0; i < FUNCTION_NAMES.length; i += 8) console.log(FUNCTION_NAMES.slice(i, i + 8).join(', '));
