# Cứu Công Chúa Claude 👑

Game platformer hành động 2D chạy trên trình duyệt — hiệp sĩ vượt 3 vùng đất, hạ Hắc Kỵ Sĩ và cứu công chúa Claude. Toàn bộ hình ảnh vẽ bằng Canvas, âm thanh + nhạc nền sinh bằng WebAudio — **không cần cài đặt, không cần mạng, không có file asset nào**.

**Thiết kế: Đàm Mạnh Hiếu.** Độ khó: **rất khó** — quái đông và nhanh, dơi canh đúng các cú nhảy, boss 10 máu với sóng xung kích.

Phiên bản: **v1.4.0** — build 02/09/2026 08:42 (xem `GAME_INFO` trong `js/util.js`; hiển thị ở màn hình chính và console).

**Toàn màn hình trên điện thoại**: chạm nút ⛶ ở góc trên-trái (chỉ hiện trên máy cảm ứng, ở màn hình chính/hướng dẫn/tạm dừng). Trên Android sẽ vào toàn màn hình ngay. Trên iPhone, Safari không cho web tự ẩn thanh địa chỉ — nút sẽ hiện hướng dẫn "Thêm vào Màn hình chính" (Chia sẻ → Thêm vào MH chính), đây là cách duy nhất chạy thật sự không viền trình duyệt trên iPhone.

## Chơi ngay

Mở thẳng file `index.html` bằng trình duyệt (Chrome/Safari/Edge/Firefox), hoặc chạy server tĩnh:

```bash
python3 -m http.server 8642
```

rồi mở http://localhost:8642

**Trên điện thoại**: mở cùng địa chỉ đó từ máy trong cùng mạng Wi-Fi (`http://<IP-máy-tính>:8642`), hoặc mở bản đóng gói trên claude.ai từ bất cứ đâu (đăng nhập tài khoản của mình): https://claude.ai/code/artifact/37f6d055-897c-4c58-909d-b19fc410a531 — bản này là snapshot, sau khi sửa game cần nhờ Claude publish lại. Xoay ngang máy — nút điều khiển cảm ứng hiện tự động (pad ◀ ▶ bên trái; nhảy ⬆, chém ⚔, lướt ⚡ bên phải; ❚❚ tạm dừng góc trên). Trên Android game tự vào toàn màn hình khi bắt đầu.

## Điều khiển (bàn phím)

| Phím      | Hành động                                        |
| --------- | ------------------------------------------------ |
| ← → / A D | Di chuyển                                        |
| Space / W | Nhảy — giữ để nhảy cao, nhấn lần nữa để nhảy đôi |
| Shift / X | Lướt (dash) — có khung né đòn                    |
| Z / J     | Chém kiếm                                        |
| P / Esc   | Tạm dừng                                         |
| M         | Tắt/bật tiếng                                    |

Đạp lên đầu quái để tiêu diệt. Hắc Kỵ Sĩ chỉ bị thương khi **choáng** (sau khi lao tông tường) — né cú lao rồi phản công, tối đa 2 nhát mỗi lần choáng. Cờ vàng là điểm hồi sinh.

## Ba màn chơi

1. **Rừng Ánh Sáng** — ban ngày, học cơ chế
2. **Vách Đá Hoàng Hôn** — platform di chuyển, dơi, gai
3. **Lâu Đài Bóng Đêm** — thử thách cao nhất + trận boss

Ở chân trời của mỗi màn luôn có một đốm sáng ấm — đó là lồng đèn nơi tháp công chúa, càng đi càng gần.

## Cấu trúc mã

```
index.html        — shell, CSS, màn hình UI
js/util.js        — toán, RNG, easing, helper vẽ
js/audio.js       — SFX + nhạc nền procedural (WebAudio)
js/particles.js   — hệ thống particle
js/background.js  — bầu trời + parallax theo theme
js/levels.js      — dữ liệu 3 màn + parser
js/entities.js    — Player, quái, boss, công chúa, vật phẩm
js/game.js        — vòng lặp fixed-timestep 60Hz + nội suy, va chạm, camera, HUD
```

Thiết kế chi tiết: `docs/superpowers/specs/2026-09-01-game-cuu-cong-chua-design.md`
