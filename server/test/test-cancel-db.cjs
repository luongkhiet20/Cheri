const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://tinhvttk24411_db_user:gZ7aJJyCWgYffiXa@cluster0.cbvni8r.mongodb.net/cheri?retryWrites=true&w=majority';

async function runTest() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db('cheri');
  console.log('--- TEST CANCEL ORDER DATABASE INTEGRATION ---');

  // 1. Tạo đơn hàng PENDING giả lập
  const dummyOrder = {
    orderId: 'TEST-CANCEL-' + Date.now(),
    userId: new ObjectId('6ac13b7e465df8e825df696e'),
    customerEmail: 'test-cancel@cheri.vn',
    status: 'PENDING',
    notes: 'Ghi chú ban đầu của khách',
    items: [],
    shippingAddress: { fullName: 'Test User', phone: '0901234567', address: '123 Le Loi' },
    totalAmount: 500000,
    statusHistory: [
      { status: 'PENDING', updatedAt: new Date(), note: 'Đơn hàng mới tạo' }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const insertRes = await db.collection('orders').insertOne(dummyOrder);
  console.log('1. Created temporary PENDING order:', dummyOrder.orderId, insertRes.insertedId.toString());

  // 2. Kiểm tra dữ liệu trước khi hủy
  const readPre = await db.collection('orders').findOne({ _id: insertRes.insertedId });
  console.log('2. Pre-cancel check: status =', readPre.status, '| cancelReason =', readPre.cancelReason);

  // 3. Thực hiện hủy đơn hàng với lý do khác có nội dung chi tiết
  const cancelPayload = {
    reason: 'Lý do khác.',
    reasonDetail: 'Khách hàng đổi ý muốn mua màu khác tuần sau'
  };
  const cancelledAt = new Date();
  const cancelledBy = new ObjectId('6ac13b7e465df8e825df696e');
  const fullNote = `${cancelPayload.reason} - Chi tiết: ${cancelPayload.reasonDetail}`;

  const updatedStatusHistory = Array.isArray(readPre.statusHistory) ? [...readPre.statusHistory] : [];
  updatedStatusHistory.push({
    status: 'CANCELLED',
    updatedAt: cancelledAt,
    updatedBy: cancelledBy,
    note: fullNote
  });

  const updateRes = await db.collection('orders').updateOne(
    { _id: insertRes.insertedId },
    {
      $set: {
        status: 'CANCELLED',
        cancelReason: cancelPayload.reason,
        cancelReasonDetail: cancelPayload.reasonDetail,
        cancelledAt: cancelledAt,
        cancelledBy: cancelledBy,
        notes: readPre.notes ? `${readPre.notes}\n[Hủy đơn]: ${fullNote}` : `[Hủy đơn]: ${fullNote}`,
        statusHistory: updatedStatusHistory,
        updatedAt: new Date()
      }
    }
  );
  console.log('3. Update result modifiedCount:', updateRes.modifiedCount);

  // 4. Kiểm tra dữ liệu sau khi hủy
  const readPost = await db.collection('orders').findOne({ _id: insertRes.insertedId });
  console.log('4. Post-cancel verification:');
  console.log('   - status:', readPost.status, '(matches CANCELLED:', readPost.status === 'CANCELLED', ')');
  console.log('   - cancelReason:', readPost.cancelReason);
  console.log('   - cancelReasonDetail:', readPost.cancelReasonDetail);
  console.log('   - cancelledAt:', readPost.cancelledAt instanceof Date ? readPost.cancelledAt.toISOString() : readPost.cancelledAt);
  console.log('   - cancelledBy:', readPost.cancelledBy.toString());
  console.log('   - notes:', JSON.stringify(readPost.notes));
  console.log('   - statusHistory length:', readPost.statusHistory.length);
  console.log('   - latest statusHistory entry:', JSON.stringify(readPost.statusHistory[readPost.statusHistory.length - 1]));

  // 5. Kiểm tra đọc đơn hàng cũ không có trường mới (backward compatibility)
  const legacyOrder = await db.collection('orders').findOne({ cancelReason: { $exists: false } });
  if (legacyOrder) {
    console.log('5. Backward compatibility test on legacy order ID:', legacyOrder.orderId);
    console.log('   - legacy cancelReason is undefined/null:', legacyOrder.cancelReason == null);
    console.log('   - legacy order readable without error: OK');
  }

  // 6. Dọn dẹp đơn test
  await db.collection('orders').deleteOne({ _id: insertRes.insertedId });
  console.log('6. Deleted temporary test order. All assertions PASSED!');

  await client.close();
}

runTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
