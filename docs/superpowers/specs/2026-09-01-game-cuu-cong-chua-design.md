# Thiết kế: Game "Cứu Công Chúa Claude"

Ngày: 2026-09-01. Phiên autonomous — thiết kế được chốt theo giả định hợp lý nhất, user duyệt sau.

## Mục tiêu

Game trình duyệt "tuyệt đẹp, mượt mà, như game hạng A": platformer hành động 2D, hiệp sĩ vượt 3 màn để cứu công chúa Claude khỏi Hắc Kỵ Sĩ. Chơi được ngay bằng cách mở `index.html` (hoặc server tĩnh), không phụ thuộc mạng, không asset ngoài — toàn bộ hình vẽ bằng Canvas, âm thanh sinh bằng WebAudio.

## Vì sao chọn hướng này (đã cân nhắc 3 phương án)

1. **Canvas 2D thuần (CHỌN)** — kiểm soát hoàn toàn hiệu ứng, 0 dependency, chạy offline, dễ đạt 60fps.
2. Three.js 3D — đẹp tiềm năng nhưng cần CDN, nặng, rủi ro giật, khối lượng lớn.
3. Phaser — thêm dependency ngoài, không cần thiết cho phạm vi này.

## Gameplay

- Điều khiển: ←→/AD di chuyển, Space/W/↑ nhảy (nhảy 2 lần, độ cao theo thời gian giữ phím), Shift/X lướt (dash, có afterimage + né đòn), Z/J chém kiếm. P/Esc tạm dừng, M tắt tiếng, Enter xác nhận.
- Cảm ứng (bổ sung 2026-09-01): thiết bị chạm hiện nút overlay — pad ◀ ▶ trái (Pointer Events multi-touch, ngón đặt sau thắng, trượt ngón đổi hướng), nhảy/chém/lướt phải, ❚❚ pause góc trên; dọc màn hình → overlay "xoay ngang" + tự pause; Android tự fullscreen + khoá ngang khi bắt đầu; chạm màn hình để bỏ qua cutscene; HUD xu/giờ dịch trái tránh nút pause; hướng dẫn trong game đổi theo thiết bị.
- Chỉnh theo phản hồi vòng 2 (v1.3.0): hết đứng lơ lửng ở mép — chân đỡ thu từ ±12px về ±9px, tâm phải nằm trong mặt platform bay (±52px), và thêm animation chới với giữ thăng bằng (nghiêng về phía hụt chân + lắc lư) khi tâm nhô qua mép. Thêm GAME_INFO (version + build time) trong util.js, hiển thị ở title + console; cập nhật thủ công mỗi lần sửa.
- Nút toàn màn hình (v1.4.0): iOS Safari không hỗ trợ Fullscreen API cho trang thường (chỉ `<video>`), nên `_goFullscreen()` tự động lúc bắt đầu chơi luôn thất bại âm thầm trên iPhone. Thêm nút ⛶ cố định góc trên-trái, chỉ hiện khi `body.touch.menu-open` (title/howto/pause/victory — tách khỏi `#touch-ui` vì đó chỉ hiện lúc đang chơi), ẩn hẳn nếu đã chạy dạng standalone (`navigator.standalone` hoặc `display-mode: standalone`). Bấm nút: có Fullscreen API thì thử luôn (khoá thêm `screen.orientation.lock("landscape")`); không có API hoặc promise reject thì hiện overlay `#fs-tip` hướng dẫn "Thêm vào Màn hình chính" (cách duy nhất thật sự ẩn thanh địa chỉ Safari) — tái dùng `.screen`/`.panel` nên thừa hưởng luôn cơ chế cuộn + thu gọn màn hình thấp đã làm ở v1.3.1. Đã test: click thật qua Fullscreen API kích hoạt đúng (môi trường test tự động bị treo khi vào fullscreen thật — giới hạn công cụ, không phải lỗi code); giả lập thiếu API (patch `requestFullscreen`/`webkitRequestFullscreen` = undefined, đúng thực tế iPhone) → tip hiện đúng, đóng bằng "Đã hiểu" hoạt động, vừa khít cả ở viewport 300px cao.
- Fix màn hình thấp (v1.3.1): trên iPhone xoay ngang, panel UI (title/howto/pause/victory) cao hơn viewport → nút bị đẩy khuất, không cuộn được. Sửa 2 lớp: (1) `.screen` dùng `align-items: safe center` + `overflow-y: auto` — không còn tràn cả 2 phía khi panel cao hơn màn hình; (2) `@media (max-height: 480px)` thu gọn toàn bộ panel (crown, chữ, khoảng cách, padding) để vừa khít một màn hình trên đa số điện thoại ngang, panel tự có `overflow-y: auto` riêng làm lưới an toàn cho phần còn lại (đã đo: title 267px/300px viewport không cần cuộn; howto — panel dài nhất — cuộn nội bộ 44px, nút "Đã hiểu" vẫn với tới). Không ảnh hưởng desktop (chỉ kích hoạt dưới 480px chiều cao).
- Bản đóng gói claude.ai artifact: build script Python gộp index.html + 7 file js/ thành 1 file HTML, escape toàn bộ ký tự ngoài ASCII (\\uXXXX cho JS, entity cho HTML — tránh vỡ chữ khi server không khai charset), tự chèn meta viewport nếu thiếu. `game.js` boot ngay nếu `document.readyState !== "loading"` (trang có thể được chèn động bởi artifact viewer). URL cố định: https://claude.ai/code/artifact/37f6d055-897c-4c58-909d-b19fc410a531 — publish lại (cùng `url`) mỗi khi cập nhật game.
- Chỉnh theo phản hồi (bổ sung 2026-09-01): (1) god rays vẽ lại bằng quạt tia pre-render 3 lớp mềm, xoay chậm; tháp ánh-sáng-dẫn-đường hạ xuống đường chân trời theo theme (lightY). (2) Credit "Thiết kế · Đàm Mạnh Hiếu" ở title + victory + README. (3) Độ khó RẤT KHÓ: slime 80px/s né gai, dơi bay rộng/nhanh canh cú nhảy, thêm ~13 quái + 2 dải gai, platform di chuyển nhanh hơn, boss 10 HP / lao 690 / nhịp dồn dập / choáng 1,9s / dưới 4 HP tông tường dội sóng ngược. (4) Đáp platform di chuyển có phản hồi thật: bụi + squash + tiếng + platform lún nhún (lò xo), bụi khi chạy trên platform.
- Game feel: coyote time 0.1s, jump buffer 0.12s, squash & stretch, bụi khi đáp/chạy, camera mượt có lookahead, screen shake theo trauma, hit-stop khi trúng đòn.
- Máu 3 tim, i-frame sau khi trúng; chết → hồi sinh tại checkpoint (không giới hạn mạng), xu đã ăn giữ nguyên, quái reset.
- Kẻ địch: Slime (tuần tra, đạp/chém được), Dơi (bay hình sin), Gai (địa hình). Boss cuối: Hắc Kỵ Sĩ 6 HP — lao tới (né bằng nhảy/dash), đập tạo sóng xung kích, choáng sau khi tông tường → lúc đó mới đánh được.
- Kết thúc: thắng boss → cửa tháp mở → cutscene công chúa chạy ra, tim + pháo hoa → màn hình thắng (thời gian, xu, số lần chết).

## 3 màn chơi

1. **Rừng Ánh Sáng** — ban ngày, xanh mát, dạy cơ chế, slime + hố.
2. **Vách Đá Hoàng Hôn** — trời cam tím, platform di chuyển, dơi, gai.
3. **Lâu Đài Bóng Đêm** — tím đậm, đuốc, bố cục khó hơn, kết bằng đấu trường boss + tháp công chúa.

## Kỹ thuật

- Canvas logic 960×540 (16:9), scale theo cửa sổ + devicePixelRatio (cap 2), letterbox.
- Vòng lặp: update cố định 60Hz (accumulator, clamp), render mỗi rAF với **nội suy vị trí** (prev→curr) cho player/quái/camera → mượt cả trên màn hình 120Hz.
- Map: chuỗi ASCII (tile 48px), ký tự cho đất/đá/platform một chiều/gai/xu/tim/quái/checkpoint/đuốc/cửa/boss/công chúa/spawn.
- Vẽ: parallax 4–5 lớp pre-render offscreen theo theme màn; glow bằng sprite radial-gradient pre-render (tránh shadowBlur trong hot path); particle pool (~600).
- Âm thanh: WebAudio — SFX synth (nhảy, xu, chém, trúng đòn, dash, checkpoint...); nhạc nền scheduler (title/level/boss/fanfare); resume sau input đầu (chính sách trình duyệt).
- UI: overlay DOM (title, hướng dẫn, pause, thắng) — chữ tiếng Việt sắc nét, panel translucent, accent vàng #FFD166; HUD tim/xu/thời gian vẽ trong canvas hoặc DOM cố định.
- Debug hook `window.__game` (state, skip màn, fps) phục vụ kiểm chứng tự động.

## Cấu trúc file

```
index.html        — shell, CSS, overlay UI
js/util.js        — toán, RNG seeded, easing, AABB
js/audio.js       — SFX + music engine
js/particles.js   — particle pool + emitter
js/background.js  — parallax theo theme
js/levels.js      — 3 map ASCII + theme config + parser
js/entities.js    — Player, Slime, Bat, MovingPlatform, Boss, Princess, pickup
js/game.js        — loop, input, camera, va chạm, state machine, cutscene, HUD
```

Script thường (không ES module) → mở file:// trực tiếp vẫn chạy.

## Tiêu chí "xong" (kiểm chứng thật trên trình duyệt)

1. Trang load, console 0 lỗi.
2. Title screen đẹp (screenshot), vào game được.
3. Di chuyển/nhảy/dash/chém hoạt động (giả lập phím, đọc state).
4. Ăn xu tăng đếm; trúng đòn mất tim; chết hồi sinh đúng checkpoint.
5. Qua được cả 3 màn (dùng debug skip để duyệt nhanh), boss đánh được và chết được, cutscene + màn hình thắng hiện đúng.
6. FPS trung bình ≥ 55 khi chơi.
7. Screenshot 3 màn đạt chất lượng thẩm mỹ (tự review, chỉnh nếu xấu).
