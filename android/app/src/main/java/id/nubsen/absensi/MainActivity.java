package id.nubsen.absensi;

import android.os.Bundle;

import androidx.activity.OnBackPressedCallback;

import com.capacitorjs.plugins.splashscreen.SplashScreenPlugin;
import com.getcapacitor.BridgeActivity;

/**
 * Tombol Back ditangani 100% NATIVE di sini — bukan lagi lewat listener JS plugin
 * App. Sebabnya: AppPlugin memasang OnBackPressedCallback yang SELALU aktif, dan
 * bila listener JS-nya tidak sempat terpasang (jembatan JS lambat/terbengkalai),
 * jalurnya hanya webView.goBack() yang tidak beraksi di SPA. Callback milik
 * MainActivity didaftarkan SETELAH super.onCreate() sehingga dispatcher Android
 * memanggil yang ini lebih dulu.
 *
 * Alur TANPA dialog konfirmasi keluar: minta halaman web menangani Back (via
 * window.__nubsenBack — tutup modal → kembali ke Beranda → keluar aplikasi
 * langsung); bila web belum siap, aplikasi langsung ditutup tanpa dialog apa pun.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // WAJIB sebelum super.onCreate(): bridge dibuat di dalam super.onCreate()
        // dan membaca daftar plugin yang terdaftar HINGGA saat itu. Pemanggilan
        // setelahnya terlambat → plugin "Nubsen" tidak pernah hidup (keluar &
        // unduhan gagal "not implemented").
        registerPlugin(NubsenPlugin.class);
        registerPlugin(SplashScreenPlugin.class);
        super.onCreate(savedInstanceState);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                // 1) Serahkan ke halaman web: tutup modal teratas → pindah halaman
                //    (mis. Panel Admin kembali ke Beranda) → keluar aplikasi
                //    langsung (tanpa dialog konfirmasi). '1' = web menangani sendiri.
                final String skrip =
                        "window.__nubsenBack ? String(window.__nubsenBack()) : ''";
                getBridge().getWebView().evaluateJavascript(skrip, hasil -> {
                    if (hasil != null && hasil.contains("1")) return;
                    // 2) Web belum siap / tidak menangani → tutup aplikasi langsung.
                    finishAffinity();
                });
            }
        });
    }
}


