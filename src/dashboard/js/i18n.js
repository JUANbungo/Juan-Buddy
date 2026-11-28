/* Juan Buddy i18n — English, Filipino, Thai, Bahasa Indonesia, Japanese, Chinese, Vietnamese.
 * Dictionary is keyed by the exact English string; t() falls back to the key itself,
 * so any untranslated string still renders as English.
 */
(function () {
  'use strict';

  const LANGS = [
    { id: 'en', label: 'English' },
    { id: 'fil', label: 'Filipino' },
    { id: 'th', label: 'ไทย' },
    { id: 'id', label: 'Bahasa Indonesia' },
    { id: 'ja', label: '日本語' },
    { id: 'zh', label: '中文' },
    { id: 'vi', label: 'Tiếng Việt' },
  ];

  const DICT = {
    /* ---- Splash / title screen ---- */
    'Your cozy idle pet buddy 🐾': {
      fil: 'Ang cozy mong idle pet buddy 🐾',
      th: 'เพื่อนสัตว์เลี้ยงสุดชิลของคุณ 🐾',
      id: 'Teman peliharaan idlemu yang nyaman 🐾',
      ja: 'あなたの癒し系アイドルペット 🐾',
      zh: '你悠闲的治愈系宠物伙伴 🐾',
      vi: 'Thú cưng nhàn rỗi dễ thương của bạn 🐾',
    },
    'Loading…': {
      fil: 'Naglo-load…', th: 'กำลังโหลด…', id: 'Memuat…', ja: '読み込み中…', zh: '加载中…', vi: 'Đang tải…',
    },
    'Ready!': {
      fil: 'Handa na!', th: 'พร้อมแล้ว!', id: 'Siap!', ja: '準備完了！', zh: '准备好了！', vi: 'Sẵn sàng!',
    },
    '▶ Start': {
      fil: '▶ Simulan', th: '▶ เริ่ม', id: '▶ Mulai', ja: '▶ スタート', zh: '▶ 开始', vi: '▶ Bắt đầu',
    },
    '✖ Exit': {
      fil: '✖ Lumabas', th: '✖ ออก', id: '✖ Keluar', ja: '✖ 終了', zh: '✖ 退出', vi: '✖ Thoát',
    },
    '📝 Credits': {
      fil: '📝 Mga Kredit', th: '📝 เครดิต', id: '📝 Kredit', ja: '📝 クレジット', zh: '📝 制作人员', vi: '📝 Thông tin',
    },
    '🔄 Updates': {
      fil: '🔄 Mga Update', th: '🔄 อัปเดต', id: '🔄 Pembaruan', ja: '🔄 アップデート', zh: '🔄 更新', vi: '🔄 Cập nhật',
    },
    'Created & developed by Juan Bungo': {
      fil: 'Ginawa at lininang ni Juan Bungo',
      th: 'สร้างและพัฒนาโดย Juan Bungo',
      id: 'Dibuat & dikembangkan oleh Juan Bungo',
      ja: '制作・開発：Juan Bungo',
      zh: '由 Juan Bungo 制作开发',
      vi: 'Được tạo & phát triển bởi Juan Bungo',
    },
    '← Back': {
      fil: '← Bumalik', th: '← ย้อนกลับ', id: '← Kembali', ja: '← 戻る', zh: '← 返回', vi: '← Quay lại',
    },
    '🌐 Language': {
      fil: '🌐 Wika', th: '🌐 ภาษา', id: '🌐 Bahasa', ja: '🌐 言語', zh: '🌐 语言', vi: '🌐 Ngôn ngữ',
    },

    /* ---- Stage menu / scenes ---- */
    'Menu': { fil: 'Menu', th: 'เมนู', id: 'Menu', ja: 'メニュー', zh: '菜单', vi: 'Menu' },
    'Delicacies': { fil: 'Pagkain', th: 'อาหาร', id: 'Makanan', ja: 'ごはん', zh: '美食', vi: 'Món ăn' },
    'Activities': { fil: 'Mga Gawain', th: 'กิจกรรม', id: 'Aktivitas', ja: 'アクティビティ', zh: '活动', vi: 'Hoạt động' },
    'Shop': { fil: 'Tindahan', th: 'ร้านค้า', id: 'Toko', ja: 'ショップ', zh: '商店', vi: 'Cửa hàng' },
    'Pet Shop': { fil: 'Pet Shop', th: 'ร้านสัตว์เลี้ยง', id: 'Toko Peliharaan', ja: 'ペットショップ', zh: '宠物商店', vi: 'Shop thú cưng' },
    'Battle': { fil: 'Laban', th: 'ต่อสู้', id: 'Tempur', ja: 'バトル', zh: '战斗', vi: 'Chiến đấu' },
    'Path': { fil: 'Landas', th: 'เส้นทาง', id: 'Jalur', ja: '運命の道', zh: '命运之路', vi: 'Con đường' },
    'Gacha': { fil: 'Gacha', th: 'กาชา', id: 'Gacha', ja: 'ガチャ', zh: '扭蛋', vi: 'Gacha' },
    'Buddies': { fil: 'Mga Kaibigan', th: 'เพื่อน', id: 'Teman', ja: 'なかま', zh: '伙伴', vi: 'Bạn thân' },
    'Life': { fil: 'Buhay', th: 'ชีวิต', id: 'Hidup', ja: 'ライフ', zh: '生活', vi: 'Cuộc sống' },
    'Options': { fil: 'Opsyon', th: 'ตั้งค่า', id: 'Pengaturan', ja: '設定', zh: '设置', vi: 'Tùy chọn' },
    'Farm': { fil: 'Bukid', th: 'ฟาร์ม', id: 'Kebun', ja: '農場', zh: '农场', vi: 'Nông trại' },
    'Edit Home': { fil: 'I-edit ang Tahanan', th: 'แก้ไขบ้าน', id: 'Ubah Rumah', ja: 'おうち編集', zh: '编辑家', vi: 'Sửa nhà' },
    '🏠 Home': { fil: '🏠 Tahanan', th: '🏠 บ้าน', id: '🏠 Beranda', ja: '🏠 おうち', zh: '🏠 家', vi: '🏠 Nhà' },
    '🌾 Farm': { fil: '🌾 Bukid', th: '🌾 ฟาร์ม', id: '🌾 Kebun', ja: '🌾 農場', zh: '🌾 农场', vi: '🌾 Nông trại' },
    '🛠️ Edit Home': { fil: '🛠️ I-edit ang Tahanan', th: '🛠️ แก้ไขบ้าน', id: '🛠️ Ubah Rumah', ja: '🛠️ おうち編集', zh: '🛠️ 编辑家', vi: '🛠️ Sửa nhà' },
    'Tap pet = greet 💖 · Tap floor = walk 🚶 · Tap 💩💧 = clean it 🧹': {
      fil: 'Tapik ang pet = bati 💖 · Tapik ang sahig = lakad 🚶 · Tapik ang 💩💧 = linisin 🧹',
      th: 'แตะสัตว์เลี้ยง = ทัก 💖 · แตะพื้น = เดิน 🚶 · แตะ 💩💧 = ทำความสะอาด 🧹',
      id: 'Ketuk peliharaan = sapa 💖 · Ketuk lantai = jalan 🚶 · Ketuk 💩💧 = bersihkan 🧹',
      ja: 'ペットをタップ = 挨拶 💖 · 床をタップ = 散歩 🚶 · 💩💧 をタップ = 掃除 🧹',
      zh: '点宠物 = 打招呼 💖 · 点地板 = 散步 🚶 · 点 💩💧 = 清理 🧹',
      vi: 'Chạm thú = chào 💖 · Chạm sàn = đi bộ 🚶 · Chạm 💩💧 = dọn dẹp 🧹',
    },
    'Drag furniture, then save.': {
      fil: 'Hilahin ang muwebles, tapos i-save.', th: 'ลากเฟอร์นิเจอร์แล้วบันทึก',
      id: 'Geser furnitur, lalu simpan.', ja: '家具をドラッグして保存。', zh: '拖动家具，然后保存。', vi: 'Kéo nội thất, rồi lưu.',
    },
    'Save Layout': {
      fil: 'I-save ang Layout', th: 'บันทึกเลย์เอาต์', id: 'Simpan Tata Letak', ja: 'レイアウト保存', zh: '保存布局', vi: 'Lưu bố cục',
    },
    'Cancel': { fil: 'Kanselahin', th: 'ยกเลิก', id: 'Batal', ja: 'キャンセル', zh: '取消', vi: 'Hủy' },
    'Stay in Park': {
      fil: 'Manatili sa Park', th: 'อยู่ในสวน', id: 'Tetap di Taman', ja: '公園にいる', zh: '留在公园', vi: 'Ở lại công viên',
    },

    /* ---- Care meters ---- */
    'Hunger': { fil: 'Gutom', th: 'หิว', id: 'Lapar', ja: 'おなか', zh: '饥饿', vi: 'Đói' },
    'Happiness': { fil: 'Kaligayahan', th: 'ความสุข', id: 'Kebahagiaan', ja: 'きげん', zh: '开心', vi: 'Vui vẻ' },
    'Energy': { fil: 'Lakas', th: 'พลังงาน', id: 'Energi', ja: 'げんき', zh: '精力', vi: 'Năng lượng' },

    /* ---- Panels ---- */
    '🍜 Delicacies': { fil: '🍜 Pagkain', th: '🍜 อาหาร', id: '🍜 Makanan', ja: '🍜 ごはん', zh: '🍜 美食', vi: '🍜 Món ăn' },
    '— feed your buddy world foods': {
      fil: '— pakainin ang buddy ng pagkain mula sa buong mundo',
      th: '— เลี้ยงเพื่อนด้วยอาหารจากทั่วโลก',
      id: '— beri temanmu makanan dari seluruh dunia',
      ja: '— 世界の料理をペットにあげよう',
      zh: '— 喂你的伙伴世界各国美食',
      vi: '— cho bạn ăn món ăn khắp thế giới',
    },
    'Search foods... (e.g. pad thai, samosa)': {
      fil: 'Hanapin ang pagkain... (hal. pad thai, samosa)',
      th: 'ค้นหาอาหาร... (เช่น pad thai, samosa)',
      id: 'Cari makanan... (mis. pad thai, samosa)',
      ja: '料理を検索...（例：パッタイ、サモサ）',
      zh: '搜索美食...（如 pad thai、samosa）',
      vi: 'Tìm món ăn... (vd. pad thai, samosa)',
    },
    '🎯 Activities': { fil: '🎯 Mga Gawain', th: '🎯 กิจกรรม', id: '🎯 Aktivitas', ja: '🎯 アクティビティ', zh: '🎯 活动', vi: '🎯 Hoạt động' },
    '— earn extra coins & XP': {
      fil: '— kumita ng dagdag na coins at XP', th: '— หาเหรียญและ XP เพิ่ม',
      id: '— dapatkan koin & XP ekstra', ja: '— コインとXPを稼ごう', zh: '— 赚取额外金币和经验', vi: '— kiếm thêm xu & XP',
    },
    '🛠️ Shop': { fil: '🛠️ Tindahan', th: '🛠️ ร้านค้า', id: '🛠️ Toko', ja: '🛠️ ショップ', zh: '🛠️ 商店', vi: '🛠️ Cửa hàng' },
    '🎁 Daily Bonus': { fil: '🎁 Bonus Araw-araw', th: '🎁 โบนัสรายวัน', id: '🎁 Bonus Harian', ja: '🎁 デイリーボーナス', zh: '🎁 每日奖励', vi: '🎁 Thưởng hằng ngày' },
    '🎁 Claim Daily Bonus': {
      fil: '🎁 Kunin ang Bonus Araw-araw', th: '🎁 รับโบนัสรายวัน', id: '🎁 Klaim Bonus Harian',
      ja: '🎁 ボーナスを受け取る', zh: '🎁 领取每日奖励', vi: '🎁 Nhận thưởng hằng ngày',
    },
    '🧴 Pet Skins': { fil: '🧴 Pet Skins', th: '🧴 สกินสัตว์เลี้ยง', id: '🧴 Skin Peliharaan', ja: '🧴 ペットスキン', zh: '🧴 宠物皮肤', vi: '🧴 Skin thú cưng' },
    '🏆 Achievements': { fil: '🏆 Mga Tagumpay', th: '🏆 ความสำเร็จ', id: '🏆 Pencapaian', ja: '🏆 実績', zh: '🏆 成就', vi: '🏆 Thành tựu' },
    '‹ Prev': { fil: '‹ Nakaraan', th: '‹ ก่อนหน้า', id: '‹ Sebelumnya', ja: '‹ 前へ', zh: '‹ 上一页', vi: '‹ Trước' },
    'Next ›': { fil: 'Susunod ›', th: 'ถัดไป ›', id: 'Berikutnya ›', ja: '次へ ›', zh: '下一页 ›', vi: 'Sau ›' },
    '💾 Save Code': { fil: '💾 Save Code', th: '💾 รหัสเซฟ', id: '💾 Kode Simpanan', ja: '💾 セーブコード', zh: '💾 存档码', vi: '💾 Mã lưu' },
    '— backup or move your buddy': {
      fil: '— i-backup o ilipat ang buddy mo', th: '— สำรองหรือย้ายเพื่อนของคุณ',
      id: '— cadangkan atau pindahkan temanmu', ja: '— バックアップやお引っ越しに', zh: '— 备份或转移你的伙伴', vi: '— sao lưu hoặc chuyển bạn của bạn',
    },
    '📤 Export Save Code': {
      fil: '📤 I-export ang Save Code', th: '📤 ส่งออกรหัสเซฟ', id: '📤 Ekspor Kode Simpanan',
      ja: '📤 セーブコード書き出し', zh: '📤 导出存档码', vi: '📤 Xuất mã lưu',
    },
    '📥 Import Save Code': {
      fil: '📥 I-import ang Save Code', th: '📥 นำเข้ารหัสเซฟ', id: '📥 Impor Kode Simpanan',
      ja: '📥 セーブコード読み込み', zh: '📥 导入存档码', vi: '📥 Nhập mã lưu',
    },
    '🎦 Cosmetic Wish': { fil: '🎦 Cosmetic Wish', th: '🎭 คำขอสกิน', id: '🎭 Wish Kosmetik', ja: '🎭 コスチュームガチャ', zh: '🎭 皮肤许愿', vi: '🎭 Ước cosmetic' },
    '— skins & coin showers · chase the 0.0001%': {
      fil: '— mga skin at coin shower · habulin ang 0.0001%', th: '— สกินและฝนเหรียน · ล่าจาก 0.0001%',
      id: '— skin & hujan koin · kejar 0.0001%', ja: '— スキンとコインシャワー · 0.0001%を狙え！',
      zh: '— 皮肤与金币雨 · 冲击0.0001%', vi: '— skin & mưa xu · săn 0.0001%',
    },
    '🎁 Free Daily Pull': {
      fil: '🎁 Libreng Daily Pull', th: '🎁 สุ่มฟรีประจำวัน', id: '🎁 Putaran Harian Gratis',
      ja: '🎁 毎日無料ガチャ', zh: '🎁 每日免费抽', vi: '🎁 Lượt miễn phí hằng ngày',
    },
    '🔮 Summon ×1 — 💰100': {
      fil: '🔮 Summon ×1 — 💰100', th: '🔮 อัญเชิญ ×1 — 💰100', id: '🔮 Panggil ×1 — 💰100',
      ja: '🔮 召喚 ×1 — 💰100', zh: '🔮 召唤 ×1 — 💰100', vi: '🔮 Triệu hồi ×1 — 💰100',
    },
    '✨ Summon ×10 — 💰900': {
      fil: '✨ Summon ×10 — 💰900', th: '✨ อัญเชิญ ×10 — 💰900', id: '✨ Panggil ×10 — 💰900',
      ja: '✨ 召喚 ×10 — 💰900', zh: '✨ 召唤 ×10 — 💰900', vi: '✨ Triệu hồi ×10 — 💰900',
    },
    '⚔️ Battle Arena': { fil: '⚔️ Battle Arena', th: '⚔️ สนามต่อสู้', id: '⚔️ Arena Tempur', ja: '⚔️ バトルアリーナ', zh: '⚔️ 战斗竞技场', vi: '⚔️ Đấu trường' },
    '— 7-day unlock · stat points every level up': {
      fil: '— magbubukas pagkatapos ng 7 araw · stat points tuwing level up',
      th: '— ปลดล็อกใน 7 วัน · ได้พอยต์ทุกครั้งที่เลเวลอัป',
      id: '— terbuka setelah 7 hari · poin stat tiap naik level',
      ja: '— 7日で解放 · レベルアップでステータスポイント',
      zh: '— 7天后解锁 · 每次升级获得属性点',
      vi: '— mở sau 7 ngày · điểm chỉ số mỗi lần lên cấp',
    },
    '⚔️ +ATK': { fil: '⚔️ +ATK', th: '⚔️ +ATK', id: '⚔️ +ATK', ja: '⚔️ +ATK', zh: '⚔️ +攻击', vi: '⚔️ +ATK' },
    '🛡️ +DEF': { fil: '🛡️ +DEF', th: '🛡️ +DEF', id: '🛡️ +DEF', ja: '🛡️ +DEF', zh: '🛡️ +防御', vi: '🛡️ +DEF' },
    '💨 +SPD': { fil: '💨 +SPD', th: '💨 +SPD', id: '💨 +SPD', ja: '💨 +SPD', zh: '💨 +速度', vi: '💨 +SPD' },
    '⚔️ Choose your opponent': {
      fil: '⚔️ Pumili ng kalaban', th: '⚔️ เลือกคู่ต่อสู้', id: '⚔️ Pilih lawanmu',
      ja: '⚔️ 相手を選ぼう', zh: '⚔️ 选择你的对手', vi: '⚔️ Chọn đối thủ',
    },
    'Choose an enemy below and click Fight!': {
      fil: 'Pumili ng kalaban sa ibaba at pindutin ang Fight!',
      th: 'เลือกศัตรูด้านล่างแล้วกด Fight!',
      id: 'Pilih musuh di bawah lalu klik Fight!',
      ja: '下から敵を選んで「Fight!」を押そう！',
      zh: '在下方选择敌人并点击“战斗”！',
      vi: 'Chọn kẻ địch bên dưới rồi bấm Fight!',
    },
    'Selected': { fil: 'Napili', th: 'เลือกแล้ว', id: 'Dipilih', ja: '選択中', zh: '已选择', vi: 'Đã chọn' },
    'Choose': { fil: 'Piliin', th: 'เลือก', id: 'Pilih', ja: 'えらぶ', zh: '选择', vi: 'Chọn' },
    'Fight!': { fil: 'Laban!', th: 'ต่อสู้!', id: 'Serang!', ja: 'ファイト！', zh: '战斗！', vi: 'Chiến đấu!' },
    '⚔️ Fight in the Menu → Battle Arena — pick your enemy on the big stage!': {
      fil: '⚔️ Lumaban sa Menu → Battle Arena — pumili ng kalaban sa malaking entablado!',
      th: '⚔️ ต่อสู้ที่เมนู → สนามต่อสู้ — เลือกศัตรูบนเวทีใหญ่!',
      id: '⚔️ Tempur di Menu → Arena Tempur — pilih musuhmu di panggung besar!',
      ja: '⚔️ メニューのバトルアリーナで戦おう — 大きなステージで敵を選ぼう！',
      zh: '⚔️ 在菜单 → 战斗竞技场战斗 — 在大舞台上选择你的敌人！',
      vi: '⚔️ Chiến đấu trong Menu → Đấu trường — chọn kẻ địch trên sân khấu lớn!',
    },
    '🛒 Pet Shop': { fil: '🛒 Pet Shop', th: '🛒 ร้านสัตว์เลี้ยง', id: '🛒 Toko Peliharaan', ja: '🛒 ペットショップ', zh: '🛒 宠物商店', vi: '🛒 Shop thú cưng' },
    '— rare buddies sold only here, never in eggs': {
      fil: '— mga bihirang buddy dito lang mabibili, hindi kailanman sa mga itlog',
      th: '— เพื่อนหายามีจำหน่ายเฉพาะที่นี่ ไม่มีในไข่',
      id: '— teman langka hanya dijual di sini, tidak pernah dalam telur',
      ja: '— レアななかまはここだけで売っています。卵には出ません！',
      zh: '— 稀有伙伴仅在此出售，绝不会出现在蛋里',
      vi: '— bạn hiếm chỉ bán ở đây, không bao giờ có trong trứng',
    },
    'Save your coins, work hard, battle hard — the legendary Dragon waits. 🐉': {
      fil: 'I-ipon ang coins, magtrabaho at lumaban — naghihintay ang alamat na Dragon. 🐉',
      th: 'สะสมเหรียญ ทำงานหนัก ต่อสู้เข้ม — มังกรในตำนานกำลังรอ 🐉',
      id: 'Kumpulkan koin, kerja keras, tempur keras — Naga legendaris menunggu. 🐉',
      ja: 'コインを貯めて、働いて、戦おう — 伝説のドラゴンが待っている。 🐉',
      zh: '攒金币、努力工作、努力战斗 — 传说中的神龙在等你。 🐉',
      vi: 'Hãy tích xu, làm việc chăm chỉ, chiến đấu hết mình — Rồng huyền thoại đang chờ. 🐉',
    },
    '🌀 Destiny Path': {
      fil: '🧭 Landas ng Tadhana', th: '🧭 เส้นทางแห่งชะตากรรม', id: '🧭 Jalur Takdir',
      ja: '🧭 運命の道', zh: '🧭 命运之路', vi: '🧭 Con đường định mệnh',
    },
    '— 30-day unlock · choose once, keep forever': {
      fil: '— magbubukas pagkatapos ng 30 araw · piliin nang isang beses, para na habang-buhay',
      th: '— ปลดล็อกใน 30 วัน · เลือกครั้งเดียว ไปตลอดกาล',
      id: '— terbuka setelah 30 hari · pilih sekali, milik selamanya',
      ja: '— 30日で解放 · 一度きりの選択、ずっと続く',
      zh: '— 30天后解锁 · 一次选择，永久生效',
      vi: '— mở sau 30 ngày · chọn một lần, giữ mãi mãi',
    },
    '🐾 Buddy Guide': { fil: '🐾 Gabay sa Buddy', th: '🐾 คู่มือเพื่อน', id: '🐾 Panduan Teman', ja: '🐾 なかまガイド', zh: '🐾 伙伴图鉴', vi: '🐾 Cẩm nang bạn' },
    '— hatching is RANDOM, your egg decides!': {
      fil: '— RANDOM ang pagpisa, ang itlog mo ang magdedecide!',
      th: '— การฟักเป็นแบบสุ่ม ไข่ของคุณคือผู้ตัดสิน!',
      id: '— penetasan adalah ACAK, telurmu yang memutuskan!',
      ja: '— 孵化はランダム。卵が決める！',
      zh: '— 孵化是随机的，由你的蛋决定！',
      vi: '— việc nở là NGẪU NHIÊN, quả trứng quyết định!',
    },
    'Take care of your egg and feed it XP — one of these buddies will hatch randomly. No picking, pure luck!': {
      fil: 'Alagaan ang itlog at pakainin ng XP — isa sa mga buddy na ito ang sisining randomly. Walang pili, purong swerte!',
      th: 'ดูแลไข่และให้ XP — เพื่อนหนึ่งตัวจะฟักออกมาแบบสุ่ม ไม่มีการเลือก ล้วนแต่โชคช่วย!',
      id: 'Jaga telurmu dan beri XP — salah satu teman ini akan menetas secara acak. Tidak bisa memilih, murni keberuntungan!',
      ja: '卵を大切にしてXPをあげよう — このなかまのどれかがランダムで孵る。選べない、運次第！',
      zh: '照顾好你的蛋并喂它XP — 其中一只伙伴会随机孵化。不能挑选，全凭运气！',
      vi: 'Chăm sóc quả trứng và cho nó XP — một trong những bạn này sẽ nở ngẫu nhiên. Không chọn được, toàn nhờ may mắn!',
    },
    '⚙️ Options': { fil: '⚙️ Mga Opsyon', th: '⚙️ ตั้งค่า', id: '⚙️ Pengaturan', ja: '⚙️ 設定', zh: '⚙️ 设置', vi: '⚙️ Tùy chọn' },
    '— tune your game': {
      fil: '— iayos ang laro mo', th: '— ปรับแต่งเกมของคุณ', id: '— sesuaikan gamemu',
      ja: '— ゲームを調整', zh: '— 调整你的游戏', vi: '— tinh chỉnh trò chơi',
    },

    /* ---- Settings rows ---- */
    '🎵 Background Music': { fil: '🎵 Background Music', th: '🎵 เพลงประกอบ', id: '🎵 Musik Latar', ja: '🎵 BGM', zh: '🎵 背景音乐', vi: '🎵 Nhạc nền' },
    '🎵 Music: On': { fil: '🎵 Music: On', th: '🎵 เพลง: เปิด', id: '🎵 Musik: Nyala', ja: '🎵 音楽: オン', zh: '🎵 音乐：开', vi: '🎵 Nhạc: Bật' },
    '🔇 Music: Off': { fil: '🔇 Music: Off', th: '🔇 เพลง: ปิด', id: '🔇 Musik: Mati', ja: '🔇 音楽: オフ', zh: '🔇 音乐：关', vi: '🔇 Nhạc: Tắt' },
    '🔔 Sound Effects': { fil: '🔔 Sound Effects', th: '🔔 เอฟเฟกต์เสียง', id: '🔔 Efek Suara', ja: '🔔 効果音', zh: '🔔 音效', vi: '🔔 Hiệu ứng âm thanh' },
    '🎨 Graphics': { fil: '🎨 Graphics', th: '🎨 กราฟิก', id: '🎨 Grafis', ja: '🎨 グラフィック', zh: '🎨 图像', vi: '🎨 Đồ họa' },
    'Pixel-perfect (crisp)': {
      fil: 'Pixel-perfect (matalas)', th: 'พิกเซลคมชัด', id: 'Piksel sempurna (tajam)',
      ja: 'ピクセルパーフェクト（くっきり）', zh: '像素完美（清晰）', vi: 'Pixel hoàn hảo (sắc nét)',
    },
    'Smooth (soft)': {
      fil: 'Smooth (malambot)', th: 'เรียบ (นุ่ม)', id: 'Halus (lembut)',
      ja: 'スムース（なめらか）', zh: '平滑（柔和）', vi: 'Mượt (mềm)',
    },
    'FPS limit': {
      fil: 'Limit ng FPS', th: 'จำกัด FPS', id: 'Batas FPS', ja: 'FPS制限', zh: 'FPS 限制', vi: 'Giới hạn FPS',
    },
    'Max (uncapped)': {
      fil: 'Max (walang limit)', th: 'สูงสุด (ไม่จำกัด)', id: 'Maks (tanpa batas)',
      ja: '最大（無制限）', zh: '最大（不限制）', vi: 'Tối đa (không giới hạn)',
    },
    'Show FPS counter': {
      fil: 'Ipakita ang FPS counter', th: 'แสดงตัวนับ FPS', id: 'Tampilkan penghitung FPS',
      ja: 'FPSカウンターを表示', zh: '显示 FPS 计数器', vi: 'Hiện bộ đếm FPS',
    },
    '🎚️ Graphics quality': {
      fil: '🎚️ Kalidad ng graphics', th: '🎚️ คุณภาพกราฟิก', id: '🎚️ Kualitas grafis',
      ja: '🎚️ グラフィック品質', zh: '🎚️ 画面质量', vi: '🎚️ Chất lượng đồ họa',
    },
    'Low': { fil: 'Mababa', th: 'ต่ำ', id: 'Rendah', ja: '低', zh: '低', vi: 'Thấp' },
    'Medium': { fil: 'Katamtaman', th: 'กลาง', id: 'Sedang', ja: '中', zh: '中', vi: 'Trung bình' },
    'High': { fil: 'Mataas', th: 'สูง', id: 'Tinggi', ja: '高', zh: '高', vi: 'Cao' },
    '🖥️ Visual mode': {
      fil: '🖥️ Visual mode', th: '🖥️ โหมดภาพ', id: '🖥️ Mode visual',
      ja: '🖥️ ビジュアルモード', zh: '🖥️ 画面风格', vi: '🖥️ Chế độ hình ảnh',
    },
    '8-Bit (retro chunky)': {
      fil: '8-Bit (retro na magaspang)', th: '8-บิต (เรโทรหยาบ)', id: '8-Bit (retro kasar)',
      ja: '8ビット（レトロ）', zh: '8位元（复古粗犷）', vi: '8-Bit (retro thô)',
    },
    '16-Bit (classic)': {
      fil: '16-Bit (klasiko)', th: '16-บิต (คลาสสิก)', id: '16-Bit (klasik)',
      ja: '16ビット（クラシック）', zh: '16位元（经典）', vi: '16-Bit (cổ điển)',
    },
    '24-Bit (smooth HD)': {
      fil: '24-Bit (smooth HD)', th: '24-บิต (เนียน HD)', id: '24-Bit (HD halus)',
      ja: '24ビット（なめらかHD）', zh: '24位元（高清平滑）', vi: '24-Bit (HD mượt)',
    },
    '32-Bit (ultra)': {
      fil: '32-Bit (ultra)', th: '32-บิต (อัลตร้า)', id: '32-Bit (ultra)',
      ja: '32ビット（ウルトラ）', zh: '32位元（极致）', vi: '32-Bit (cực cao)',
    },
    '🖼️ WallPaw': { fil: '🖼️ WallPaw', th: '🖼️ WallPaw', id: '🖼️ WallPaw', ja: '🖼️ 壁紙', zh: '🖼️ 墙纸', vi: '🖼️ Hình nền' },
    'Follow color': {
      fil: 'Sundan ang kulay', th: 'ตามสีธีม', id: 'Ikuti warna', ja: 'テーマ色に合わせる', zh: '跟随主题色', vi: 'Theo màu chủ đề',
    },
    '🌈 Accent color': {
      fil: '🌈 Accent color', th: '🌈 สีเน้น', id: '🌈 Warna aksen',
      ja: '🌈 アクセントカラー', zh: '🌈 主题色', vi: '🌈 Màu nhấn',
    },
    '🌿 Eco-Theme': {
      fil: '🌿 Eco-Theme', th: '🌿 ธีมธรรมชาติ', id: '🌿 Tema Eco',
      ja: '🌿 エコテーマ', zh: '🌿 自然主题', vi: '🌿 Chủ đề thiên nhiên',
    },
    'Bamboo Grove': {
      fil: 'Kagubatan ng Kawayan', th: 'ป่าไผ่', id: 'Hutan Bambu', ja: '竹林', zh: '竹林', vi: 'Rừng tre',
    },
    'Rice Terraces': {
      fil: 'Hagdan-hagdang Palayan', th: 'ทุ่งนาขั้นบันได', id: 'Sawah Terasering', ja: '棚田', zh: '梯田', vi: 'Ruộng bậc thang',
    },
    'Terracotta Clay': {
      fil: 'Luad na Terracotta', th: 'ดินเทอร์ราคอตต้า', id: 'Tanah Terracotta', ja: 'テラコッタ', zh: '赤陶', vi: 'Đất nung',
    },
    'Night Fireflies': {
      fil: 'Alitaptap sa Gabi', th: 'หิ่งห้อยยามค่ำ', id: 'Kunang-kunang Malam', ja: '夜のホタル', zh: '夜萤', vi: 'Đom đóm đêm',
    },
    '🕒 Your timezone': {
      fil: '🕐 Timezone mo', th: '🕐 เขตเวลาของคุณ', id: '🕐 Zona waktumu', ja: '🕐 タイムゾーン', zh: '🕐 你的时区', vi: '🕐 Múi giờ của bạn',
    },
    '💙 About Juan Buddy': {
      fil: '💙 Tungkol sa Juan Buddy', th: '💙 เกี่ยวกับ Juan Buddy', id: '💙 Tentang Juan Buddy',
      ja: '💙 Juan Buddy について', zh: '💙 关于 Juan Buddy', vi: '💙 Về Juan Buddy',
    },
    'A cozy 16-bit idle pet life sim — hatch a mystery egg, take care of your buddy, explore Asia, and build your legend.': {
      fil: 'Isang cozy 16-bit idle pet life sim — pisisin ang misteryosong itlog, alagaan ang buddy mo, galugarin ang Asya, at buurin ang iyong alamat.',
      th: 'เกมจำลองชีวิตสัตว์เลี้ยง 16-บิตสุดชิล — ฟักไข่ลึกลับ ดูแลเพื่อนของคุณ สำรวจเอเชีย และสร้างตำนานของคุณ',
      id: 'Simulasi kehidupan peliharaan idle 16-bit yang nyaman — tetaskan telur misterius, rawat temanmu, jelajahi Asia, dan bangun legendamu.',
      ja: '癒し系16ビット育成シミュレーション — 謎の卵を孵して、なかまを育て、アジアを旅し、伝説をつくろう。',
      zh: '治愈的16位元休闲宠物养成模拟 — 孵出神秘蛋，照顾你的伙伴，探索亚洲，书写你的传奇。',
      vi: 'Mô phỏng nuôi thú cưng nhàn rỗi 16-bit dễ thương — ấp trứng bí ẩn, chăm sóc bạn của bạn, khám phá châu Á và xây dựng huyền thoại.',
    },

    /* ---- Modals ---- */
    'Buddy passed away...': {
      fil: 'Pumanaw ang buddy mo...', th: 'เพื่อนของคุณจากไปแล้ว...', id: 'Temanmu telah meninggal...',
      ja: 'なかまは旅立っていった...', zh: '你的伙伴离世了...', vi: 'Bạn của bạn đã ra đi...',
    },
    'Cause: neglect': {
      fil: 'Dahilan: kapabayaan', th: 'สาเหตุ: ทอดทิ้ง', id: 'Penyebab: kelalaian',
      ja: '原因：お世話不足', zh: '原因：疏于照顾', vi: 'Nguyên nhân: bỏ bê',
    },
    'Take care of the things you love — feed them, rest them, check in on them. Just like real life. 🌱': {
      fil: 'Alagaan ang mga mahal mo — pakainin, pahingahin, bisitahin. Parang totoong buhay lang. 🌱',
      th: 'ดูแลสิ่งที่คุณรัก — ให้อาหาร ให้พัก แวะมาเยี่ยม เหมือนชีวิตจริง 🌱',
      id: 'Jaga hal-hal yang kamu cinta — beri makan, istirahatkan, dan kunjungi. Seperti kehidupan nyata. 🌱',
      ja: '大切なものは大切に — ごはんをあげて、休ませて、会いに行こう。人生と同じだよ。 🌱',
      zh: '照顾好你所爱的一切 — 喂食、休息、常来看看。就像现实生活一样。 🌱',
      vi: 'Hãy chăm sóc những gì bạn yêu thương — cho ăn, cho nghỉ, ghé thăm thường xuyên. Như ngoài đời vậy. 🌱',
    },
    '🌱 Start a New Game': {
      fil: '🌱 Simulan ang Bagong Game', th: '🌱 เริ่มเกมใหม่', id: '🌱 Mulai Game Baru',
      ja: '🌱 ニューゲーム開始', zh: '🌱 开始新游戏', vi: '🌱 Bắt đầu trò chơi mới',
    },
    'LEVEL UP — PICK A PERK': {
      fil: 'LEVEL UP — PUMILI NG PERK', th: 'เลเวลอัป — เลือกพลัง', id: 'NAIK LEVEL — PILIH PERK',
      ja: 'レベルアップ — 特典を選ぼう', zh: '升级 — 选择加成', vi: 'LÊN CẤP — CHỌN ƯU ĐIỂM',
    },
    'Every level gives a boost! Choose one — 1% luck rolls an ✨EPIC with triple power.': {
      fil: 'Bawat level ay may boost! Pumili ng isa — 1% na swerte ay ✨EPIC na triple ang power.',
      th: 'ทุกเลเวลได้บูสต์! เลือกหนึ่งอัน — โชค 1% จะได้ ✨EPIC พลังสามเท่า',
      id: 'Setiap level memberi peningkatan! Pilih satu — keberuntungan 1% menghasilkan ✨EPIC dengan kekuatan tiga kali.',
      ja: 'レベルアップで強化！ひとつ選ぼう — 1%の幸運で ✨EPIC（効果3倍）が登場！',
      zh: '每级都有加成！选一个 — 1%的运气会抽到三倍威力的✨史诗加成。',
      vi: 'Mỗi cấp đều có tăng lực! Chọn một — may mắn 1% sẽ ra ✨EPIC sức mạnh gấp ba.',
    },
    'NAME YOUR BUDDY': {
      fil: 'PANGALANAN ANG BUDDY MO', th: 'ตั้งชื่อเพื่อนของคุณ', id: 'BERI NAMA TEMANMU',
      ja: 'なかまに名前をつけよう', zh: '给你的伙伴起名', vi: 'ĐẶT TÊN CHO BẠN CỦA BẠN',
    },
    'A random buddy will hatch from this egg. Give it a nickname (max 16 characters):': {
      fil: 'Isang random na buddy ang sisining mula sa itlog na ito. Bigyan ito ng palayaw (max 16 characters):',
      th: 'เพื่อนสุ่มหนึ่งตัวจะฟักจากไข่นี้ ตั้งชื่อเล่นให้มัน (สูงสุด 16 ตัวอักษร):',
      id: 'Teman acak akan menetas dari telur ini. Beri nama panggilan (maks 16 karakter):',
      ja: 'この卵からランダムななかまが孵ります。ニックネームをつけてあげよう（最大16文字）：',
      zh: '一只随机伙伴将从这颗蛋中孵化。给它起个昵称（最多16个字符）：',
      vi: 'Một người bạn ngẫu nhiên sẽ nở từ quả trứng này. Đặt cho nó một biệt danh (tối đa 16 ký tự):',
    },
    "💚 Let's Go!": {
      fil: '💚 Simulan na!', th: '💚 ไปกันเลย!', id: '💚 Ayo Mulai!', ja: '💚 いこう！', zh: '💚 出发！', vi: '💚 Bắt đầu thôi!',
    },
    'Keep the default name': {
      fil: 'Panatilihin ang default na pangalan', th: 'ใช้ชื่อเริ่มต้น', id: 'Pakai nama bawaan',
      ja: 'デフォルトの名前を使う', zh: '保留默认名字', vi: 'Giữ tên mặc định',
    },
    '📜 CREDITS': {
      fil: '📜 MGA KREDIT', th: '📜 เครดิต', id: '📜 KREDIT', ja: '📜 クレジット', zh: '📜 制作人员', vi: '📜 THÔNG TIN',
    },
    'Created & developed by': {
      fil: 'Ginawa at lininang ni', th: 'สร้างและพัฒนาโดย', id: 'Dibuat & dikembangkan oleh',
      ja: '制作・開発', zh: '制作开发', vi: 'Được tạo & phát triển bởi',
    },
    '⚠️ ARE YOU SURE?': {
      fil: '⚠️ SIGURADO KA NA BA?', th: '⚠️ คุณแน่ใจหรือไม่?', id: '⚠️ APA KAMU YAKIN?',
      ja: '⚠️ 本当によいですか？', zh: '⚠️ 确定要这样做吗？', vi: '⚠️ BẠN CÓ CHẮC KHÔNG?',
    },
    '✔️ Yes, do it': {
      fil: '✔️ Oo, gawin na', th: '✔️ ใช่ ทำเลย', id: '✔️ Ya, lakukan',
      ja: '✔️ はい、実行', zh: '✔️ 是的，执行', vi: '✔️ Có, làm thôi',
    },
    '✖️ Close': {
      fil: '✖️ Isara', th: '✖️ ปิด', id: '✖️ Tutup', ja: '✖️ 閉じる', zh: '✖️ 关闭', vi: '✖️ Đóng',
    },
    '⏫ Skip': { fil: '⏫ Laktawan', th: '⏫ ข้าม', id: '⏫ Lewati', ja: '⏫ スキップ', zh: '⏫ 跳过', vi: '⏫ Bỏ qua' },
    '🍂 WELCOME BACK!': {
      fil: '🍂 WELCOME BACK!', th: '🍂 ยินดีต้อนรับกลับ!', id: '🍂 SELAMAT DATANG KEMBALI!',
      ja: '🍂 おかえり！', zh: '🍂 欢迎回来！', vi: '🍂 CHÀO MỪNG TRỞ LẠI!',
    },
    '5% Offline Rate · Keep the game open for 100%!': {
      fil: '5% Offline Rate · Panatilihing bukas ang game para sa 100%!',
      th: 'อัตราออฟไลน์ 5% · เปิดเกมทิ้งไว้เพื่อรับ 100%!',
      id: 'Tingkat Offline 5% · Biarkan game terbuka untuk 100%!',
      ja: 'オフライン率5% · ゲームを開いたままにすると100%！',
      zh: '离线收益5% · 保持游戏开启可获得100%！',
      vi: 'Tỷ lệ ngoại tuyến 5% · Giữ trò chơi mở để nhận 100%!',
    },
    'Your buddy missed you — care meters kept draining slowly while away.': {
      fil: 'Namiss ka ng buddy mo — dahan-dahang bumaba ang care meters habang wala ka.',
      th: 'เพื่อนของคุณคิดถึงคุณ — มิเตอร์ดูแลลดลงช้าๆ ระหว่างที่คุณไม่อยู่',
      id: 'Temanmu merindukanmu — meter perawatan terus menipis perlahan selama kamu pergi.',
      ja: 'なかまはあなたに会いたがっていました — 離れている間もお世話メーターはゆっくり減っていきました。',
      zh: '你的伙伴想你了 — 你不在时照顾值在慢慢下降。',
      vi: 'Bạn của bạn nhớ bạn — các chỉ số chăm sóc vẫn giảm chậm khi bạn vắng mặt.',
    },
    '💰 Collect': { fil: '💰 Kunin', th: '💰 รับ', id: '💰 Kumpulkan', ja: '💰 受け取る', zh: '💰 领取', vi: '💰 Nhận' },
    '📅 DAILY CHECK-IN': {
      fil: '📅 DAILY CHECK-IN', th: '📅 เช็คอินรายวัน', id: '📅 CHECK-IN HARIAN',
      ja: '📅 デイリーチェックイン', zh: '📅 每日签到', vi: '📅 ĐIỂM DANH HẰNG NGÀY',
    },
    '🌱 Check In & Claim': {
      fil: '🌱 Mag-Check In at Kumuha', th: '🌱 เช็คอินและรับรางวัล', id: '🌱 Check In & Klaim',
      ja: '🌱 チェックインして受取', zh: '🌱 签到并领取', vi: '🌱 Điểm danh & nhận',
    },
    '✨ EVOLUTION ✨': {
      fil: '✨ EBOLUSYON ✨', th: '✨ วิวัฒนาการ ✨', id: '✨ EVOLUSI ✨', ja: '✨ 進化 ✨', zh: '✨ 进化 ✨', vi: '✨ TIẾN HÓA ✨',
    },
    'Base stats +25% · say hello to Stage 2!': {
      fil: 'Base stats +25% · bumati kay Stage 2!', th: 'ค่าสถานะพื้นฐาน +25% · ทักทายสเตจ 2!',
      id: 'Stat dasar +25% · sapa Stage 2!', ja: '基本ステータス+25% · ステージ2に挨拶しよう！',
      zh: '基础属性+25% · 向二阶段问好吧！', vi: 'Chỉ số gốc +25% · chào mừng Giai đoạn 2!',
    },
    '🔊 Sound: On': { fil: '🔊 Sound: On', th: '🔊 เสียง: เปิด', id: '🔊 Suara: Nyala', ja: '🔊 サウンド: オン', zh: '🔊 声音：开', vi: '🔊 Âm thanh: Bật' },
    '🔇 Sound: Off': { fil: '🔇 Sound: Off', th: '🔇 เสียง: ปิด', id: '🔇 Suara: Mati', ja: '🔇 サウンド: オフ', zh: '🔇 声音：关', vi: '🔇 Âm thanh: Tắt' },
    'Open at login': {
      fil: 'Buksan kapag nag-login', th: 'เปิดเมื่อล็อกอิน', id: 'Buka saat login',
      ja: 'ログイン時に開く', zh: '登录时启动', vi: 'Mở khi đăng nhập',
    },
    'Reset progress': {
      fil: 'I-reset ang progress', th: 'รีเซ็ตความคืบหน้า', id: 'Reset kemajuan',
      ja: '進行状況をリセット', zh: '重置进度', vi: 'Đặt lại tiến trình',
    },

    /* ---- States / weather ---- */
    'IDLE': { fil: 'PAHINGA', th: 'พัก', id: 'DIAM', ja: 'アイドル', zh: '待机', vi: 'NGHỈ' },
    'WALK': { fil: 'LAKAD', th: 'เดิน', id: 'JALAN', ja: 'あるく', zh: '散步', vi: 'ĐI BỘ' },
    'EAT': { fil: 'KAKAIN', th: 'กิน', id: 'MAKAN', ja: 'たべる', zh: '吃饭', vi: 'ĂN' },
    'SLEEP': { fil: 'TUTULOG', th: 'นอน', id: 'TIDUR', ja: 'ねる', zh: '睡觉', vi: 'NGỦ' },
    'BATTLE': { fil: 'LABAN', th: 'ต่อสู้', id: 'TEMPUR', ja: 'バトル', zh: '战斗', vi: 'CHIẾN ĐẤU' },
    'Sunny': { fil: 'Mararaw', th: 'แดดออก', id: 'Cerah', ja: '晴れ', zh: '晴天', vi: 'Nắng' },
    'Cloudy': { fil: 'Maulep', th: 'เมฆมาก', id: 'Berawan', ja: 'くもり', zh: '多云', vi: 'Nhiều mây' },
    'Rainy': { fil: 'Maulan', th: 'ฝนตก', id: 'Hujan', ja: '雨', zh: '下雨', vi: 'Mưa' },
    'Stormy': { fil: 'Bagyo', th: 'พายุ', id: 'Badai', ja: '嵐', zh: '暴风雨', vi: 'Bão' },
    'Snowy': { fil: 'May niyebe', th: 'หิมะตก', id: 'Bersalju', ja: '雪', zh: '下雪', vi: 'Tuyết' },
    '✨ Ready for a cozy day!': {
      fil: '✨ Handa na para sa isang cozy na araw!', th: '✨ พร้อมสำหรับวันสุดชิล!',
      id: '✨ Siap untuk hari yang nyaman!', ja: '✨ 今日も癒しの一日を！',
      zh: '✨ 准备好度过治愈的一天！', vi: '✨ Sẵn sàng cho một ngày dễ thương!',
    },
  };

  let current = 'en';
  let hadSaved = false;
  const STORAGE_KEY = 'juanbuddy-lang';

  function normalize(lang) {
    for (const l of LANGS) if (l.id === lang) return l.id;
    return 'en';
  }

  function t(s) {
    if (current === 'en' || typeof s !== 'string') return s;
    const row = DICT[s];
    if (!row) return s;
    const v = row[current];
    return typeof v === 'string' && v.length ? v : s;
  }

  function apply(root) {
    const scope = root || document;
    let nodes;
    try {
      nodes = scope.querySelectorAll('[data-i18n]');
    } catch (err) {
      return;
    }
    for (const node of nodes) {
      const key = node.getAttribute('data-i18n');
      if (!key) continue;
      const val = t(key);
      if (node.textContent !== val) node.textContent = val;
    }
    if (scope === document) document.documentElement.lang = current;
  }

  function setLang(lang) {
    current = normalize(lang);
    try {
      localStorage.setItem(STORAGE_KEY, current);
    } catch (err) { /* private mode */ }
    apply();
  }

  function getLang() {
    return current;
  }

  function boot() {
    let saved = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch (err) { /* ignore */ }
    hadSaved = !!saved;
    current = normalize(saved || 'en');
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => apply());
    } else {
      apply();
    }
  }

  window.JBI18n = { LANGS, t, apply, setLang, getLang, normalize, hasSaved: () => hadSaved, DICT };
  boot();
})();
