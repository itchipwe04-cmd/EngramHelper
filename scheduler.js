const fs = require('fs');
const path = require('path');
const { fsrs, generatorParameters, Rating, createEmptyCard } = require('ts-fsrs');

const f = fsrs(generatorParameters()); // tham số mặc định, có thể tinh chỉnh sau
const DEFAULT_TOPIC = 'Cơ bản (mặc định)';

let storePath = null;
let store = null; // { cards: [{id, front, back, source, fsrsCard, pending}], muteUntil, curriculums, disabledTopics }

function init(userDataPath) {
  storePath = path.join(userDataPath, 'engram-cards.json');
  if (fs.existsSync(storePath)) {
    store = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
  } else {
    const seed = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'renderer', 'cards-seed.json'), 'utf-8')
    );
    const now = new Date();
    store = {
      cards: seed.map((c) => ({
        id: c.id,
        front: c.front,
        back: c.back,
        source: DEFAULT_TOPIC,
        fsrsCard: createEmptyCard(now),
        pending: false,
      })),
      muteUntil: null,
      curriculums: [],
      disabledTopics: [],
    };
    save();
  }
  // Tương thích dữ liệu cũ chưa có các field này
  if (!store.curriculums) store.curriculums = [];
  if (!store.disabledTopics) store.disabledTopics = [];
  let changed = false;
  store.cards.forEach((c) => {
    if (!c.source) { c.source = DEFAULT_TOPIC; changed = true; }
  });
  if (changed) save();
}

function save() {
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
}

function isTopicEnabled(name) {
  return !store.disabledTopics.includes(name);
}

function topicOf(card) {
  return card.source || DEFAULT_TOPIC;
}

function isMuted() {
  return store.muteUntil && new Date(store.muteUntil) > new Date();
}

function muteFor(hours) {
  store.muteUntil = new Date(Date.now() + hours * 3600 * 1000).toISOString();
  save();
}

function unmute() {
  store.muteUntil = null;
  save();
}

// Trả về 1 thẻ đã đến hạn ôn (due <= now), thuộc chủ đề đang bật, chưa đang chờ trả lời
function findDueCard() {
  const now = new Date();
  const due = store.cards
    .filter((c) => !c.pending && isTopicEnabled(topicOf(c)) && new Date(c.fsrsCard.due) <= now)
    .sort((a, b) => new Date(a.fsrsCard.due) - new Date(b.fsrsCard.due));
  if (!due.length) return null;
  due[0].pending = true;
  save();
  return { id: due[0].id, front: due[0].front };
}

// Ôn tự do: lấy ngẫu nhiên 1 thẻ thuộc chủ đề đang bật, không tính vào lịch pending
function getRandomCard() {
  const pool = store.cards.filter((c) => isTopicEnabled(topicOf(c)));
  if (!pool.length) return null;
  const c = pool[Math.floor(Math.random() * pool.length)];
  return { id: c.id, front: c.front };
}

function getAnswer(id) {
  const c = store.cards.find((c) => c.id === id);
  return c ? c.back : '';
}

// rating: 1=Again 2=Hard 3=Good 4=Easy
function answerCard(id, rating) {
  const c = store.cards.find((c) => c.id === id);
  if (!c) return;
  const now = new Date();
  const result = f.repeat(c.fsrsCard, now);
  c.fsrsCard = result[rating].card;
  c.pending = false;
  save();
  return { nextDue: c.fsrsCard.due };
}

// Nếu người dùng bỏ qua thẻ (đóng popup không trả lời) -> gỡ pending để lần sau vẫn được nhắc
function releasePending(id) {
  const c = store.cards.find((c) => c.id === id);
  if (c) {
    c.pending = false;
    save();
  }
}

function dueCount() {
  const now = new Date();
  return store.cards.filter((c) => isTopicEnabled(topicOf(c)) && new Date(c.fsrsCard.due) <= now).length;
}

// Thêm 1 lô thẻ mới (từ AI sinh theo chủ đề, hoặc từ phân tích giáo trình)
// cards: [{front, back}]  -> trả về số thẻ đã thêm
function addCards(newCards, sourceLabel) {
  const now = new Date();
  let prefix = 'g' + Date.now().toString(36);
  const added = newCards.map((c, i) => ({
    id: `${prefix}-${i}`,
    front: c.front,
    back: c.back,
    source: sourceLabel || DEFAULT_TOPIC,
    fsrsCard: createEmptyCard(now),
    pending: false,
  }));
  store.cards.push(...added);
  save();
  return added.length;
}

// Lưu lại 1 lần phân tích giáo trình (tiêu đề, chiến lược, danh sách chương)
function addCurriculum(entry) {
  store.curriculums.push({
    title: entry.title,
    units: entry.units || [],
    strategy: entry.strategy || '',
    addedAt: new Date().toISOString(),
    cardCount: entry.cardCount || 0,
  });
  save();
}

function getCurriculums() {
  return store.curriculums;
}

// Danh sách chủ đề (gộp theo source của từng thẻ) kèm số thẻ, số thẻ đến hạn, trạng thái bật/tắt
function getTopics() {
  const now = new Date();
  const map = {};
  store.cards.forEach((c) => {
    const name = topicOf(c);
    if (!map[name]) map[name] = { name, cardCount: 0, dueCount: 0 };
    map[name].cardCount++;
    if (new Date(c.fsrsCard.due) <= now) map[name].dueCount++;
  });
  return Object.values(map)
    .map((t) => ({ ...t, enabled: isTopicEnabled(t.name) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}

function setTopicEnabled(name, enabled) {
  const idx = store.disabledTopics.indexOf(name);
  if (enabled && idx !== -1) store.disabledTopics.splice(idx, 1);
  if (!enabled && idx === -1) store.disabledTopics.push(name);
  save();
}

// Xoá hẳn 1 chủ đề: bỏ toàn bộ thẻ thuộc chủ đề đó, dọn luôn cờ bật/tắt liên quan.
// Trả về số thẻ đã xoá.
function deleteTopic(name) {
  const before = store.cards.length;
  store.cards = store.cards.filter((c) => topicOf(c) !== name);
  const removed = before - store.cards.length;
  const idx = store.disabledTopics.indexOf(name);
  if (idx !== -1) store.disabledTopics.splice(idx, 1);
  save();
  return removed;
}

// Lấy danh sách front (mặt trước) hiện có của 1 chủ đề, giới hạn số lượng gần nhất
// -> dùng làm ngữ cảnh "đừng lặp lại các thẻ này" khi sinh thêm thẻ mới.
function getCardFrontsForTopic(name, limit) {
  return store.cards
    .filter((c) => topicOf(c) === name)
    .slice(-limit)
    .map((c) => c.front);
}

module.exports = {
  init,
  findDueCard,
  getRandomCard,
  getAnswer,
  answerCard,
  releasePending,
  isMuted,
  muteFor,
  unmute,
  dueCount,
  addCards,
  addCurriculum,
  getCurriculums,
  getTopics,
  setTopicEnabled,
  deleteTopic,
  getCardFrontsForTopic,
  Rating,
};
