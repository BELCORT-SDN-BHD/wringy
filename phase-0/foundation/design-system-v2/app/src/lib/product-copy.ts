// Malaysia-first sample catalog. Draft copy, not professional Malay or Chinese approval.
// Chinese is provisionally Simplified Chinese for Malaysia (zh-Hans-MY).
// en-MY is a provisional demonstrator default, not an approved platform default.
export type ProductLocale = 'en-MY' | 'ms-MY' | 'zh-Hans-MY'
export const productCopy = {
 'en-MY': {
  alertTitle: 'Action required',
  alertDescription: 'Use amber only when you need to act. Background processing alone is not an alert.',
  status: 'Status', nextStep: 'Next step',
  rows: [
   { label: 'Needs your attention', detail: 'A content link is missing. Add the link to continue.', next: 'Add link' },
   { label: 'Processing', detail: 'Checks are running in the background. No action is needed.', next: 'No action needed' },
   { label: 'Failed / Blocked', detail: 'Submission failed. Try again.', next: 'Try again' },
   { label: 'Content approved', detail: 'Content review is complete. This does not mean payment was made.', next: 'View content' },
   { label: 'Not started', detail: 'The draft has not been submitted. There is no current alert.', next: 'Continue draft' },
   { label: 'Data unavailable', detail: 'Data has not been received. Unknown does not mean zero.', next: 'Await data' },
  ],
 },
 'ms-MY': {
  alertTitle: 'Tindakan anda diperlukan',
  alertDescription: 'Gunakan warna ambar hanya apabila anda perlu bertindak. Pemprosesan latar belakang sahaja bukan amaran.',
  status: 'Status', nextStep: 'Langkah seterusnya',
  rows: [
   { label: 'Menunggu tindakan anda', detail: 'Pautan kandungan tiada. Tambah pautan untuk meneruskan.', next: 'Tambah pautan' },
   { label: 'Sedang diproses', detail: 'Semakan sedang berjalan di latar belakang. Tiada tindakan diperlukan.', next: 'Tiada tindakan diperlukan' },
   { label: 'Gagal / Disekat', detail: 'Penghantaran gagal. Sila cuba lagi.', next: 'Cuba lagi' },
   { label: 'Kandungan diluluskan', detail: 'Semakan kandungan telah selesai. Ini tidak bermakna bayaran telah dibuat.', next: 'Lihat kandungan' },
   { label: 'Belum bermula', detail: 'Draf belum dihantar. Tiada amaran buat masa ini.', next: 'Teruskan draf' },
   { label: 'Data belum tersedia', detail: 'Data belum diterima. Data yang belum diketahui bukan bermaksud sifar.', next: 'Tunggu data' },
  ],
 },
 'zh-Hans-MY': {
  alertTitle: '需要您处理',
  alertDescription: '仅在需要您采取行动时使用琥珀色。后台处理中本身不构成提醒。',
  status: '状态', nextStep: '下一步',
  rows: [
   { label: '需要您关注', detail: '缺少内容链接。请添加链接以继续。', next: '添加链接' },
   { label: '处理中', detail: '正在后台进行检查。您无需采取行动。', next: '无需操作' },
   { label: '失败 / 受阻', detail: '提交失败。请重试。', next: '重试' },
   { label: '内容已批准', detail: '内容审核已完成。这不代表款项已支付。', next: '查看内容' },
   { label: '尚未开始', detail: '草稿尚未提交。目前没有提醒。', next: '继续编辑草稿' },
   { label: '数据暂不可用', detail: '尚未收到数据。未知不等于零。', next: '等待数据' },
  ],
 },
} as const
