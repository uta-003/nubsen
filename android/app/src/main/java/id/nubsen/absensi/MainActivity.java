package id.nubsen.absensi;

import android.app.AlertDialog;
import android.os.Bundle;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

/**
 * Tombol Back ditangani 100% NATIVE di sini — bukan lagi lewat listener JS plugin
 * App. Sebabnya: AppPlugin memasang OnBackPressedCallback yang SELALU aktif, dan
 * bila listener JS-nya tidak sempat terpasang (jembatan JS lambat/terbengkalai),
 * jalurnya hanya webView.goBack() yang tidak beraksi di SPA — tombol Back terasa
 * "mati" tanpa konfirmasi keluar. Callback milik MainActivity didaftarkan SETELAH
 * super.onCreate() sehingga dispatcher Android memanggil yang ini lebih dulu.
 *
 * Alur: coba minta web menutup modal teratas (via window.__nubsenTutupModal) →
 * kalau tidak ada, tampilkan dialog konfirmasi keluar (native, pasti muncul).
 */
public class MainActivity extends BridgeActivity {

    private AlertDialog dialogKeluar;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (dialogKeluar != null && dialogKeluar.isShowing()) return; // sedang menanyakan

                // 1) Minta halaman web menutup modal teratas (bottom sheet Bantuan,
                //    detail riwayat, dialog konfirmasi, dsb.). '1' = ada yang ditutup.
                final String skrip =
                        "window.__nubsenTutupModal ? String(window.__nubsenTutupModal()) : ''";
                getBridge().getWebView().evaluateJavascript(skrip, hasil -> {
                    if (hasil != null && hasil.contains("1")) return; // web menutup modal → selesai
                    // 2) Tidak ada modal → konfirmasi keluar aplikasi (selalu muncul).
                    if (dialogKeluar != null && dialogKeluar.isShowing()) return;
                    dialogKeluar = new AlertDialog.Builder(MainActivity.this)
                            .setTitle("Keluar dari aplikasi?")
                            .setMessage("Tutup NUBSEN dan keluar dari aplikasi?")
                            .setPositiveButton("Keluar", (d, w) -> {
                                d.dismiss();
                                finishAffinity(); // tutup aplikasi sungguhan
                            })
                            .setNegativeButton("Batal", (d, w) -> d.dismiss())
                            .setOnDismissListener(d -> dialogKeluar = null)
                            .create();
                    dialogKeluar.show();
                });
            }
        });
    }

    @Override
    public void onDestroy() {
        if (dialogKeluar != null && dialogKeluar.isShowing()) dialogKeluar.dismiss();
        dialogKeluar = null;
        super.onDestroy();
    }
}

