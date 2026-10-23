const assert = require('assert');
const jwt = require('jsonwebtoken');
const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://tinhvttk24411_db_user:gZ7aJJyCWgYffiXa@cluster0.cbvni8r.mongodb.net/cheri?retryWrites=true&w=majority";
const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_eshop_123456789';
const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('--- STARTING ADMIN CONVERSATION ASSIGNMENT E2E TESTS ---');
  
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db('cheri');

  // 1. Tạo 2 tài khoản admin giả lập với JWT
  const admin1Id = new ObjectId();
  const admin2Id = new ObjectId();
  
  // Insert 2 admin vào DB để test populate
  await db.collection('users').insertOne({
    _id: admin1Id,
    email: 'admin1_test@cheri.com',
    fullName: 'Admin Một (Kỹ thuật)',
    roles: ['admin'],
    status: true,
  });
  await db.collection('users').insertOne({
    _id: admin2Id,
    email: 'admin2_test@cheri.com',
    fullName: 'Admin Hai (Tư vấn)',
    roles: ['admin'],
    status: true,
  });

  const tokenAdmin1 = jwt.sign(
    { id: admin1Id.toString(), email: 'admin1_test@cheri.com', roles: ['admin'] },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  const tokenAdmin2 = jwt.sign(
    { id: admin2Id.toString(), email: 'admin2_test@cheri.com', roles: ['admin'] },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // 2. Tạo một cuộc hội thoại test ở trạng thái WAITING_ADMIN
  const convId = new ObjectId();
  await db.collection('conversations').insertOne({
    _id: convId,
    source: 'SUPPORT_BUTTON',
    status: 'WAITING_ADMIN',
    assignedAdminId: null,
    guestId: 'guest_test_flow_' + Date.now(),
    lastMessagePreview: 'Em cần tư vấn đầm dạ tiệc ạ!',
    lastMessageAt: new Date(),
    unreadAdminCount: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  try {
    // -------------------------------------------------------------
    // KỊCH BẢN 1: Admin 1 nhận trước -> Thành công
    // -------------------------------------------------------------
    console.log('\n[TEST 1] Admin 1 bấm Tiếp nhận hội thoại...');
    const acceptRes1 = await fetch(`${BASE_URL}/admin/conversations/${convId}/accept`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenAdmin1}`,
        'Content-Type': 'application/json',
      },
    });
    const acceptData1 = await acceptRes1.json();
    assert.strictEqual(acceptRes1.status, 200, 'Admin 1 tiếp nhận phải trả về 200');
    assert.strictEqual(acceptData1.success, true);
    assert.strictEqual(acceptData1.conversation.status, 'IN_PROGRESS');
    assert.strictEqual(String(acceptData1.conversation.assignedAdminId._id), admin1Id.toString());
    console.log('-> ĐẠT: Admin 1 tiếp nhận thành công, assignedAdminId = Admin 1, status = IN_PROGRESS');

    // -------------------------------------------------------------
    // KỊCH BẢN 2: Admin 1 gửi tin nhắn -> Thành công
    // -------------------------------------------------------------
    console.log('\n[TEST 2] Admin 1 gửi tin nhắn tư vấn...');
    const msgRes1 = await fetch(`${BASE_URL}/admin/conversations/${convId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenAdmin1}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: 'Dạ Chéri xin chào nàng! Nàng đang quan tâm mẫu đầm nào ạ?' }),
    });
    const msgData1 = await msgRes1.json();
    assert.strictEqual(msgRes1.status, 200, 'Admin 1 gửi tin nhắn phải trả về 200');
    assert.strictEqual(msgData1.success, true);
    assert.strictEqual(String(msgData1.message.senderId), admin1Id.toString());
    console.log('-> ĐẠT: Admin 1 gửi tin nhắn thành công');

    // -------------------------------------------------------------
    // KỊCH BẢN 3: Admin 2 xem phiên Admin 1 -> Chỉ xem
    // -------------------------------------------------------------
    console.log('\n[TEST 3] Admin 2 xem chi tiết hội thoại...');
    const detailRes2 = await fetch(`${BASE_URL}/admin/conversations/${convId}`, {
      headers: { 'Authorization': `Bearer ${tokenAdmin2}` },
    });
    const detailData2 = await detailRes2.json();
    assert.strictEqual(detailRes2.status, 200);
    assert.strictEqual(String(detailData2.conversation.assignedAdminId._id), admin1Id.toString());
    console.log(`-> ĐẠT: Admin 2 xem thấy assignedAdminId là "${detailData2.conversation.assignedAdminId.fullName}" (Chỉ xem)`);

    // -------------------------------------------------------------
    // KỊCH BẢN 4: Admin 2 cố tiếp nhận phiên Admin 1 -> Bị từ chối
    // -------------------------------------------------------------
    console.log('\n[TEST 4] Admin 2 cố bấm Tiếp nhận phiên của Admin 1...');
    const acceptRes2 = await fetch(`${BASE_URL}/admin/conversations/${convId}/accept`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenAdmin2}`,
        'Content-Type': 'application/json',
      },
    });
    assert.strictEqual(acceptRes2.status, 400, 'Admin 2 cố tiếp nhận phải bị 400');
    const acceptData2 = await acceptRes2.json();
    assert.strictEqual(acceptData2.success, false);
    console.log('-> ĐẠT: Backend từ chối Admin 2:', acceptData2.message);

    // -------------------------------------------------------------
    // KỊCH BẢN 5: Admin 2 gọi API gửi tin nhắn trực tiếp -> Bị chặn 403 Forbidden
    // -------------------------------------------------------------
    console.log('\n[TEST 5] Admin 2 gọi API gửi tin nhắn trực tiếp...');
    const msgRes2 = await fetch(`${BASE_URL}/admin/conversations/${convId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenAdmin2}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: 'Admin 2 chen ngang' }),
    });
    assert.strictEqual(msgRes2.status, 403, 'Admin 2 gửi tin nhắn phải bị chặn 403');
    const msgData2 = await msgRes2.json();
    console.log('-> ĐẠT: Backend chặn 403 Forbidden:', msgData2.message);

    // -------------------------------------------------------------
    // KỊCH BẢN 6: Admin 1 trả hội thoại về hàng chờ -> Thành công
    // -------------------------------------------------------------
    console.log('\n[TEST 6] Admin 1 bấm Trả hội thoại về hàng chờ...');
    const returnRes1 = await fetch(`${BASE_URL}/admin/conversations/${convId}/return`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenAdmin1}`,
        'Content-Type': 'application/json',
      },
    });
    const returnData1 = await returnRes1.json();
    assert.strictEqual(returnRes1.status, 200, 'Admin 1 trả hội thoại phải thành công');
    assert.strictEqual(returnData1.conversation.status, 'WAITING_ADMIN');
    assert.strictEqual(returnData1.conversation.assignedAdminId, null);
    console.log('-> ĐẠT: Trả hội thoại thành công, status = WAITING_ADMIN, assignedAdminId = null');

    // -------------------------------------------------------------
    // KỊCH BẢN 7: Admin 1 cố gửi tin nhắn sau khi đã trả -> Bị từ chối
    // -------------------------------------------------------------
    console.log('\n[TEST 7] Admin 1 cố gửi tin nhắn sau khi đã trả...');
    const msgRes1AfterReturn = await fetch(`${BASE_URL}/admin/conversations/${convId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenAdmin1}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: 'Admin 1 cố gửi tiếp sau khi trả' }),
    });
    assert.strictEqual(msgRes1AfterReturn.status, 400, 'Gửi tin nhắn khi ở hàng chờ phải bị 400');
    console.log('-> ĐẠT: Backend từ chối gửi tin nhắn khi chưa có admin phụ trách');

    // -------------------------------------------------------------
    // KỊCH BẢN 8: Admin 2 tiếp nhận hội thoại sau khi Admin 1 trả -> Thành công
    // -------------------------------------------------------------
    console.log('\n[TEST 8] Admin 2 bấm Tiếp nhận hội thoại...');
    const acceptRes2AfterReturn = await fetch(`${BASE_URL}/admin/conversations/${convId}/accept`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenAdmin2}`,
        'Content-Type': 'application/json',
      },
    });
    const acceptData2AfterReturn = await acceptRes2AfterReturn.json();
    assert.strictEqual(acceptRes2AfterReturn.status, 200);
    assert.strictEqual(String(acceptData2AfterReturn.conversation.assignedAdminId._id), admin2Id.toString());
    console.log('-> ĐẠT: Admin 2 tiếp nhận thành công, assignedAdminId = Admin 2');

    // -------------------------------------------------------------
    // KỊCH BẢN 9: Admin 2 gửi tin nhắn -> Thành công
    // -------------------------------------------------------------
    console.log('\n[TEST 9] Admin 2 gửi tin nhắn tư vấn...');
    const msgRes2Success = await fetch(`${BASE_URL}/admin/conversations/${convId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenAdmin2}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: 'Chào nàng, em là chuyên viên tư vấn thứ 2 sẽ tiếp tục hỗ trợ nàng ạ!' }),
    });
    assert.strictEqual(msgRes2Success.status, 200);
    console.log('-> ĐẠT: Admin 2 gửi tin nhắn thành công');

    // -------------------------------------------------------------
    // KỊCH BẢN 10: Admin 1 xem phiên Admin 2 -> Chuyển sang chỉ xem
    // -------------------------------------------------------------
    console.log('\n[TEST 10] Admin 1 xem lại phiên...');
    const detailRes1After = await fetch(`${BASE_URL}/admin/conversations/${convId}`, {
      headers: { 'Authorization': `Bearer ${tokenAdmin1}` },
    });
    const detailData1After = await detailRes1After.json();
    assert.strictEqual(String(detailData1After.conversation.assignedAdminId._id), admin2Id.toString());
    console.log(`-> ĐẠT: Admin 1 thấy assignedAdminId hiện tại là Admin 2 (${detailData1After.conversation.assignedAdminId.fullName})`);

    // -------------------------------------------------------------
    // KỊCH BẢN 11: Admin 1 cố gửi tin nhắn vào phiên Admin 2 -> Bị 403
    // -------------------------------------------------------------
    console.log('\n[TEST 11] Admin 1 cố gửi tin nhắn vào phiên của Admin 2...');
    const msgRes1Blocked = await fetch(`${BASE_URL}/admin/conversations/${convId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenAdmin1}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: 'Admin 1 đòi lại quyền' }),
    });
    assert.strictEqual(msgRes1Blocked.status, 403);
    console.log('-> ĐẠT: Admin 1 bị từ chối 403 Forbidden');

    // -------------------------------------------------------------
    // KỊCH BẢN 12: Admin 2 đóng phiên hỗ trợ -> Thành công
    // -------------------------------------------------------------
    console.log('\n[TEST 12] Admin 2 đóng phiên hỗ trợ...');
    const closeRes2 = await fetch(`${BASE_URL}/admin/conversations/${convId}/close`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenAdmin2}`,
        'Content-Type': 'application/json',
      },
    });
    assert.strictEqual(closeRes2.status, 200);
    console.log('-> ĐẠT: Admin 2 đóng phiên thành công');

    // -------------------------------------------------------------
    // KỊCH BẢN 13: Hội thoại đã đóng -> Cả hai admin đều không thể gửi thêm tin nhắn
    // -------------------------------------------------------------
    console.log('\n[TEST 13] Kiểm tra gửi tin nhắn khi hội thoại đã đóng...');
    const msgResClosed = await fetch(`${BASE_URL}/admin/conversations/${convId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenAdmin2}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: 'Gửi vào phiên đã đóng' }),
    });
    assert.strictEqual(msgResClosed.status, 400);
    console.log('-> ĐẠT: Không admin nào gửi được tin nhắn sau khi đóng phiên');

    console.log('\n======================================================');
    console.log(' TẤT CẢ 13 KỊCH BẢN NGHIỆP VỤ ĐÃ VƯỢT QUA 100%!');
    console.log('======================================================');
  } finally {
    // Dọn dẹp dữ liệu test
    await db.collection('conversations').deleteOne({ _id: convId });
    await db.collection('conversation_messages').deleteMany({ conversationId: convId });
    await db.collection('users').deleteOne({ _id: admin1Id });
    await db.collection('users').deleteOne({ _id: admin2Id });
    await client.close();
  }
}

runTests().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
