const fs = require('fs');
const path = require('path');
const { fsrs, generatorParameters, Rating, createEmptyCard } = require('ts-fsrs');

const f = fsrs(generatorParameters()); // tham số mặc định, có thể tinh chỉnh sau

let storePath = null;
let store = null; // { cards: [{id, front, back, fsrsCard, pending}], muteUntil }

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
        fsrsCard: createEmptyCard(now),
        pending: false,
      })),
      muteUntil: null,
    };
    save();
  }
}

function save() {
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
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

// Trả về 1 thẻ đã đến hạn ôn (due <= now) và chưa đang chờ trả lời, ưu tiên thẻ due sớm nhất
function findDueCard() {
  const now = new Date();
  const due = store.cards
    .filter((c) => !c.pending && new Date(c.fsrsCard.due) <= now)
    .sort((a, b) => new Date(a.fsrsCard.due) - new Date(b.fsrsCard.due));
  if (!due.length) return null;
  due[0].pending = true;
  save();
  return { id: due[0].id, front: due[0].front };
}

// Ôn tự do: lấy ngẫu nhiên 1 thẻ bất kỳ, không tính vào lịch pending
function getRandomCard() {
  if (!store.cards.length) return null;
  const c = store.cards[Math.floor(Math.random() * store.cards.length)];
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
  return store.cards.filter((c) => new Date(c.fsrsCard.due) <= now).length;
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
  Rating,
};
