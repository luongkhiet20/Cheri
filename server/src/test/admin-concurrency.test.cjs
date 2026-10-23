const assert = require('assert');
const jwt = require('jsonwebtoken');
const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://tinhvttk24411_db_user:gZ7aJJyCWgYffiXa@cluster0.cbvni8r.mongodb.net/cheri?retryWrites=true&w=majority";
const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_eshop_123456789';
const BASE_URL = 'http://localhost:5000/api';

async function runConcurrencyTest() {
  console.log('--- STARTING CONCURRENT ACCEPTANCE RACE CONDITION TEST ---');
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db('cheri');

  const admin1Id = new ObjectId();
  const admin2Id = new ObjectId();
  await db.collection('users').insertOne({ _id: admin1Id, email: 'admin1_race@cheri.com', fullName: 'Admin Race 1', roles: ['admin'] });
  await db.collection('users').insertOne({ _id: admin2Id, email: 'admin2_race@cheri.com', fullName: 'Admin Race 2', roles: ['admin'] });

  const tokenAdmin1 = jwt.sign({ id: admin1Id.toString(), email: 'admin1_race@cheri.com', roles: ['admin'] }, JWT_SECRET, { expiresIn: '1h' });
  const tokenAdmin2 = jwt.sign({ id: admin2Id.toString(), email: 'admin2_race@cheri.com', roles: ['admin'] }, JWT_SECRET, { expiresIn: '1h' });

  const convId = new ObjectId();
  await db.collection('conversations').insertOne({
    _id: convId,
    source: 'SUPPORT_BUTTON',
    status: 'WAITING_ADMIN',
    assignedAdminId: null,
    guestId: 'guest_race_' + Date.now(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  try {
    console.log('[TEST] Hai admin cùng bấm "Tiếp nhận" đồng thời (Promise.all)...');
    const [res1, res2] = await Promise.all([
      fetch(`${BASE_URL}/admin/conversations/${convId}/accept`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenAdmin1}`, 'Content-Type': 'application/json' },
      }),
      fetch(`${BASE_URL}/admin/conversations/${convId}/accept`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenAdmin2}`, 'Content-Type': 'application/json' },
      }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    console.log('HTTP Statuses:', statuses);
    // Đúng 1 admin thành công (200), admin còn lại bị từ chối (400)
    assert.deepStrictEqual(statuses, [200, 400], 'Chỉ đúng 1 admin tiếp nhận thành công (200), admin còn lại bị từ chối (400)');

    const finalConv = await db.collection('conversations').findOne({ _id: convId });
    assert.strictEqual(finalConv.status, 'IN_PROGRESS');
    assert.ok(finalConv.assignedAdminId, 'Phải có đúng 1 admin được gán');
    console.log('-> ĐẠT: Nguyên tử hóa (Atomic operation) bảo vệ chính xác, chỉ 1 admin nhận thành công:', finalConv.assignedAdminId.toString());
  } finally {
    await db.collection('conversations').deleteOne({ _id: convId });
    await db.collection('conversation_messages').deleteMany({ conversationId: convId });
    await db.collection('users').deleteOne({ _id: admin1Id });
    await db.collection('users').deleteOne({ _id: admin2Id });
    await client.close();
  }
}

runConcurrencyTest().catch((err) => {
  console.error('CONCURRENCY TEST FAILED:', err);
  process.exit(1);
});
