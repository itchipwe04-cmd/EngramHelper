# Engram Helper

Trợ thủ học tập 2D chạy nền trên desktop, dạo chơi trên màn hình. Bấm vào nó để xem 1 câu kiến thức hoặc câu hỏi ôn tập — học môn gì cũng được, không riêng tiếng Anh.

## Chạy thử (Windows)

Cần cài Node.js trước (https://nodejs.org).

```
cd engram-helper
npm install
npm start
```

App sẽ hiện 1 linh thú xanh dạo quanh màn hình. Icon quản lý nằm ở khay hệ thống (system tray) — bấm phải để xem đầy đủ menu.

## Cài Gemini API Key (bắt buộc để dùng tính năng sinh nội dung)

Tray menu → **"Cài đặt Gemini API Key..."** → lấy key miễn phí tại https://aistudio.google.com/apikey → dán vào, lưu lại.

Key được lưu ở `config.json` trong thư mục userData của app (KHÔNG nằm trong thư mục project, không lo lỡ tay commit lên GitHub).

## Nhiều nhà AI (đa provider) + tự động chuyển nhà khi hết quota

Tray menu → **"Cài đặt AI..."** — cài key cho 1 hay nhiều nhà tuỳ ý:

| Nhà | Text | Đọc lên |
|---|---|---|
| Gemini (Google) | ✓ | ✓ |
| OpenAI | ✓ | ✓ |
| Claude (Anthropic) | ✓ | ✗ (Anthropic không có API TTS) |
| Tuỳ chỉnh (OpenAI-compatible) | ✓ | ✗ |

"Tuỳ chỉnh" dùng cho bất kỳ dịch vụ nào tương thích định dạng API của OpenAI (DeepSeek, Qwen, Kimi, GLM...) — chỉ cần điền Base URL + model đúng của nhà đó.

**Tự động chuyển nhà**: khi 1 nhà bị lỗi hoặc hết quota, app tự thử nhà tiếp theo theo thứ tự ưu tiên cố định — không cần tự tay đổi. Chỉ áp dụng cho các nhà đã có key.
- Thứ tự cho Text: Gemini → OpenAI → Claude → Tuỳ chỉnh
- Thứ tự cho Đọc lên: Gemini → OpenAI

Module điều phối nằm ở `providers/` — mỗi nhà 1 file adapter (`providers/gemini.js`, `openai.js`, `anthropic.js`, `custom.js`), `providers/index.js` xử lý logic thử lần lượt + fallback.

## Ngôn ngữ dịch & giọng đọc

Tray menu → **"Cài đặt Gemini API Key..."** → chọn **"Dịch sang ngôn ngữ nào"** (Việt, Anh, Trung, Nga, Nhật, Hàn, Pháp, Đức, Tây Ban Nha, hoặc tự nhập ngôn ngữ khác). Áp dụng cho cả "Dịch nhanh" lẫn "Dịch màn hình" — không cố định Anh↔Việt nữa. Nếu văn bản gốc đã đúng ngôn ngữ đích rồi, app tự dịch sang tiếng Anh thay vào đó.

Nút loa 🔊 (đọc lên) dùng **Gemini TTS** (`gemini-3.1-flash-tts-preview`) — đọc được mọi ngôn ngữ AI hỗ trợ, không phụ thuộc giọng nói cài sẵn trên Windows như trước. Cần mạng + tốn thêm 1 lượt gọi API mỗi lần bấm đọc.

## Dịch màn hình

Tray menu → **"Dịch màn hình"**, hoặc phím tắt **Ctrl+Shift+T** (dùng được mọi lúc, không cần app đang được focus).

Cách hoạt động:
1. Chụp ảnh màn hình hiện tại (chỉ màn hình chính, chưa hỗ trợ nhiều màn hình).
2. **OCR chạy ngay trên máy** (thư viện `tesseract.js`, local hoàn toàn — ảnh chụp KHÔNG được gửi lên AI hay bất kỳ đâu). Lần đầu chạy cần tải bộ dữ liệu ngôn ngữ Anh+Việt (~vài MB, cần mạng).
3. Tự động lọc bỏ các dòng nghi là code, số điện thoại/giá tiền, token/API key, URL kỹ thuật — **chỉ phần còn lại (câu chữ tự nhiên) mới được gửi dạng text thuần lên Gemini để dịch**, không gửi ảnh.
4. Hiện lớp phủ toàn màn hình: nền là ảnh chụp làm mờ, bản dịch vẽ đè đúng vị trí dòng chữ gốc. Bấm "Đóng" hoặc phím `Esc` để thoát.

Giới hạn cần biết:
- Bộ lọc "không dịch code/số/mật khẩu" dựa theo quy tắc (regex), không phải cam kết tuyệt đối — có thể sót hoặc lọc nhầm.
- Máy yếu / màn hình độ phân giải cao có thể mất 10-20s cho cả quy trình (chụp + OCR + dịch).
- Màn hình có tỷ lệ scale (DPI) khác 100% có thể khiến vị trí bản dịch hơi lệch so với chữ gốc.

## Dịch nhanh (clipboard)

Bôi đen đoạn text bất kỳ ở bất kỳ đâu → `Ctrl+C` → **chuột phải vào linh thú** → hiện popup dịch (tự nhận diện Anh↔Việt). Cách này nhẹ và nhanh hơn dịch cả màn hình, hợp khi chỉ cần dịch 1 đoạn ngắn.

## Thêm nội dung học

Hai cách, đều qua tray menu:

- **"Thêm chủ đề mới..."** — nhập 1 chủ đề bất kỳ (vd "hàm số bậc 2", "lịch sử Việt Nam thời Lý", "phrasal verbs với get"), AI soạn 8-12 thẻ ôn tập, tự thêm vào lịch FSRS.
- **"Nạp giáo trình (PDF/Word)..."** — chọn file `.pdf`, `.docx`, hoặc `.txt`. App trích xuất nội dung, gửi AI phân tích thành: các chương/đơn vị chính, 1 đoạn chiến lược học đề xuất, và một lô thẻ ôn tập ban đầu cho phần nội dung quan trọng. Tất cả tự động thêm vào lịch ôn tập.

## Đóng gói thành .exe

```
npm run build:win
```

File .exe portable sẽ nằm trong thư mục `dist/`. Không cần cài đặt, chạy trực tiếp.

## Cấu trúc

- `main.js` — process chính: tạo cửa sổ trong suốt phủ toàn màn hình, luôn nổi trên cùng, quản lý tray icon, hẹn giờ kiểm tra thẻ đến hạn, mở các cửa sổ phụ (nhập chủ đề, cài API key, kết quả phân tích giáo trình).
- `scheduler.js` — module FSRS thật (dùng thư viện `ts-fsrs`): lưu tiến độ từng thẻ, tìm thẻ đến hạn, chấm điểm ôn tập (Quên/Khó/Được/Dễ), quản lý trạng thái im lặng, thêm thẻ mới, lưu lịch sử phân tích giáo trình.
- `config.js` — quản lý Gemini API key + tên model, lưu ở `config.json` trong userData.
- `content-generator.js` — gọi Gemini API: sinh thẻ theo chủ đề, hoặc phân tích giáo trình thành chiến lược học + thẻ ôn tập.
- `doc-extract.js` — trích xuất text từ file `.pdf` (dùng `pdf-parse`), `.docx` (dùng `mammoth`), hoặc `.txt`.
- `ocr.js` — OCR local bằng `tesseract.js` (không gửi ảnh đi đâu) + lọc dòng nghi là code/số/mật khẩu, dùng cho dịch màn hình.
- `screen-translate.js` — điều phối: chụp màn hình, OCR, lọc, dịch hàng loạt, trả toạ độ để vẽ đè.
- `preload.js`, `renderer/preload-task.js`, `renderer/preload-curriculum.js`, `renderer/preload-screen-translate.js` — cầu nối an toàn giữa các renderer và main process.
- `renderer/` — giao diện linh thú (SVG + CSS animation), bong bóng nhắc nhẹ, popup ôn tập/dịch nhanh, và các cửa sổ phụ (thêm chủ đề, cài API key, kết quả giáo trình, lớp phủ dịch màn hình).
- `renderer/cards-seed.json` — bộ thẻ Q&A ban đầu. Chỉ dùng lần đầu chạy (chưa có `engram-cards.json`); sau đó nội dung thêm qua tray menu hoặc sửa `engram-cards.json` trực tiếp.

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

- ~~Nội dung động~~ — đã làm: sinh thẻ theo chủ đề + phân tích giáo trình qua Gemini API.
- **Giáo trình dạng file scan/ảnh**: `doc-extract.js` (đọc PDF/Word) chưa nối với `ocr.js` — PDF dạng ảnh scan (không có text layer) khi nạp giáo trình sẽ trích xuất ra rỗng. `ocr.js` hiện chỉ dùng cho dịch màn hình, có thể tái dùng cho việc này.
- **Dịch màn hình đa màn hình**: hiện chỉ chụp/dịch màn hình chính (primary display), chưa hỗ trợ khi dùng nhiều màn hình.
- **Xem lại lịch sử giáo trình đã nạp**: `scheduler.getCurriculums()` đã lưu sẵn dữ liệu (tiêu đề, chiến lược, chương) nhưng chưa có UI để xem lại — hiện chỉ hiện 1 lần lúc vừa phân tích xong.
- **Đồng bộ đa thiết bị**: hiện tiến độ FSRS chỉ lưu local (`engram-cards.json`). Muốn dùng trên nhiều máy/điện thoại thì cần đẩy lên backend (Railway sẵn có) thay vì chỉ lưu file JSON tại chỗ.
- **Phát hiện fullscreen**: hiện mới chặn theo idle time, chưa phát hiện được lúc người dùng đang xem phim/chơi game toàn màn hình — cần thêm module native riêng nếu muốn chính xác hơn.
- **3D**: thay SVG bằng model glTF render qua Three.js — kiến trúc cửa sổ trong suốt không đổi.
- **macOS/Linux**: cùng codebase Electron, đổi `build.mac`/`build.linux` trong `package.json` rồi build riêng trên máy tương ứng.
- **Android/iOS**: Electron không chạy được trên mobile — cần viết lại phần hiển thị bằng React Native/Flutter; `scheduler.js` (logic FSRS) tái dùng được gần như nguyên vẹn.
