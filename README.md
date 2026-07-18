# FGİ Kapı Yükleme Teknolojileri San. A.Ş. — Arıza & Bakım Servisi

Bu depo, **arizabakim** sisteminin tüm kaynak kodunu içerir: fabrikaların üretim alanları için arıza bildirimi, bakım anlaşması, teknisyen atama ve yönetim paneli sağlayan web uygulaması.

**Canlı adres:** https://fgiarizabakim.netlify.app

---

## 1. Sistem Mimarisi — Genel Bakış

Sistem üç parçadan oluşur, her biri ayrı bir görev üstlenir:

```
┌─────────────┐     push/commit     ┌─────────────┐     otomatik build     ┌──────────────────┐
│   GitHub    │ ──────────────────> │   Netlify   │ ─────────────────────> │  Canlı Site       │
│ (kaynak kod)│                     │ (hosting +  │                        │ fgiarizabakim     │
│             │                     │  build      │                        │ .netlify.app      │
└─────────────┘                     │  sistemi)   │                        └──────────────────┘
                                     └──────┬──────┘
                                            │ otomatik kurulum
                                            ▼
                                     ┌─────────────┐
                                     │  Netlify    │
                                     │  Database   │
                                     │ (Postgres)  │
                                     └─────────────┘
```

- **GitHub** — kodun tek doğru kaynağı. Her dosya değişikliği burada saklanır, geçmişi tutulur.
- **Netlify** — GitHub'daki depoyu izler. Bir değişiklik olduğunda otomatik olarak kodu indirir, gerekli paketleri kurar ve siteyi yayınlar (bu işleme **deploy** denir).
- **Netlify Database** — gerçek, kalıcı bir veritabanı (Postgres). Servis kayıtları, bakım anlaşmaları ve teknisyen bilgileri burada saklanır. Kod değişse de bu veriler silinmez.

**Önemli:** GitHub'ı silsen bile site ve veritabanı çalışmaya devam eder (Netlify en son yayınlanan hâli tutar). GitHub sadece *gelecekteki* güncellemeler için gereklidir.

---

## 2. Neler Kurduk — Adım Adım Geçmiş

1. **Netlify hesabı ve site oluşturma** — `fgiarizabakim` adlı bir Netlify projesi açıldı (`fgiarizabakim.netlify.app` adresi otomatik verildi).
2. **GitHub hesabı ve depo oluşturma** — `karabacakseref` kullanıcısı altında bir GitHub deposu açıldı, dosyalar oraya yüklendi.
3. **Netlify ↔ GitHub bağlantısı** — Netlify projesinin *Site configuration → Build & deploy → Continuous deployment* kısmından GitHub deposu bağlandı. Bu bağlantı kurulduktan sonra GitHub'a her yükleme otomatik olarak siteyi günceller.
4. **Veritabanı kurulumu** — `netlify/database/migrations/` klasöründeki `migration.sql` dosyası, ilk deploy sırasında çalışıp `kv_store` adlı tabloyu oluşturdu. Bu adım bir kere çalıştı, bir daha tekrar etmiyor.
5. **Uygulama kodu** — Tek bir `index.html` dosyası: site tasarımı, formlar, yönetici paneli, teknisyen paneli — hepsi bu dosyanın içinde (HTML + CSS + JavaScript).
6. **Arka uç (backend) fonksiyonu** — `netlify/functions/kv.js`: tarayıcının veritabanıyla güvenli şekilde konuşmasını sağlayan küçük bir sunucu kodu.
7. **Kritik hata düzeltmesi** — İlk sürümde, yeni bir kayıt oluşturulurken mevcut veriler önce kontrol edilmiyordu, bu da eski kayıtların üzerine yazılmasına yol açıyordu. Bu düzeltildi: artık her yeni kayıttan önce veritabanı okunuyor, üzerine ekleniyor.

---

## 3. Dosya Yapısı ve Görevleri

```
├── index.html                                    → Sitenin tamamı (arayüz + mantık)
├── netlify.toml                                   → Netlify'a "nasıl çalış" talimatı
├── package.json                                   → Gerekli paketlerin listesi
└── netlify/
    ├── functions/
    │   ├── kv.js                                  → Veritabanı okuma/yazma arayüzü (API)
    │   └── photo.js                                → Fotoğraf depolama arayüzü (⚠️ henüz GitHub'a yüklenmedi, bkz. Bölüm 8)
    └── database/
        └── migrations/
            └── 20260718000001_init/
                └── migration.sql                  → Veritabanı tablosunu oluşturan tek seferlik komut
```

| Dosya | Ne işe yarar |
|---|---|
| `index.html` | Ziyaretçinin gördüğü her şey: ana sayfa, Servis Kaydı / Bakım Anlaşması formları, Yönetici Girişi, Teknisyen Girişi. |
| `netlify.toml` | Netlify'a hangi klasörün yayınlanacağını, fonksiyonların nerede olduğunu söyler. |
| `package.json` | `@netlify/database` (ve eklendiğinde `@netlify/blobs`) gibi paketlerin otomatik kurulmasını sağlar. |
| `netlify/functions/kv.js` | Tarayıcı `/api/kv?key=...` adresine istek attığında çalışır; veritabanına yazar/okur. |
| `netlify/functions/photo.js` | Fotoğrafları veritabanının dışında, ayrı bir depoda (Netlify Blobs) tutan kod. |
| `netlify/database/migrations/.../migration.sql` | `kv_store` tablosunu oluşturur: `key`, `value`, `updated_at` sütunları. |

---

## 4. Veri Nasıl Saklanıyor

Basit bir **anahtar–değer** yapısı kullanıyoruz. Üç ana "anahtar" var:

| Anahtar (key) | İçeriği |
|---|---|
| `arizabakim:tickets` | Tüm servis kayıtları (JSON listesi olarak, tek satırda) |
| `arizabakim:agreements` | Tüm bakım anlaşması başvuruları |
| `arizabakim:teknisyenler` | Teknisyen listesi (kullanıcı adı, şifre, durum) |

Her biri veritabanında **tek bir satırda**, uzun bir metin (JSON) olarak duruyor. Bunu Netlify'ın **Database** panelinden görebilirsin (bkz. Bölüm 7).

---

## 5. Değişiklik Yapınca Sistem Nasıl Güncelleniyor

```
1. Claude (veya sen) index.html / diğer dosyalarda değişiklik yapar
2. Güncellenmiş dosya(lar) GitHub'a yüklenir ("Commit changes")
3. GitHub, Netlify'a otomatik haber verir (webhook)
4. Netlify:
   a. Kodu indirir
   b. package.json'daki paketleri kurar
   c. Veritabanı migration'larını kontrol eder (yeni varsa çalıştırır)
   d. Siteyi yeni haliyle yayınlar
5. 1-2 dakika içinde fgiarizabakim.netlify.app güncel hâliyle çalışır
```

**Önemli:** Veritabanındaki kayıtlar (servis kayıtları, anlaşmalar, teknisyenler) bu süreçten **etkilenmez** — kod değişse de veri olduğu gibi kalır.

**Kredi tasarrufu için:** Birden fazla dosya değişikliği varsa hepsini **tek seferde** yükleyip **tek** "Commit changes" yapın — her yükleme bir "deploy" tetikler ve bu kredi harcar (bkz. Bölüm 9).

---

## 6. Giriş Bilgileri

| Rol | Nasıl girilir |
|---|---|
| **Yönetici (Admin)** | Site üstünde "Kullanıcı Girişi" → kullanıcı adı: `admin`, şifre: `admin123` |
| **Teknisyen** | Yönetici, "Teknisyenler" sekmesinden her teknisyene özel bir kullanıcı adı/şifre tanımlar. Teknisyen aynı "Kullanıcı Girişi" ekranından kendi bilgileriyle girer. |

> ⚠️ Demo amaçlı basit tutuldu. Gerçek kullanımda şifrelerin güvenli şekilde (hash'lenerek) saklanması önerilir — bu ileride yapılabilecek bir geliştirme.

---

## 7. Veritabanını Görüntüleme

1. **app.netlify.com/projects/fgiarizabakim** adresine git
2. Sol menüden (mobilde ☰) **"Database"** sekmesine gir
3. Tabloyu (`kv_store`) aç, satırları görüntüle/düzenle/sil

---

## 8. Bilinen Eksikler / Yapılacaklar Listesi

- [ ] **Fotoğraf ekleme** — Kod hazır (`netlify/functions/photo.js`) ama henüz GitHub'a yüklenmedi. Yüklenip `package.json`'a `@netlify/blobs` eklenince aktif olacak.
- [ ] **Gerçek SMS/e-posta gönderimi** — Şu an ekranda "gönderildi" gibi gösteriliyor ama gerçek telefon/e-postaya gitmiyor (demo/simülasyon). Gerçek gönderim için bir servis (örn. Netgsm, SendGrid) ve ek bir arka uç kodu gerekiyor.
- [ ] **Fatura modülü** — Henüz yok, ileride eklenebilir.
- [ ] **Şifre güvenliği** — Teknisyen/admin şifreleri şu an düz metin olarak saklanıyor, üretim ortamı için hash'lenmesi önerilir.

---

## 9. Kredi / Kullanım Notları (Netlify)

- Netlify **kredi tabanlı** çalışıyor: aylık 300 kredi (ücretsiz pakette).
- Her **deploy** (GitHub'a yükleme) **15 kredi** harcıyor.
- Site trafiği (ziyaret, form gönderimi, veritabanı işlemleri) çok daha az kredi harcıyor — asıl dikkat edilecek şey deploy sayısı.
- **Öneri:** Değişiklikleri biriktirip tek seferde yükleyin.
- Kredi ay sonunda sıfırlanıyor. Yetmezse: Personal ($9/ay, 1000 kredi) veya Pro ($20/ay, 3000 kredi) paketlerine geçilebilir.

---

## 10. Kendi Alan Adınızı Bağlama (örn. fgi.com.tr altında)

Mevcut kurumsal siteniz (`fgi.com.tr`) varsa, onun **yerine geçmemesi** için bir **alt alan adı** kullanmanız önerilir (örn. `arizabakim.fgi.com.tr`).

**Adımlar:**
1. **app.netlify.com/projects/fgiarizabakim** → **Domain management** → **"Add a domain"**
2. İstediğiniz adresi yazın (örn. `arizabakim.fgi.com.tr`)
3. Netlify size bir **DNS kaydı** (genelde bir CNAME) verecek
4. Alan adınızı yönettiğiniz yerde (Natro, GoDaddy, vb.) bu kaydı `fgi.com.tr`'nin DNS ayarlarına ekleyin
5. Birkaç saat içinde (bazen dakikalar) yeni adres de siteyi açacak — `fgiarizabakim.netlify.app` de çalışmaya devam eder, ikisi birden erişilebilir olur
6. Netlify'da yeni adresi **"Primary domain"** yaparsanız, eski adrese gelenler otomatik yönlendirilir

---

## 11. Sorun Giderme (Bugüne Kadar Karşılaştıklarımız)

| Sorun | Sebep | Çözüm |
|---|---|---|
| Kayıtlar aniden kayboldu, sıra numarası hep "001" veriyordu | Yeni kayıt oluşturulurken mevcut veri önce okunmuyordu, üzerine yazılıyordu | Düzeltildi — her kayıttan önce veritabanı okunuyor |
| Sürükle-bırak ile yüklenen dosyada veritabanı çalışmadı | Sürükle-bırak, `npm install` çalıştırmıyor, paketler kurulmuyor | GitHub bağlantısı kullanılarak çözüldü (otomatik build) |
| Dosya adı yanlış yazıldı (`netfly.toml`) | Mobil klavye/otomatik çeviri | Dosya adı elle, harf harf kontrol edilerek düzeltildi |
| Sayfa mobilde yana kayıyordu | Üst menü/sekme çubuğu dar ekrana sığmıyordu | CSS ile mobil uyumlu hâle getirildi |

---

## 12. Yapı Özeti (Tek Bakışta)

- **Kod:** GitHub → `karabacakseref/Fgiarizabakim` deposu
- **Hosting:** Netlify → `fgiarizabakim.netlify.app`
- **Veritabanı:** Netlify Database (Postgres), otomatik kuruldu
- **Güncelleme:** GitHub'a dosya yükle → Netlify otomatik yayınlar
- **Yönetim:** `admin` / `admin123` ile giriş, kayıtları yönet, teknisyen ekle
- **Rapor:** Yönetici panelinden yıl/tarih filtreli Excel raporu indirilebilir
