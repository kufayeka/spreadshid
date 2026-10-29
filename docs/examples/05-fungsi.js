import { createWorkbook, FUNCTION_NAMES } from '@kufayeka/sheet/core';

// Semua fungsi rumus: buat apa, contoh rumusnya, dan hasilnya. Hasilnya dihitung oleh library dari tabel contoh di bawah, bukan ditulis tangan.
// Kalau ada fungsi di library yang belum punya contoh di sini, skrip ini gagal (dan test dokumentasi ikut gagal).

const wb = createWorkbook(null, { now: () => new Date(2026, 9, 27, 9, 30) });
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
const s = wb.sheet('Sheet1');
s.setSheetProps({ name: 'Data' });
s.setValues('A1', [
    ['Produk', 'Harga', 'Qty', 'Kategori', 'Tanggal', 'Catatan', 'Arus kas'],
    ['Semen 50 kg', 72000, 10, 'Bahan', 46296, '  semen portland  ', -1000000],
    ['Besi 10 mm', 79500, 5, 'Bahan', 46300, 'PO-2611', 300000],
    ['Cat 5 kg', 145000, 2, 'Finishing', 46310, null, 400000],
    ['Pasir m3', 290000, 3, 'Bahan', 46317, null, 500000]
]);
s.setColProps('E', { format: { type: 'date' } });

const TANGGAL = { type: 'date' }, JAM = { type: 'time', pattern: 'HH:mm' }, TGLJAM = { type: 'datetime', pattern: 'd/M/yyyy HH:mm' };
// [nama, buat apa, contoh rumus, format hasil (kalau hasilnya tanggal atau jam)]
const GRUP = {
    'Menjumlah dan menghitung': [
        ['SUM', 'menjumlahkan angka', '=SUM(B2:B5)'],
        ['SUMPRODUCT', 'mengalikan baris demi baris lalu menjumlahkan (harga × qty)', '=SUMPRODUCT(B2:B5, C2:C5)'],
        ['PRODUCT', 'mengalikan semua angka', '=PRODUCT(C2:C3)'],
        ['AVERAGE', 'rata-rata', '=AVERAGE(B2:B5)'],
        ['MEDIAN', 'nilai tengah', '=MEDIAN(B2:B5)'],
        ['MAX', 'angka terbesar', '=MAX(B2:B5)'],
        ['MIN', 'angka terkecil', '=MIN(B2:B5)'],
        ['LARGE', 'terbesar ke-n', '=LARGE(B2:B5, 2)'],
        ['SMALL', 'terkecil ke-n', '=SMALL(B2:B5, 2)'],
        ['RANK', 'peringkat sebuah angka (terbesar = 1)', '=RANK(B3, B2:B5)'],
        ['RANK.EQ', 'sama dengan RANK', '=RANK.EQ(B5, B2:B5)'],
        ['COUNT', 'banyaknya sel berisi angka', '=COUNT(A2:C5)'],
        ['COUNTA', 'banyaknya sel yang tidak kosong', '=COUNTA(F2:F5)'],
        ['COUNTBLANK', 'banyaknya sel kosong', '=COUNTBLANK(F2:F5)'],
        ['SUBTOTAL', 'total yang melewati baris tersembunyi dan subtotal lain (9 = SUM)', '=SUBTOTAL(9, B2:B5)']
    ],
    'Dengan syarat': [
        ['SUMIF', 'menjumlahkan yang memenuhi satu syarat', '=SUMIF(D2:D5, "Bahan", B2:B5)'],
        ['SUMIFS', 'menjumlahkan dengan beberapa syarat', '=SUMIFS(B2:B5, D2:D5, "Bahan", C2:C5, ">3")'],
        ['COUNTIF', 'menghitung yang memenuhi syarat', '=COUNTIF(D2:D5, "Bahan")'],
        ['COUNTIFS', 'menghitung dengan beberapa syarat', '=COUNTIFS(D2:D5, "Bahan", B2:B5, ">75000")'],
        ['AVERAGEIF', 'rata-rata yang memenuhi syarat', '=ROUND(AVERAGEIF(D2:D5, "Bahan", B2:B5), 0)'],
        ['AVERAGEIFS', 'rata-rata dengan beberapa syarat', '=AVERAGEIFS(B2:B5, D2:D5, "Bahan", C2:C5, "<10")'],
        ['MAXIFS', 'terbesar yang memenuhi syarat', '=MAXIFS(B2:B5, D2:D5, "Bahan")'],
        ['MINIFS', 'terkecil yang memenuhi syarat', '=MINIFS(B2:B5, D2:D5, "Bahan")']
    ],
    'Pembulatan': [
        ['ROUND', 'membulatkan ke sekian desimal', '=ROUND(1234.567, 2)'],
        ['ROUNDUP', 'membulatkan ke atas (7,2 zak jadi 8 zak)', '=ROUNDUP(7.2, 0)'],
        ['ROUNDDOWN', 'membulatkan ke bawah', '=ROUNDDOWN(7.8, 0)'],
        ['MROUND', 'membulatkan ke kelipatan terdekat', '=MROUND(1157320, 1000)'],
        ['CEILING', 'membulatkan ke atas ke kelipatan', '=CEILING(1157320, 5000)'],
        ['FLOOR', 'membulatkan ke bawah ke kelipatan', '=FLOOR(1157320, 5000)'],
        ['INT', 'bilangan bulat ke bawah', '=INT(7.9)'],
        ['TRUNC', 'membuang desimal', '=TRUNC(-7.9)'],
        ['QUOTIENT', 'hasil bagi tanpa sisa: berapa batang besi 12 m utuh dari 100 m', '=QUOTIENT(100, 12)'],
        ['EVEN', 'ke atas ke bilangan genap (bahan yang dijual berpasangan)', '=EVEN(7.2)'],
        ['ODD', 'ke atas ke bilangan ganjil', '=ODD(6)'],
        ['CEILING.MATH', 'ke atas ke kelipatan; angka negatif menuju nol', '=CEILING.MATH(-8.1, 2)'],
        ['FLOOR.MATH', 'ke bawah ke kelipatan; angka negatif menjauhi nol', '=FLOOR.MATH(-8.1, 2)']
    ],
    'Matematika': [
        ['ABS', 'nilai tanpa tanda minus', '=ABS(-1500)'],
        ['SIGN', 'tanda: 1 positif, -1 negatif, 0 nol', '=SIGN(-1500)'],
        ['MOD', 'sisa bagi', '=MOD(17, 5)'],
        ['POWER', 'pangkat', '=POWER(1.1, 2)'],
        ['SQRT', 'akar kuadrat', '=SQRT(144)'],
        ['EXP', 'e pangkat angka', '=ROUND(EXP(1), 4)'],
        ['LN', 'logaritma natural', '=ROUND(LN(10), 4)'],
        ['LOG', 'logaritma dengan basis tertentu', '=LOG(1000, 10)'],
        ['LOG10', 'logaritma basis 10', '=LOG10(1000)'],
        ['PI', 'bilangan π', '=ROUND(PI(), 4)'],
        ['SUMSQ', 'jumlah kuadrat (3² + 4²)', '=SUMSQ(3, 4)'],
        ['RADIANS', 'derajat menjadi radian (fungsi sudut memakai radian)', '=ROUND(RADIANS(30), 6)'],
        ['DEGREES', 'radian menjadi derajat', '=DEGREES(PI())'],
        ['SIN', 'sinus: tinggi kuda-kuda atap 30° dengan sisi miring 4 m', '=ROUND(4 * SIN(RADIANS(30)), 2)'],
        ['COS', 'kosinus: jarak datar sisi miring 4 m pada 30°', '=ROUND(4 * COS(RADIANS(30)), 2)'],
        ['TAN', 'tangen: kenaikan per meter pada kemiringan 30°', '=ROUND(TAN(RADIANS(30)), 4)'],
        ['ASIN', 'sudut dari sinus', '=DEGREES(ASIN(0.5))'],
        ['ACOS', 'sudut dari kosinus', '=DEGREES(ACOS(0.5))'],
        ['ATAN', 'sudut tangga: naik 3, maju 4', '=ROUND(DEGREES(ATAN(3/4)), 2)'],
        ['ATAN2', 'sudut titik (x, y), x dulu', '=DEGREES(ATAN2(1, 1))'],
        ['CONVERT', 'mengubah satuan: kaki persegi ke meter persegi', '=ROUND(CONVERT(1000, "ft2", "m2"), 2)']
    ],
    'Logika': [
        ['IF', 'satu nilai kalau syarat benar, nilai lain kalau salah', '=IF(C2>5, "Banyak", "Sedikit")'],
        ['IFS', 'beberapa syarat berurutan, yang pertama benar dipakai', '=IFS(B4>200000, "Mahal", B4>100000, "Sedang", TRUE, "Murah")'],
        ['SWITCH', 'memilih hasil menurut nilai', '=SWITCH(D4, "Bahan", "B", "Finishing", "F", "-")'],
        ['AND', 'benar kalau semua syarat benar', '=AND(C2>5, B2<100000)'],
        ['OR', 'benar kalau salah satu syarat benar', '=OR(C2>20, B2<100000)'],
        ['NOT', 'membalik benar dan salah', '=NOT(C2>5)'],
        ['XOR', 'benar kalau jumlah syarat yang benar ganjil', '=XOR(TRUE, FALSE)'],
        ['TRUE', 'nilai benar', '=TRUE()'],
        ['FALSE', 'nilai salah', '=FALSE()'],
        ['IFERROR', 'nilai cadangan kalau rumus error', '=IFERROR(B2/0, 0)'],
        ['IFNA', 'nilai cadangan kalau tidak ketemu (#N/A)', '=IFNA(VLOOKUP("Kayu", A2:B5, 2, FALSE), "tidak ada")']
    ],
    'Mencari dan mengambil': [
        ['VLOOKUP', 'mencari di kolom pertama, mengambil dari kolom ke-n', '=VLOOKUP("Cat 5 kg", A2:C5, 2, FALSE)'],
        ['HLOOKUP', 'mencari di baris pertama, mengambil dari baris ke-n', '=HLOOKUP("Qty", A1:G5, 3, FALSE)'],
        ['XLOOKUP', 'mencari di satu range, mengambil dari range lain', '=XLOOKUP("Besi 10 mm", A2:A5, B2:B5)'],
        ['LOOKUP', 'nilai terakhir yang tidak lebih dari yang dicari (range terurut)', '=LOOKUP(100000, B2:B5, A2:A5)'],
        ['INDEX', 'isi sel ke-n dari sebuah range', '=INDEX(A2:A5, 3)'],
        ['MATCH', 'posisi sebuah nilai di range', '=MATCH("Cat 5 kg", A2:A5, 0)'],
        ['CHOOSE', 'memilih dari daftar menurut nomor', '=CHOOSE(2, "Senin", "Selasa", "Rabu")'],
        ['OFFSET', 'sel yang bergeser sekian baris dan kolom', '=OFFSET(A1, 2, 1)'],
        ['INDIRECT', 'sel dari teks alamat', '=INDIRECT("B" & 4)'],
        ['TRANSPOSE', 'baris jadi kolom', '=INDEX(TRANSPOSE(A2:A5), 1, 2)'],
        ['ROW', 'nomor baris sebuah sel', '=ROW(B4)'],
        ['ROWS', 'banyaknya baris range', '=ROWS(A2:A5)'],
        ['COLUMN', 'nomor kolom sebuah sel', '=COLUMN(D1)'],
        ['COLUMNS', 'banyaknya kolom range', '=COLUMNS(A1:G1)']
    ],
    'Teks': [
        ['CONCAT', 'menyambung teks', '=CONCAT(A2, " x ", C2)'],
        ['CONCATENATE', 'sama dengan CONCAT', '=CONCATENATE(A3, " (", D3, ")")'],
        ['TEXTJOIN', 'menyambung banyak teks dengan pemisah', '=TEXTJOIN(", ", TRUE, A2:A5)'],
        ['TEXT', 'angka atau tanggal jadi teks dengan pola', '=TEXT(E2, "dd/mm/yyyy")'],
        ['TERBILANG', 'angka dalam kata-kata (kwitansi, BAP)', '=TERBILANG(B2, "rupiah")'],
        ['LEFT', 'beberapa huruf dari kiri', '=LEFT(A2, 5)'],
        ['RIGHT', 'beberapa huruf dari kanan', '=RIGHT(F3, 4)'],
        ['MID', 'beberapa huruf dari tengah', '=MID(F3, 4, 4)'],
        ['LEN', 'panjang teks', '=LEN(A2)'],
        ['FIND', 'posisi teks (huruf besar-kecil dibedakan)', '=FIND("-", F3)'],
        ['SEARCH', 'posisi teks (tidak dibedakan)', '=SEARCH("SEMEN", A2)'],
        ['REPLACE', 'mengganti bagian teks menurut posisi', '=REPLACE(F3, 1, 2, "SO")'],
        ['SUBSTITUTE', 'mengganti teks tertentu', '=SUBSTITUTE(A2, "50 kg", "40 kg")'],
        ['UPPER', 'huruf besar semua', '=UPPER(D2)'],
        ['LOWER', 'huruf kecil semua', '=LOWER(A3)'],
        ['PROPER', 'huruf besar di awal kata', '=PROPER(TRIM(F2))'],
        ['TRIM', 'membuang spasi berlebih', '=TRIM(F2)'],
        ['REPT', 'mengulang teks', '=REPT("★", 3)'],
        ['VALUE', 'teks angka jadi angka', '=VALUE("1250") + 1'],
        ['EXACT', 'apakah dua teks sama persis', '=EXACT("Semen", "semen")'],
        ['N', 'nilai jadi angka (TRUE = 1, teks = 0)', '=N(TRUE)'],
        ['HYPERLINK', 'teks yang menunjuk alamat web', '=HYPERLINK("https://contoh.id", "buka")'],
        ['TEXTBEFORE', 'teks sebelum pemisah: awalan nomor PO', '=TEXTBEFORE(F3, "-")'],
        ['TEXTAFTER', 'teks sesudah pemisah: nomor di belakang', '=TEXTAFTER(F3, "-")'],
        ['NUMBERVALUE', 'angka tulisan Indonesia ("1.250,50") menjadi angka', '=NUMBERVALUE("1.250,50", ",", ".")'],
        ['FIXED', 'angka dibulatkan lalu ditulis sebagai teks', '=FIXED(1234.567, 1)'],
        ['CHAR', 'huruf dari kodenya (10 = ganti baris)', '=CHAR(65)'],
        ['CODE', 'kode huruf pertama', '=CODE("A")'],
        ['CLEAN', 'membuang karakter tak terlihat dari teks tempelan', '=LEN(CLEAN("PO" & CHAR(10) & "2611"))']
    ],
    'Memeriksa isi': [
        ['ISBLANK', 'apakah sel kosong', '=ISBLANK(F4)'],
        ['ISNUMBER', 'apakah angka', '=ISNUMBER(B2)'],
        ['ISTEXT', 'apakah teks', '=ISTEXT(B2)'],
        ['ISLOGICAL', 'apakah TRUE atau FALSE', '=ISLOGICAL(C2>5)'],
        ['ISERROR', 'apakah error', '=ISERROR(B2/0)'],
        ['ISNA', 'apakah #N/A', '=ISNA(MATCH("Kayu", A2:A5, 0))'],
        ['ISERR', 'apakah error selain #N/A', '=ISERR(MATCH("Kayu", A2:A5, 0))'],
        ['ISEVEN', 'apakah genap', '=ISEVEN(C2)'],
        ['ISODD', 'apakah ganjil', '=ISODD(C3)'],
        ['ISFORMULA', 'apakah sel berisi rumus', '=ISFORMULA(B2)'],
        ['NA', 'menulis #N/A dengan sengaja ("belum ada data")', '=NA()'],
        ['ERROR.TYPE', 'nomor jenis error (2 = #DIV/0!)', '=ERROR.TYPE(B2/0)']
    ],
    'Tanggal dan jam': [
        ['TODAY', 'tanggal hari ini', '=TODAY()', TANGGAL],
        ['NOW', 'tanggal dan jam sekarang', '=NOW()', TGLJAM],
        ['DATE', 'tanggal dari tahun, bulan, hari', '=DATE(2026, 12, 31)', TANGGAL],
        ['TIME', 'jam dari jam, menit, detik', '=TIME(8, 30, 0)', JAM],
        ['YEAR', 'tahun sebuah tanggal', '=YEAR(E2)'],
        ['MONTH', 'bulan', '=MONTH(E2)'],
        ['DAY', 'tanggal (hari ke berapa dalam bulan)', '=DAY(E3)'],
        ['HOUR', 'jam', '=HOUR(NOW())'],
        ['MINUTE', 'menit', '=MINUTE(NOW())'],
        ['SECOND', 'detik', '=SECOND(TIME(8, 30, 15))'],
        ['WEEKDAY', 'hari ke berapa dalam minggu (1 = Minggu)', '=WEEKDAY(E2)'],
        ['WEEKNUM', 'minggu ke berapa dalam tahun', '=WEEKNUM(E2)'],
        ['ISOWEEKNUM', 'minggu ISO (minggu dimulai Senin)', '=ISOWEEKNUM(E2)'],
        ['EDATE', 'tanggal sekian bulan kemudian', '=EDATE(E2, 3)', TANGGAL],
        ['EOMONTH', 'tanggal terakhir bulan itu', '=EOMONTH(E2, 0)', TANGGAL],
        ['DAYS', 'selisih hari', '=DAYS(E5, E2)'],
        ['DATEDIF', 'selisih dalam hari ("d"), bulan ("m"), atau tahun ("y")', '=DATEDIF(E2, TODAY(), "d")'],
        ['WORKDAY', 'tanggal setelah sekian hari kerja (tanpa Sabtu-Minggu)', '=WORKDAY(E2, 10)', TANGGAL],
        ['NETWORKDAYS', 'banyaknya hari kerja di antara dua tanggal', '=NETWORKDAYS(E2, E5)'],
        ['WORKDAY.INTL', 'seperti WORKDAY, dengan libur pilihan: "0000001" = hanya Minggu libur (proyek 6 hari)', '=WORKDAY.INTL(E2, 10, "0000001")', TANGGAL],
        ['NETWORKDAYS.INTL', 'hari kerja dengan libur pilihan (11 = hanya Minggu)', '=NETWORKDAYS.INTL(E2, E5, 11)'],
        ['DAYS360', 'selisih hari dengan tahun 360 hari (bunga, sewa)', '=DAYS360(E2, E5)'],
        ['YEARFRAC', 'bagian tahun di antara dua tanggal (3 = hari sebenarnya / 365)', '=ROUND(YEARFRAC(E2, E5, 3), 4)'],
        ['DATEVALUE', 'tanggal yang tertulis sebagai teks menjadi tanggal', '=DATEVALUE("27/10/2026")', TANGGAL],
        ['TIMEVALUE', 'jam yang tertulis sebagai teks menjadi jam', '=TIMEVALUE("13:45")', JAM]
    ],
    'Keuangan': [
        ['PMT', 'cicilan per bulan (pokok ditulis negatif)', '=ROUND(PMT(1%, 12, -12000000), 0)'],
        ['FV', 'nilai akhir tabungan rutin', '=ROUND(FV(1%, 12, -1000000), 0)'],
        ['PV', 'nilai sekarang dari cicilan rutin', '=ROUND(PV(1%, 12, -1000000), 0)'],
        ['NPV', 'nilai sekarang arus kas (mulai periode 1)', '=ROUND(NPV(10%, G3:G5) + G2, 0)'],
        ['IRR', 'tingkat pengembalian arus kas', '=ROUND(IRR(G2:G5), 4)'],
        ['NPER', 'berapa bulan sampai lunas: utang 12 juta, cicilan 1,1 juta, bunga 1%', '=ROUND(NPER(1%, -1100000, 12000000), 2)'],
        ['RATE', 'bunga per bulan sebenarnya: pinjam 12 juta, cicil 1,1 juta × 12', '=ROUND(RATE(12, -1100000, 12000000), 4)'],
        ['IPMT', 'bagian bunga di cicilan ke-1', '=ROUND(IPMT(1%, 1, 12, -12000000), 0)'],
        ['PPMT', 'bagian pokok di cicilan ke-1', '=ROUND(PPMT(1%, 1, 12, -12000000), 0)'],
        ['CUMIPMT', 'total bunga cicilan ke-1 sampai ke-6', '=ROUND(CUMIPMT(1%, 12, 12000000, 1, 6, 0), 0)'],
        ['CUMPRINC', 'total pokok cicilan ke-1 sampai ke-6', '=ROUND(CUMPRINC(1%, 12, 12000000, 1, 6, 0), 0)'],
        ['XNPV', 'nilai sekarang arus kas dengan tanggalnya sendiri (termin proyek)', '=ROUND(XNPV(10%, G2:G5, E2:E5), 0)'],
        ['XIRR', 'tingkat pengembalian per tahun dari arus kas bertanggal. Di tabel contoh uangnya kembali dalam 3 minggu, jadi setahunnya sangat besar (110 = 11.000%)', '=ROUND(XIRR(G2:G5, E2:E5), 4)'],
        ['MIRR', 'IRR dengan bunga pinjaman 10% dan bunga simpanan 6%', '=ROUND(MIRR(G2:G5, 10%, 6%), 4)'],
        ['EFFECT', 'bunga efektif setahun dari bunga 12% yang dihitung bulanan', '=ROUND(EFFECT(12%, 12), 4)'],
        ['NOMINAL', 'bunga nominal dari bunga efektif', '=ROUND(NOMINAL(12.68%, 12), 4)'],
        ['SLN', 'penyusutan garis lurus per tahun: excavator 900 juta, sisa 100 juta, 8 tahun', '=SLN(900000000, 100000000, 8)'],
        ['SYD', 'penyusutan jumlah angka tahun, tahun ke-1', '=ROUND(SYD(900000000, 100000000, 8, 1), 0)'],
        ['DDB', 'penyusutan saldo menurun ganda, tahun ke-1', '=DDB(900000000, 100000000, 8, 1)'],
        ['DB', 'penyusutan saldo menurun tetap, tahun ke-1', '=DB(900000000, 100000000, 8, 1)']
    ],
    'Statistik': [
        ['STDEV', 'simpangan baku sampel', '=ROUND(STDEV(C2:C5), 2)'],
        ['STDEV.S', 'sama dengan STDEV', '=ROUND(STDEV.S(C2:C5), 2)'],
        ['STDEV.P', 'simpangan baku populasi', '=ROUND(STDEV.P(C2:C5), 2)'],
        ['VAR', 'varians sampel', '=ROUND(VAR(C2:C5), 2)'],
        ['VAR.S', 'sama dengan VAR', '=ROUND(VAR.S(C2:C5), 2)'],
        ['VAR.P', 'varians populasi', '=ROUND(VAR.P(C2:C5), 2)'],
        ['MODE', 'angka yang paling sering muncul', '=MODE(3, 5, 5, 2)'],
        ['MODE.SNGL', 'sama dengan MODE', '=MODE.SNGL(3, 5, 5, 2)'],
        ['PERCENTILE', 'persentil: 90% harga ada di bawah angka ini', '=PERCENTILE(B2:B5, 0.9)'],
        ['PERCENTILE.INC', 'sama dengan PERCENTILE', '=PERCENTILE.INC(B2:B5, 0.5)'],
        ['PERCENTILE.EXC', 'persentil tanpa ujung 0 dan 1', '=PERCENTILE.EXC(B2:B5, 0.4)'],
        ['QUARTILE', 'kuartil (1 = 25%, 2 = tengah, 3 = 75%)', '=QUARTILE(B2:B5, 1)'],
        ['QUARTILE.INC', 'sama dengan QUARTILE', '=QUARTILE.INC(B2:B5, 3)'],
        ['QUARTILE.EXC', 'kuartil tanpa ujung', '=QUARTILE.EXC(B2:B5, 1)'],
        ['SLOPE', 'kemiringan garis: harga naik berapa per qty', '=ROUND(SLOPE(B2:B5, C2:C5), 2)'],
        ['INTERCEPT', 'titik potong garis di x = 0', '=ROUND(INTERCEPT(B2:B5, C2:C5), 2)'],
        ['FORECAST', 'perkiraan y pada x tertentu dari garis lurus data lama', '=ROUND(FORECAST(4, B2:B5, C2:C5), 0)'],
        ['FORECAST.LINEAR', 'sama dengan FORECAST', '=ROUND(FORECAST.LINEAR(4, B2:B5, C2:C5), 0)'],
        ['TREND', 'nilai garis lurus di x baru (satu sel: nilai pertama)', '=ROUND(TREND(B2:B5, C2:C5, 4), 0)'],
        ['CORREL', 'seberapa searah dua deret (1 = searah, -1 = berlawanan)', '=ROUND(CORREL(B2:B5, C2:C5), 4)'],
        ['AGGREGATE', 'total yang bisa melewati error dan baris tersembunyi (9 = SUM, 6 = lewati error)', '=AGGREGATE(9, 6, B2:B5, B2/0)']
    ]
};

// angka ditulis dengan pemisah ribuan supaya mudah dibaca (586.500); yang lain seperti tampil di sel
const tampil = (r, c) => {
    const v = s.value(r, c);
    return typeof v === 'number' && !s.cellFormat(r, c) ? v.toLocaleString('id-ID', { maximumFractionDigits: 10 }) : s.display(r, c).text;
};

// tabel contoh, lalu satu tabel per kelompok
console.log('**Tabel contoh.** Semua contoh di bawah membaca sheet `Data` ini:\n');
console.log('| | A | B | C | D | E | F | G |\n|---|---|---|---|---|---|---|---|');
for (let r = 0; r <= 4; r++) {
    const isi = [0, 1, 2, 3, 4, 5, 6].map((c) => (r === 1 && c === 5 ? '`"' + s.value(r, c) + '"`' : tampil(r, c)));
    console.log('| ' + (r + 1) + ' | ' + isi.join(' | ') + ' |');
}

let row = 30;
const tercakup = new Set();
for (const [grup, daftar] of Object.entries(GRUP)) {
    console.log('\n**' + grup + '**\n');
    console.log('| Fungsi | Buat apa | Contoh | Hasil |\n|---|---|---|---|');
    for (const [nama, guna, rumus, format] of daftar) {
        if (format) s.setStyle({ r1: row, c1: 0, r2: row, c2: 0 }, { format });
        s.setValues(row, 0, rumus);
        const hasil = tampil(row, 0);
        console.log('| `' + nama + '` | ' + guna + ' | `' + rumus + '` | ' + (hasil === '' ? '(kosong)' : hasil.replace(/\|/g, '\\|')) + ' |');
        tercakup.add(nama);
        row++;
    }
}
const kurang = FUNCTION_NAMES.filter((n) => !tercakup.has(n));
if (kurang.length) throw new Error('fungsi tanpa contoh di dokumentasi: ' + kurang.join(', '));
