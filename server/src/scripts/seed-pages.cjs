const path = require('node:path');
const dotenv = require('dotenv');
const { MongoClient } = require('mongodb');

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const PAGES_SEED_DATA = [
  {
    titleUrl: 'ordering-guide',
    vi: {
      title: 'Hướng dẫn đặt hàng',
      contentHTML: `<p>Chào mừng bạn đến với Chéri! Dưới đây là các bước đơn giản giúp bạn đặt hàng nhanh chóng trên website của chúng tôi:</p>
<h3>Bước 1: Tìm kiếm và chọn sản phẩm</h3>
<p>Duyệt qua danh mục sản phẩm hoặc sử dụng thanh tìm kiếm để tìm món đồ ưng ý. Chọn kích cỡ, màu sắc và số lượng phù hợp, sau đó nhấn <strong>Thêm vào giỏ hàng</strong>.</p>
<h3>Bước 2: Kiểm tra giỏ hàng</h3>
<p>Nhấp vào biểu tượng giỏ hàng ở góc phải màn hình để xem lại danh sách sản phẩm đã chọn, số lượng và tổng tiền tạm tính.</p>
<h3>Bước 3: Nhập thông tin giao hàng & thanh toán</h3>
<p>Điền đầy đủ họ tên, số điện thoại, địa chỉ nhận hàng và chọn phương thức thanh toán phù hợp (COD, chuyển khoản ngân hàng, v.v.).</p>
<h3>Bước 4: Xác nhận đơn hàng</h3>
<p>Kiểm tra lại toàn bộ thông tin và nhấn <strong>Đặt hàng</strong>. Bạn sẽ nhận được mã đơn hàng và email xác nhận chi tiết.</p>`,
      visibility: true,
      metaDescription: 'Hướng dẫn các bước đặt mua sản phẩm nhanh chóng, an toàn và thuận tiện tại Chéri.'
    },
    en: {
      title: 'Ordering Guide',
      contentHTML: '<p>Step-by-step guide to placing an order at Chéri e-commerce store.</p>'
    }
  },
  {
    titleUrl: 'faqs',
    vi: {
      title: 'Câu hỏi thường gặp',
      contentHTML: `<p>Dưới đây là những thắc mắc thường gặp của khách hàng khi mua sắm tại Chéri:</p>
<h3>1. Tôi có thể kiểm tra hàng trước khi thanh toán không?</h3>
<p>Có, Chéri hỗ trợ đồng kiểm khi nhận hàng đối với tất cả các đơn hàng vận chuyển toàn quốc.</p>
<h3>2. Thời gian giao hàng mất bao lâu?</h3>
<p>Khu vực nội thành TP.HCM: 1 - 2 ngày làm việc. Các tỉnh thành khác: 2 - 4 ngày làm việc.</p>
<h3>3. Làm sao để biết đơn hàng của tôi đã được xác nhận?</h3>
<p>Hệ thống sẽ gửi email xác nhận và bạn có thể tra cứu trạng thái đơn hàng trực tiếp tại trang <strong>Theo dõi đơn hàng</strong>.</p>
<h3>4. Tôi muốn đổi size thì phải làm thế nào?</h3>
<p>Vui lòng liên hệ hotline hoặc gửi yêu cầu đổi hàng trong vòng 7 ngày kể từ ngày nhận sản phẩm theo chính sách đổi trả của chúng tôi.</p>`,
      visibility: true,
      metaDescription: 'Tổng hợp các câu hỏi thường gặp về mua sắm, thanh toán và bảo hành tại Chéri.'
    },
    en: {
      title: 'Frequently Asked Questions',
      contentHTML: '<p>Frequently asked questions about shopping and services at Chéri.</p>'
    }
  },
  {
    titleUrl: 'return-policy',
    vi: {
      title: 'Chính sách đổi trả',
      contentHTML: `<p>Chéri luôn mong muốn mang lại trải nghiệm mua sắm hài lòng nhất cho quý khách. Dưới đây là quy định chi tiết về chính sách đổi trả hàng hóa:</p>
<h3>1. Thời hạn đổi trả</h3>
<p>Khách hàng có thể yêu cầu đổi trả sản phẩm trong vòng <strong>7 ngày</strong> kể từ ngày nhận hàng thành công.</p>
<h3>2. Điều kiện áp dụng</h3>
<ul>
  <li>Sản phẩm còn nguyên tem mác, chưa qua sử dụng, chưa qua giặt tẩy.</li>
  <li>Còn đầy đủ hóa đơn hoặc thông tin đơn hàng đã mua tại Chéri.</li>
  <li>Sản phẩm không nằm trong danh mục xả hàng hoặc quà tặng khuyến mãi đặc biệt.</li>
</ul>
<h3>3. Chi phí đổi trả</h3>
<p>Trường hợp lỗi do nhà sản xuất hoặc gửi sai mẫu: Chéri chịu 100% phí vận chuyển 2 chiều.</p>
<p>Trường hợp khách hàng muốn đổi size/màu theo nhu cầu: Khách hàng vui lòng thanh toán phí ship chiều gửi về.</p>`,
      visibility: true,
      metaDescription: 'Quy định và điều kiện đổi trả hàng hóa trong vòng 7 ngày tại Chéri.'
    },
    en: {
      title: 'Return Policy',
      contentHTML: '<p>Detailed return and exchange policy for products purchased at Chéri.</p>'
    }
  },
  {
    titleUrl: 'warranty-policy',
    vi: {
      title: 'Chính sách bảo hành',
      contentHTML: `<p>Chéri cam kết chất lượng sản phẩm chính hãng với chính sách bảo hành chu đáo dành cho khách hàng:</p>
<h3>1. Thời gian bảo hành</h3>
<p>Thời hạn bảo hành tiêu chuẩn từ <strong>1 đến 6 tháng</strong> tùy thuộc vào từng dòng sản phẩm cụ thể kể từ ngày mua.</p>
<h3>2. Phạm vi bảo hành</h3>
<ul>
  <li>Lỗi đường may, chỉ may, khuy bấm hoặc phụ kiện đi kèm do lỗi kỹ thuật từ nhà sản xuất.</li>
  <li>Lỗi chất liệu phát sinh trong điều kiện sử dụng bình thường theo hướng dẫn bảo quản.</li>
</ul>
<h3>3. Các trường hợp không bảo hành</h3>
<ul>
  <li>Sản phẩm bị hư hỏng do tác động ngoại lực, rách xước do va chạm vật nhọn.</li>
  <li>Bảo quản sai cách: giặt sấy nhiệt độ cao, sử dụng chất tẩy mạnh làm phai màu.</li>
  <li>Sản phẩm đã quá hạn bảo hành quy định.</li>
</ul>`,
      visibility: true,
      metaDescription: 'Chính sách bảo hành chính hãng và hỗ trợ sửa chữa sản phẩm tại Chéri.'
    },
    en: {
      title: 'Warranty Policy',
      contentHTML: '<p>Warranty coverage and terms for fashion and accessory products at Chéri.</p>'
    }
  },
  {
    titleUrl: 'privacy-policy',
    vi: {
      title: 'Chính sách bảo mật',
      contentHTML: `<p>Chéri tôn trọng và cam kết bảo vệ quyền riêng tư cũng như dữ liệu cá nhân của mọi khách hàng khi truy cập và mua sắm trên hệ thống của chúng tôi.</p>
<h3>1. Thu thập thông tin</h3>
<p>Chúng tôi chỉ thu thập các thông tin cần thiết phục vụ cho việc xử lý đơn hàng và chăm sóc khách hàng bao gồm: Họ tên, số điện thoại, địa chỉ nhận hàng và email.</p>
<h3>2. Mục đích sử dụng</h3>
<ul>
  <li>Xử lý và giao đơn hàng đến đúng địa chỉ khách hàng cung cấp.</li>
  <li>Cập nhật trạng thái đơn hàng và hỗ trợ khi có phát sinh.</li>
  <li>Gửi thông tin ưu đãi nếu khách hàng đồng ý nhận tin khuyến mãi.</li>
</ul>
<h3>3. Cam kết bảo mật</h3>
<p>Chéri tuyệt đối không bán, chia sẻ hoặc tiết lộ thông tin của quý khách cho bên thứ ba vì mục đích thương mại, ngoại trừ các đơn vị vận chuyển đối tác phục vụ giao nhận hàng hóa.</p>`,
      visibility: true,
      metaDescription: 'Cam kết bảo mật an toàn tuyệt đối thông tin cá nhân của khách hàng tại Chéri.'
    },
    en: {
      title: 'Privacy Policy',
      contentHTML: '<p>Privacy policy and customer data protection principles at Chéri.</p>'
    }
  },
  {
    titleUrl: 'shipping-policy',
    vi: {
      title: 'Chính sách vận chuyển - giao hàng',
      contentHTML: `<p>Chéri cung cấp dịch vụ giao hàng tận nơi trên toàn quốc với mức phí và thời gian giao hàng tối ưu:</p>
<h3>1. Phạm vi giao hàng</h3>
<p>Chúng tôi hỗ trợ giao hàng tới 63 tỉnh thành trên toàn lãnh thổ Việt Nam thông qua các đối tác vận chuyển uy tín (Giao Hàng Nhanh, Giao Hàng Tiết Kiệm, Viettel Post...).</p>
<h3>2. Thời gian giao hàng</h3>
<ul>
  <li><strong>Nội thành TP.HCM:</strong> 1 - 2 ngày làm việc.</li>
  <li><strong>Các tỉnh thành miền Nam:</strong> 2 - 3 ngày làm việc.</li>
  <li><strong>Miền Trung & Miền Bắc:</strong> 3 - 5 ngày làm việc.</li>
</ul>
<h3>3. Cước phí vận chuyển</h3>
<p>Cước phí tiêu chuẩn từ 30.000đ - 50.000đ tùy theo khu vực nhận hàng. Miễn phí vận chuyển toàn quốc cho các đơn hàng đạt giá trị tối thiểu theo chính sách khuyến mãi hiện hành.</p>`,
      visibility: true,
      metaDescription: 'Thời gian, cước phí và quy trình giao nhận hàng hóa trên toàn quốc của Chéri.'
    },
    en: {
      title: 'Shipping & Delivery Policy',
      contentHTML: '<p>Nationwide shipping rates, delivery times and courier options at Chéri.</p>'
    }
  },
  {
    titleUrl: 'terms-of-service',
    vi: {
      title: 'Điều khoản sử dụng',
      contentHTML: `<p>Khi truy cập và đặt mua sản phẩm tại website Chéri, quý khách mặc nhiên đồng ý với các điều khoản và điều kiện sử dụng dưới đây:</p>
<h3>1. Tài khoản & Trách nhiệm người dùng</h3>
<p>Khách hàng có trách nhiệm cung cấp thông tin chính xác khi đặt hàng hoặc đăng ký tài khoản và tự bảo mật thông tin tài khoản cá nhân của mình.</p>
<h3>2. Giá cả & Thanh toán</h3>
<p>Giá hiển thị trên website là giá niêm yết bằng Việt Nam Đồng (VNĐ). Chéri có quyền điều chỉnh giá sản phẩm và các chương trình khuyến mãi theo từng thời điểm mà không cần thông báo trước.</p>
<h3>3. Bản quyền nội dung</h3>
<p>Mọi hình ảnh sản phẩm, nội dung bài viết và thương hiệu Chéri trên website đều thuộc quyền sở hữu của Chéri, nghiêm cấm sao chép hoặc sử dụng cho mục đích thương mại khi chưa có sự cho phép bằng văn bản.</p>`,
      visibility: true,
      metaDescription: 'Các quy định và điều khoản ràng buộc khi khách hàng sử dụng dịch vụ tại Chéri.'
    },
    en: {
      title: 'Terms of Service',
      contentHTML: '<p>Terms and conditions governing the use of the Chéri website and online services.</p>'
    }
  }
];

async function seedPages() {
  const mongoUri = process.env.MONGO_URI || "mongodb+srv://tinhvttk24411_db_user:gZ7aJJyCWgYffiXa@cluster0.cbvni8r.mongodb.net/cheri?retryWrites=true&w=majority";
  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    const db = client.db('cheri');
    const pagesCol = db.collection('pages');

    let createdCount = 0;
    let existingCount = 0;

    for (const pageData of PAGES_SEED_DATA) {
      const existing = await pagesCol.findOne({ titleUrl: pageData.titleUrl });

      if (existing) {
        existingCount++;
        console.log(`[EXISTING] Page '${pageData.titleUrl}' already exists (ID: ${existing._id}). Skipping to preserve data.`);
      } else {
        const now = new Date();
        const doc = {
          titleUrl: pageData.titleUrl,
          status: 'published',
          dateAdded: now,
          updatedAt: now.toISOString(),
          vi: pageData.vi,
          en: pageData.en,
          __v: 0
        };

        const result = await pagesCol.insertOne(doc);
        createdCount++;
        console.log(`[CREATED] Page '${pageData.titleUrl}' seeded successfully (ID: ${result.insertedId}).`);
      }
    }

    console.log(`\nSeed completed! Created: ${createdCount}, Existing skipped: ${existingCount}`);
  } catch (err) {
    console.error('Error seeding pages:', err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  seedPages();
}

module.exports = { seedPages, PAGES_SEED_DATA };
