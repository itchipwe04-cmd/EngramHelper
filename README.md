# Engram Helper

Linh thú 2D chạy nền trên desktop, dạo chơi trên màn hình. Bấm vào nó để xem 1 câu kiến thức hoặc câu hỏi ôn tập tiếng Anh.

## Chạy thử (Windows)

Cần cài Node.js trước (https://nodejs.org).

```
cd engram-helper
npm install
npm start
```

App sẽ hiện 1 linh thú xanh dạo quanh màn hình. Icon quản lý nằm ở khay hệ thống (system tray) — bấm phải để "Ẩn/Hiện linh thú" hoặc "Thoát".

## Đóng gói thành .exe

```
npm run build:win
```

File .exe portable sẽ nằm trong thư mục `dist/`. Không cần cài đặt, chạy trực tiếp.

## Cấu trúc

- `main.js` — process chính: tạo cửa sổ trong suốt phủ toàn màn hình, luôn nổi trên cùng, quản lý tray icon, hẹn giờ kiểm tra thẻ đến hạn.
- `scheduler.js` — module FSRS thật (dùng thư viện `ts-fsrs`): lưu tiến độ từng thẻ, tìm thẻ đến hạn, chấm điểm ôn tập (Quên/Khó/Được/Dễ), quản lý trạng thái im lặng.
- `preload.js` — cầu nối an toàn giữa renderer và main process.
- `renderer/` — giao diện linh thú (SVG + CSS animation), bong bóng nhắc nhẹ, popup ôn tập.
- `renderer/cards-seed.json` — bộ thẻ Q&A ban đầu. Sửa file này để đổi nội dung học (chỉ dùng lần đầu chạy, sau đó tiến độ lưu ở `engram-cards.json` trong thư mục userData).

## Cơ chế học — đã tối ưu theo phân tích trước đó

1. **Lịch ôn theo FSRS thật**, không phải random — linh thú chỉ nhắc khi thuật toán tính thẻ đó sắp quên.
2. **Nhắc nhẹ, không ép**: bong bóng nhỏ hiện cạnh linh thú, tự mờ sau 8s nếu không bấm, không chặn màn hình. Bấm vào linh thú lúc nào cũng xem lại được thẻ đang chờ.
3. **Biết khi nào nên im**: dùng `powerMonitor.getSystemIdleTime()` — nếu người dùng rời máy >2 phút thì không gửi nhắc nhở. Menu tray có "Tạm im lặng 1 giờ / 4 giờ / đến mai".
4. **Tương tác ngắn**: xem câu hỏi → bấm "Xem đáp án" → chấm 1 trong 4 mức (Quên/Khó/Được/Dễ) → FSRS tự tính lịch ôn tiếp theo.
5. **Đóng popup mà chưa chấm điểm** → thẻ được nhả ra (không tính là đã ôn), lần kiểm tra sau vẫn được nhắc lại.
6. **Ôn tự do**: bấm vào linh thú khi không có thẻ nào đến hạn vẫn lấy được 1 thẻ ngẫu nhiên để luyện thêm.

## Cơ chế click-through

Mặc định cửa sổ cho phép click xuyên qua (để không chặn thao tác trên các app khác). Khi chuột hover vào linh thú, bong bóng, hoặc popup, cửa sổ tạm thời "chặn" click để nhận sự kiện — rời chuột ra thì lại xuyên qua như cũ.

## Hướng đi tiếp theo

- **Nội dung động**: thay `cards-seed.json` tĩnh bằng gọi API (Gemini/Claude) để sinh thẻ theo chủ đề — ghép với công cụ "bảng tổng hợp" đã làm trước đó.
- **Đồng bộ đa thiết bị**: hiện tiến độ FSRS chỉ lưu local (`engram-cards.json`). Muốn dùng trên nhiều máy/điện thoại thì cần đẩy lên backend (Railway sẵn có) thay vì chỉ lưu file JSON tại chỗ.
- **Phát hiện fullscreen**: hiện mới chặn theo idle time, chưa phát hiện được lúc người dùng đang xem phim/chơi game toàn màn hình — cần thêm module native riêng nếu muốn chính xác hơn.
- **3D**: thay SVG bằng model glTF render qua Three.js — kiến trúc cửa sổ trong suốt không đổi.
- **macOS/Linux**: cùng codebase Electron, đổi `build.mac`/`build.linux` trong `package.json` rồi build riêng trên máy tương ứng.
- **Android/iOS**: Electron không chạy được trên mobile — cần viết lại phần hiển thị bằng React Native/Flutter; `scheduler.js` (logic FSRS) tái dùng được gần như nguyên vẹn.
