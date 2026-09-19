// src/utils/native.js
import { Capacitor } from "@capacitor/core";
function diAplikasi() {
  try {
    return !!Capacitor.isNativePlatform?.();
  } catch {
    return false;
  }
}
var pemuat = {
  App: () => import("@capacitor/app").then((m) => m.App),
  Filesystem: () => import("@capacitor/filesystem"),
  Share: () => import("@capacitor/share").then((m) => m.Share),
  LocalNotifications: () => import("@capacitor/local-notifications").then((m) => m.LocalNotifications)
};
var cache = /* @__PURE__ */ new Map();
function muatPlugin(nama) {
  const ambil = pemuat[nama];
  if (!ambil) return Promise.reject(new Error(`Plugin ${nama} tidak dikenal.`));
  if (!cache.has(nama)) cache.set(nama, ambil());
  return cache.get(nama);
}

// src/utils/notif.js
var KANAL = "nubsen";
var ID_PENGINGAT_MASUK = 9001;
var ID_PENGINGAT_PULANG = 9002;
var IKON_KECIL = "ic_stat_nubsen";
var WARNA_IKON = "#4F46E5";
function idNotifikasi(asal) {
  const n = Number(asal);
  if (Number.isInteger(n) && n > 0 && n < 2147483647) return n;
  const teks = String(asal ?? "");
  let hash = 0;
  for (let i = 0; i < teks.length; i++) hash = (hash * 31 + teks.charCodeAt(i)) % 2e9;
  return hash || 1;
}
function menitDariJam(hhmm) {
  const cocok = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(hhmm || "").trim());
  if (!cocok) return null;
  return Number(cocok[1]) * 60 + Number(cocok[2]);
}
function geserJam(hhmm, deltaMenit) {
  const menit = menitDariJam(hhmm);
  if (menit == null) return null;
  const total = Math.min(23 * 60 + 59, Math.max(0, menit + deltaMenit));
  return { jam: Math.floor(total / 60), menit: total % 60 };
}
var kanalSiap = false;
async function pastikanKanal(LN) {
  if (kanalSiap) return;
  try {
    await LN.createChannel({
      id: KANAL,
      name: "Notifikasi NUBSEN",
      description: "Pengingat absen, pengumuman, dan keputusan izin/lembur.",
      importance: 5,
      // IMPORTANCE_HIGH → muncul sebagai heads-up di layar
      visibility: 1,
      // VISIBILITY_PUBLIC → isi tampil di layar kunci
      vibration: true,
      lights: true,
      lightColor: WARNA_IKON
    });
  } catch {
  }
  kanalSiap = true;
}
async function siapkanNotifikasi() {
  if (diAplikasi()) {
    try {
      const LN = await muatPlugin("LocalNotifications");
      let izin2 = await LN.checkPermissions().catch(() => null);
      if (!izin2 || izin2.display !== "granted") {
        izin2 = await LN.requestPermissions().catch(() => izin2);
      }
      await pastikanKanal(LN);
      return izin2?.display === "granted" ? "aplikasi" : "tidak-diizinkan";
    } catch {
      return "tidak-diizinkan";
    }
  }
  if (typeof window === "undefined" || !("Notification" in window)) return "tidak-didukung";
  if (Notification.permission === "granted") return "web";
  if (Notification.permission === "denied") return "tidak-diizinkan";
  const izin = await Notification.requestPermission().catch(() => "denied");
  return izin === "granted" ? "web" : "tidak-diizinkan";
}
async function tampilkanDiPeramban({ judul, pesan, id }) {
  const badan = [judul, pesan].filter(Boolean).join("\n");
  const opsi = {
    body: badan,
    icon: "/logo-icon.png",
    badge: "/icons/icon-192.png",
    tag: `notif-${id}`,
    data: { url: `${window.location.origin}/#notifikasi` }
  };
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.();
    if (reg) {
      await reg.showNotification(judul || "NUBSEN", opsi);
      return true;
    }
  } catch {
  }
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(judul || "NUBSEN", opsi);
    return true;
  }
  return false;
}
async function tampilkanNotifikasi({ id = Date.now(), judul = "NUBSEN", pesan = "", jenis = "info" }) {
  if (diAplikasi()) {
    try {
      const LN = await muatPlugin("LocalNotifications");
      await pastikanKanal(LN);
      const izin = await LN.checkPermissions().catch(() => null);
      if (izin && izin.display !== "granted") return false;
      await LN.schedule({
        notifications: [
          {
            id: idNotifikasi(id),
            title: judul || "NUBSEN",
            body: pesan || "",
            channelId: KANAL,
            smallIcon: IKON_KECIL,
            iconColor: WARNA_IKON,
            group: "nubsen",
            extra: { jenis },
            // Beberapa saat ke depan: langsung tampil, tanpa alarm berulang.
            schedule: { at: new Date(Date.now() + 1200) }
          }
        ]
      });
      return true;
    } catch {
      return false;
    }
  }
  return tampilkanDiPeramban({ judul, pesan, id });
}
async function jadwalkanPengingat({ aktif, jamMasukBatas = "08:15", jamPulang = "17:00" }) {
  if (!diAplikasi()) return false;
  const LN = await muatPlugin("LocalNotifications");
  await LN.cancel({ notifications: [{ id: ID_PENGINGAT_MASUK }, { id: ID_PENGINGAT_PULANG }] }).catch(() => {
  });
  if (!aktif) return true;
  await pastikanKanal(LN);
  const daftar = [];
  const masuk = geserJam(jamMasukBatas, -5);
  if (masuk) {
    daftar.push({
      id: ID_PENGINGAT_MASUK,
      title: "\u23F0 Absen masuk",
      body: `Batas absen masuk ${jamMasukBatas}. Jangan lupa selfie + GPS.`,
      ketika: masuk
    });
  }
  const pulang = geserJam(jamPulang, 0);
  if (pulang) {
    daftar.push({
      id: ID_PENGINGAT_PULANG,
      title: "\u{1F3C3} Absen pulang",
      body: `Sudah jam ${jamPulang}. Jangan lupa absen pulang \u2014 hati-hati di jalan!`,
      ketika: pulang
    });
  }
  if (!daftar.length) return false;
  await LN.schedule({
    notifications: daftar.map((d) => ({
      id: d.id,
      title: d.title,
      body: d.body,
      channelId: KANAL,
      smallIcon: IKON_KECIL,
      iconColor: WARNA_IKON,
      group: "nubsen",
      // { on } = penjadwalan gaya cron: plugin menghitung waktu berikutnya, lalu
      // menjadwalkan ulang sendiri setelah berbunyi (tiap hari pada jam itu).
      schedule: { on: { hour: d.ketika.jam, minute: d.ketika.menit }, allowWhileIdle: true }
    }))
  });
  return true;
}
function batalkanPengingat() {
  return jadwalkanPengingat({ aktif: false });
}
export {
  ID_PENGINGAT_MASUK,
  ID_PENGINGAT_PULANG,
  KANAL,
  batalkanPengingat,
  geserJam,
  idNotifikasi,
  jadwalkanPengingat,
  menitDariJam,
  siapkanNotifikasi,
  tampilkanNotifikasi
};
