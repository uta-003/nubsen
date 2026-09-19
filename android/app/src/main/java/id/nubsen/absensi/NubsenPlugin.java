package id.nubsen.absensi;

import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * Plugin khusus NUBSEN: menyimpan berkas hasil ekspor (Excel/PDF/CSV) LANGSUNG ke
 * folder Unduhan (Downloads) perangkat lewat MediaStore — tanpa lembar Bagikan,
 * tanpa izin tambahan (kontribusi milik aplikasi sendiri di Android 10+).
 * Inilah jalur utama unduhan; plugin Filesystem/Share tetap dipakai sebagai
 * cadangan untuk APK lama yang belum membawa plugin ini.
 */
@CapacitorPlugin(name = "Nubsen")
public class NubsenPlugin extends Plugin {

    @PluginMethod
    public void simpanUnduhan(PluginCall call) {
        String data = call.getString("data");   // base64 tanpa awalan data:
        String nama = call.getString("nama");
        String mime = call.getString("mime", "application/octet-stream");
        if (data == null || data.isEmpty() || nama == null || nama.isEmpty()) {
            call.reject("Data atau nama berkas kosong.");
            return;
        }
        try {
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            Context ctx = getContext();
            Uri uri;
            boolean diFolderUnduhan = false;

            if (Build.VERSION.SDK_INT >= 29) {
                // Android 10+: tulis resmi ke koleksi Downloads lewat MediaStore.
                ContentValues naskah = new ContentValues();
                naskah.put(MediaStore.Downloads.DISPLAY_NAME, nama);
                naskah.put(MediaStore.Downloads.MIME_TYPE, mime);
                naskah.put(MediaStore.Downloads.IS_PENDING, 1);
                uri = ctx.getContentResolver()
                        .insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, naskah);
                if (uri == null) throw new IllegalStateException("Gagal membuat berkas di Unduhan.");
                try (OutputStream os = ctx.getContentResolver().openOutputStream(uri)) {
                    if (os == null) throw new IllegalStateException("Stream Unduhan tidak tersedia.");
                    os.write(bytes);
                    os.flush();
                }
                ContentValues finalisasi = new ContentValues();
                finalisasi.put(MediaStore.Downloads.IS_PENDING, 0);
                ctx.getContentResolver().update(uri, finalisasi, null, null);
                diFolderUnduhan = true;
            } else {
                // Android lama (9-): folder khusus aplikasi (tanpa izin penyimpanan).
                File folder = new File(ctx.getExternalFilesDir(null), "Unduhan");
                if (!folder.exists() && !folder.mkdirs()) {
                    throw new IllegalStateException("Gagal membuat folder Unduhan.");
                }
                File berkas = new File(folder, nama);
                try (FileOutputStream fos = new FileOutputStream(berkas)) {
                    fos.write(bytes);
                    fos.flush();
                }
                uri = Uri.fromFile(berkas);
            }

            JSObject hasil = new JSObject();
            hasil.put("ok", true);
            hasil.put("uri", uri.toString());
            hasil.put("diFolderUnduhan", diFolderUnduhan);
            call.resolve(hasil);
        } catch (Exception e) {
            call.reject("Gagal menyimpan berkas: " + e.getMessage());
        }
    }
}
