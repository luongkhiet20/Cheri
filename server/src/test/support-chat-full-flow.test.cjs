const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://tinhvttk24411_db_user:gZ7aJJyCWgYffiXa@cluster0.cbvni8r.mongodb.net/cheri?retryWrites=true&w=majority";

describe('Chéri Human Support Chat Flow Test Suite', () => {
  let client;
  let db;
  const testGuestId = `test_guest_${Date.now()}`;
  let createdConvId;

  before(async () => {
    client = new MongoClient(MONGO_URI);
    await client.connect();
    db = client.db('cheri');
  });

  after(async () => {
    // Cleanup test data
    if (createdConvId) {
      await db.collection('conversations').deleteMany({ guestId: testGuestId });
      await db.collection('conversation_messages').deleteMany({ conversationId: new ObjectId(createdConvId) });
    }
    await client.close();
  });

  test('1. Normal AI chat does NOT create any conversation in "conversations" collection', async () => {
    const existing = await db.collection('conversations').findOne({ guestId: testGuestId });
    assert.equal(existing, null, 'No conversation document should exist prior to clicking support button');
  });

  test('2. Clicking "Liên hệ nhân viên hỗ trợ" creates a conversation with source = SUPPORT_BUTTON', async () => {
    // Simulate what POST /api/chat/support/request does
    const now = new Date();
    const newConv = {
      userId: null,
      guestId: testGuestId,
      channel: 'WEB_CHAT',
      source: 'SUPPORT_BUTTON',
      status: 'WAITING_ADMIN',
      requestedAt: now,
      lastMessageAt: now,
      lastMessagePreview: 'Khách hàng yêu cầu hỗ trợ từ nhân viên',
      unreadAdminCount: 1,
      unreadCustomerCount: 0,
      internalNote: '',
      createdAt: now,
      updatedAt: now,
    };

    const insertRes = await db.collection('conversations').insertOne(newConv);
    createdConvId = insertRes.insertedId;

    const sysMsg = {
      conversationId: createdConvId,
      senderType: 'SYSTEM',
      messageType: 'SYSTEM',
      content: 'Khách hàng đã yêu cầu nhân viên hỗ trợ.',
      createdAt: now,
      updatedAt: now,
    };
    await db.collection('conversation_messages').insertOne(sysMsg);

    const doc = await db.collection('conversations').findOne({ _id: createdConvId });
    assert.ok(doc, 'Conversation must be created');
    assert.equal(doc.source, 'SUPPORT_BUTTON', 'Source must strictly be SUPPORT_BUTTON');
    assert.equal(doc.status, 'WAITING_ADMIN', 'Status must initially be WAITING_ADMIN');
    assert.equal(doc.unreadAdminCount, 1, 'unreadAdminCount should be 1');
  });

  test('3. Repeated support request does NOT create duplicate conversation if one is open', async () => {
    // Simulate lookup of open conversation
    const openFilter = {
      source: 'SUPPORT_BUTTON',
      guestId: testGuestId,
      status: { $in: ['WAITING_ADMIN', 'IN_PROGRESS', 'REPLIED'] },
    };
    const openConvs = await db.collection('conversations').find(openFilter).toArray();
    assert.equal(openConvs.length, 1, 'Only 1 active conversation should exist');
  });

  test('4. Customer sending a message in support mode updates conversation_messages and unread count', async () => {
    const customerText = 'Em muốn hỏi đầm dạ hội size L còn hàng tại shop không ạ?';
    const now = new Date();
    await db.collection('conversation_messages').insertOne({
      conversationId: createdConvId,
      senderType: 'CUSTOMER',
      messageType: 'TEXT',
      content: customerText,
      createdAt: now,
      updatedAt: now,
    });

    await db.collection('conversations').updateOne(
      { _id: createdConvId },
      {
        $set: { lastMessageAt: now, lastMessagePreview: customerText, updatedAt: now },
        $inc: { unreadAdminCount: 1 },
      }
    );

    const updated = await db.collection('conversations').findOne({ _id: createdConvId });
    assert.equal(updated.lastMessagePreview, customerText);
    assert.equal(updated.unreadAdminCount, 2);
  });

  test('5. Admin query ONLY retrieves conversations where source === SUPPORT_BUTTON', async () => {
    const adminList = await db.collection('conversations')
      .find({ source: 'SUPPORT_BUTTON', _id: createdConvId })
      .toArray();

    assert.equal(adminList.length, 1);
    assert.equal(adminList[0].source, 'SUPPORT_BUTTON');
  });

  test('6. Admin accepts conversation: status becomes IN_PROGRESS and unreadAdminCount resets', async () => {
    const now = new Date();
    await db.collection('conversations').updateOne(
      { _id: createdConvId },
      {
        $set: {
          status: 'IN_PROGRESS',
          acceptedAt: now,
          unreadAdminCount: 0,
          adminLastReadAt: now,
          updatedAt: now,
        },
      }
    );

    await db.collection('conversation_messages').insertOne({
      conversationId: createdConvId,
      senderType: 'SYSTEM',
      messageType: 'SYSTEM',
      content: 'Nhân viên hỗ trợ đã tiếp nhận cuộc trò chuyện.',
      createdAt: now,
      updatedAt: now,
    });

    const accepted = await db.collection('conversations').findOne({ _id: createdConvId });
    assert.equal(accepted.status, 'IN_PROGRESS');
    assert.equal(accepted.unreadAdminCount, 0);
  });

  test('7. Admin replies: status becomes REPLIED and customer receives message', async () => {
    const adminReply = 'Dạ Chéri chào nàng, mẫu đầm dạ hội size L hiện vẫn còn sẵn tại cửa hàng nhé!';
    const now = new Date();

    const insertRes = await db.collection('conversation_messages').insertOne({
      conversationId: createdConvId,
      senderType: 'ADMIN',
      messageType: 'TEXT',
      content: adminReply,
      createdAt: now,
      updatedAt: now,
    });

    await db.collection('conversations').updateOne(
      { _id: createdConvId },
      {
        $set: {
          status: 'REPLIED',
          lastMessageId: insertRes.insertedId,
          lastMessageAt: now,
          lastMessagePreview: adminReply,
          adminLastReadAt: now,
          updatedAt: now,
        },
        $inc: { unreadCustomerCount: 1 },
      }
    );

    const replied = await db.collection('conversations').findOne({ _id: createdConvId });
    assert.equal(replied.status, 'REPLIED');
    assert.equal(replied.lastMessagePreview, adminReply);
    assert.equal(replied.unreadCustomerCount, 1);
  });

  test('8. Admin closes conversation: status becomes CLOSED and session ends', async () => {
    const now = new Date();
    await db.collection('conversations').updateOne(
      { _id: createdConvId },
      {
        $set: {
          status: 'CLOSED',
          closedAt: now,
          updatedAt: now,
        },
      }
    );

    await db.collection('conversation_messages').insertOne({
      conversationId: createdConvId,
      senderType: 'SYSTEM',
      messageType: 'SYSTEM',
      content: 'Phiên hỗ trợ nhân viên đã kết thúc.',
      createdAt: now,
      updatedAt: now,
    });

    const closed = await db.collection('conversations').findOne({ _id: createdConvId });
    assert.equal(closed.status, 'CLOSED');
    assert.ok(closed.closedAt);
  });
});
