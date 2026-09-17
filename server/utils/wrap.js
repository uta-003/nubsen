// Pembungkus handler async untuk Express 4.
// Express 4 tidak menangkap promise yang ditolak, sehingga kesalahan pada
// handler async harus diteruskan manual ke middleware error terpusat
// (lihat app.use((err, req, res, next) => ...) di server/index.js).
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

export default wrap
