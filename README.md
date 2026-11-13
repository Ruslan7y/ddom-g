# Domino 101: Real Table

Gerçek masa hissi veren domino oyunu. İlk mod: **Klassik 101** (1 vs 1 ve 2 vs 2 takım), botlara karşı kariyer modu.
Diller: Azərbaycan, Türkçe, English, Русский.

## APK'yı indir
Her `main` güncellemesinde GitHub Actions APK'yı otomatik derler:
- **Releases** sayfasında en son sürümün altındaki `.apk` dosyasını indir.
- Telefonda "Bilinmeyen kaynaklardan yüklemeye izin ver" seçeneğini aç ve kur.

## Proje yapısı
```
www/                 Oyunun kendisi (HTML/CSS/JS, framework yok)
  js/engine.js       101 kural motoru (dağıtım kontrolleri, pazar, bağlı oyun, nöbet, puanlama, maç)
  js/ai.js           Bot zekâsı: kolay / orta / zor / usta (olasılık örneklemesi + simülasyon)
  js/render.js       Taş çizimi ve masa yerleşimi
  js/app.js          Ekranlar: giriş, menü, oyun, mağaza, ayarlar
  js/i18n.js         4 dil
  js/store.js        Profil, XP, rütbe, coin, mağaza, başarılar
  js/splash.js       5 saniyelik açılış animasyonu
android/             Capacitor Android projesi
tests/               Kural motoru testleri (node tests/engine.test.mjs)
.github/workflows/   APK derleme
```

## Geliştirme
```bash
npm ci
npm test                    # kural motoru + bot testleri
npx cap sync android        # web dosyalarını Android projesine kopyala
cd android && ./gradlew assembleRelease
```
Tarayıcıda denemek için `www` klasörünü herhangi bir statik sunucuyla açabilirsin (`python3 -m http.server -d www`).

## Not: imza anahtarı
`android/app/ddomg-demo.keystore` sadece test APK'ları içindir (güncellemeler üst üste kurulabilsin diye sabit).
Google Play'e yüklemeden önce gizli bir anahtar oluşturulup GitHub Secrets'a taşınmalıdır.

## Yol haritası
1. ✅ Faz 1 — Açılış, giriş (demo), menü, Klassik 101 (1v1, 2v2), botlar, temalar, 4 dil, APK
   ✅ v0.3 — Kariyer haritası: sonsuz aşamalar, adil ve birden çok yolla kazanılabilir eller, yıldızlar
2. Faz 2 — Kariyer dengelemesi, 4 kişilik modun seviyeyle açılması, daha fazla başarı
3. Faz 3 — Firebase: Google/Facebook girişi, tekil takma ad; aynı Wi‑Fi'da çok oyunculu
4. Faz 4 — Telefon modu, internet üzerinden online, gerçek para ile satın alma
