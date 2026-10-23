const { test } = require('node:test');
const assert = require('node:assert');
const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://tinhvttk24411_db_user:gZ7aJJyCWgYffiXa@cluster0.cbvni8r.mongodb.net/cheri?retryWrites=true&w=majority";
const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_eshop_123456789';

// Test directly using admin-server (Express instance)
const { app, connectToMongo } = require('../../admin-server');
const http = require('http');

test('Newsletter Subscribers Feature Test Suite', async (t) => {
  let server;
  let baseUrl;
  let db;
  let client;

  const testAdminId = new ObjectId();
  const testUserId = new ObjectId();
  const testAdminEmail = `admin_test_${Date.now()}@cheri.com`;
  const testUserEmail = `nguyenvanan_${Date.now()}@gmail.com`;
  const testGuestEmail = `guest_test_${Date.now()}@gmail.com`;

  let adminToken;
  let userToken;

  await t.test('Setup server and test data in MongoDB', async () => {
    db = await connectToMongo();

    // Start ephemeral server
    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api`;
        resolve();
      });
    });

    // Create admin user in db
    await db.collection('users').insertOne({
      _id: testAdminId,
      email: testAdminEmail,
      name: 'Admin Test',
      roles: ['admin'],
      status: true
    });

    // Create regular user with avatar and real name
    await db.collection('users').insertOne({
      _id: testUserId,
      email: testUserEmail,
      name: 'Nguyễn Văn An',
      avatar: 'https://res.cloudinary.com/cheri/image/upload/avatar_an.jpg',
      roles: ['user'],
      status: true
    });

    adminToken = jwt.sign({ id: testAdminId.toString(), email: testAdminEmail, roles: ['admin'] }, JWT_SECRET, { expiresIn: '1h' });
    userToken = jwt.sign({ id: testUserId.toString(), email: testUserEmail, roles: ['user'] }, JWT_SECRET, { expiresIn: '1h' });
  });

  await t.test('1. Guest subscribe successfully', async () => {
    const res = await fetch(`${baseUrl}/newsletter/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `  ${testGuestEmail.toUpperCase()}  `, source: 'FOOTER' })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 201);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.email, testGuestEmail.toLowerCase());
    assert.strictEqual(data.data.status, 'SUBSCRIBED');

    // Verify document in MongoDB
    const doc = await db.collection('newsletter_subscribers').findOne({ email: testGuestEmail.toLowerCase() });
    assert.ok(doc, 'Document must exist in MongoDB');
    assert.strictEqual(doc.source, 'FOOTER');
  });

  await t.test('2. Registered User subscribe successfully', async () => {
    const res = await fetch(`${baseUrl}/newsletter/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUserEmail, source: 'FOOTER' })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 201);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.email, testUserEmail.toLowerCase());

    const doc = await db.collection('newsletter_subscribers').findOne({ email: testUserEmail.toLowerCase() });
    assert.ok(doc);
  });

  await t.test('3. Duplicate subscription returns proper message without creating new document', async () => {
    const countBefore = await db.collection('newsletter_subscribers').countDocuments({ email: testGuestEmail.toLowerCase() });
    assert.strictEqual(countBefore, 1);

    const res = await fetch(`${baseUrl}/newsletter/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testGuestEmail })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(data.message.includes('đã được đăng ký'));

    const countAfter = await db.collection('newsletter_subscribers').countDocuments({ email: testGuestEmail.toLowerCase() });
    assert.strictEqual(countAfter, 1, 'Cannot create duplicate documents');
  });

  await t.test('4. Previously unsubscribed email is re-activated when user subscribes again', async () => {
    // Manually set status to UNSUBSCRIBED
    await db.collection('newsletter_subscribers').updateOne(
      { email: testGuestEmail.toLowerCase() },
      { $set: { status: 'UNSUBSCRIBED' } }
    );

    const res = await fetch(`${baseUrl}/newsletter/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testGuestEmail })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(data.message.includes('Chào mừng bạn quay lại'));

    const doc = await db.collection('newsletter_subscribers').findOne({ email: testGuestEmail.toLowerCase() });
    assert.strictEqual(doc.status, 'SUBSCRIBED');
  });

  await t.test('5. Reject invalid email formats with 400 status', async () => {
    const invalidEmails = ['plainaddress', 'missingatsign.com', '@nodomain.com', 'test@.com'];
    for (let i = 0; i < invalidEmails.length; i++) {
      const email = invalidEmails[i];
      const res = await fetch(`${baseUrl}/newsletter/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': `192.168.1.${10 + i}`,
        },
        body: JSON.stringify({ email })
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.ok(data.message.includes('không hợp lệ'));
    }
  });

  await t.test('6. Admin API blocks non-admin users', async () => {
    // No token
    const resNoAuth = await fetch(`${baseUrl}/admin/newsletter-subscribers`);
    assert.strictEqual(resNoAuth.status, 403);

    // Regular user token
    const resUser = await fetch(`${baseUrl}/admin/newsletter-subscribers`, {
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    assert.strictEqual(resUser.status, 403);
  });

  await t.test('7. Admin API returns subscribers with user/guest customer presentation', async () => {
    const res = await fetch(`${baseUrl}/admin/newsletter-subscribers?pageSize=100`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.data));

    const guestSub = data.data.find(s => s.email === testGuestEmail.toLowerCase());
    const userSub = data.data.find(s => s.email === testUserEmail.toLowerCase());

    assert.ok(guestSub, 'Guest subscriber must be returned');
    assert.strictEqual(guestSub.customer.isGuest, true);
    assert.strictEqual(guestSub.customer.name, 'Khách vãng lai');
    assert.strictEqual(guestSub.customer.avatar, null);

    assert.ok(userSub, 'User subscriber must be returned');
    assert.strictEqual(userSub.customer.isGuest, false);
    assert.strictEqual(userSub.customer.name, 'Nguyễn Văn An');
    assert.strictEqual(userSub.customer.avatar, 'https://res.cloudinary.com/cheri/image/upload/avatar_an.jpg');
  });

  await t.test('8. Admin search by email and customer name', async () => {
    // Search by email
    const resEmail = await fetch(`${baseUrl}/admin/newsletter-subscribers?search=${testGuestEmail}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const dataEmail = await resEmail.json();
    assert.strictEqual(dataEmail.data.length, 1);
    assert.strictEqual(dataEmail.data[0].email, testGuestEmail.toLowerCase());

    // Search by user name "Nguyễn Văn An"
    const resName = await fetch(`${baseUrl}/admin/newsletter-subscribers?search=Nguyễn+Văn+An`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const dataName = await resName.json();
    assert.strictEqual(dataName.data.length, 1);
    assert.strictEqual(dataName.data[0].email, testUserEmail.toLowerCase());
  });

  await t.test('9. Admin status filter and pagination', async () => {
    // Filter by SUBSCRIBED
    const resSub = await fetch(`${baseUrl}/admin/newsletter-subscribers?status=SUBSCRIBED&pageSize=5&page=1`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const dataSub = await resSub.json();
    assert.strictEqual(dataSub.success, true);
    assert.ok(dataSub.data.every(s => s.status === 'SUBSCRIBED'));
    assert.ok(dataSub.pagination.page === 1);
  });

  await t.test('Teardown and cleanup test data', async () => {
    if (db) {
      await db.collection('newsletter_subscribers').deleteMany({
        email: { $in: [testGuestEmail.toLowerCase(), testUserEmail.toLowerCase()] }
      });
      await db.collection('users').deleteMany({
        _id: { $in: [testAdminId, testUserId] }
      });
    }
    if (server) {
      server.close();
    }
  });
});
