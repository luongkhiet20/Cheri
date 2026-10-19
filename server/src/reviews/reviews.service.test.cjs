const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { ObjectId } = mongoose.Types;

// Thiết lập ts-node transpiler cho file service TypeScript
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: 'CommonJS',
  moduleResolution: 'Node',
  experimentalDecorators: true,
  target: 'ES2022',
});
require('ts-node/register/transpile-only');

const { ReviewsService } = require('./reviews.service.ts');
const { ReviewStatus } = require('./schemas/product-review.schema.ts');

function createMockModels() {
  const p1Id = new ObjectId('6ab8f745547709e9279f68fc');
  const p2Id = new ObjectId('6ab8f745547709e9279f68fd');

  const products = [
    {
      _id: p1Id,
      id: 'prod-001',
      title: 'Đầm 2 Dây Xòe Chấm Bi Zoey Dress',
      titleUrl: 'dam-2-day-xoe-cham-bi-sang-trong-di-tiec-zoey-dress-v2409162',
      rating: 5,
    },
    {
      _id: p2Id,
      id: 'prod-002',
      title: 'Áo Corset Cổ Yếm Caro Đỏ Uzi Top',
      titleUrl: 'ao-corset-co-yem-caro-do-ho-lung-uzi-top-quan-jeans-baggy-hoa-tiet-loang-y',
      rating: 5,
    },
  ];

  const u1Id = new ObjectId('6ab231859a0a69d586366d00');
  const u2Id = new ObjectId('6ab231859a0a69d586366d01');

  const orders = [
    {
      _id: new ObjectId(),
      orderId: 'order-delivered-01',
      userId: u1Id,
      _user: u1Id,
      customerEmail: 'user1@cheri.vn',
      status: 'DELIVERED',
      items: [
        {
          productId: p1Id,
          productSnapshot: { title: 'Đầm 2 Dây Xòe' },
        },
      ],
    },
    {
      _id: new ObjectId(),
      orderId: 'order-pending-02',
      userId: u1Id,
      _user: u1Id,
      customerEmail: 'user1@cheri.vn',
      status: 'PROCESSING', // Chưa DELIVERED
      items: [
        {
          productId: p2Id,
          productSnapshot: { title: 'Áo Corset Cổ Yếm' },
        },
      ],
    },
  ];

  let reviews = [];

  const mockProductModel = {
    findOne: (filter) => {
      let p = null;
      if (filter.titleUrl) p = products.find((x) => x.titleUrl === filter.titleUrl);
      else if (filter.id) p = products.find((x) => x.id === filter.id);
      return {
        lean: async () => (p ? JSON.parse(JSON.stringify(p)) : null),
      };
    },
    findById: (id) => {
      const p = products.find((x) => x._id.toString() === id.toString());
      return {
        lean: async () => (p ? JSON.parse(JSON.stringify(p)) : null),
      };
    },
    updateOne: async (filter, update) => {
      const p = products.find((x) => x._id.toString() === filter._id.toString());
      if (p && update.rating !== undefined) {
        p.rating = update.rating;
      }
      return { acknowledged: true };
    },
    _getProducts: () => products,
  };

  const mockOrderModel = {
    findOne: (filter) => {
      const match = orders.find((o) => {
        // Kiểm tra user
        const matchUser =
          (filter.$or &&
            filter.$or.some((clause) => {
              if (clause.userId && o.userId && o.userId.toString() === clause.userId.toString()) return true;
              if (clause._user && o._user && o._user.toString() === clause._user.toString()) return true;
              if (clause.customerEmail && o.customerEmail) {
                if (clause.customerEmail.$regex) {
                  return clause.customerEmail.$regex.test(o.customerEmail);
                }
                return o.customerEmail.toLowerCase() === clause.customerEmail.toLowerCase();
              }
              if (clause['customer.email'] && o.customerEmail) {
                if (clause['customer.email'].$regex) {
                  return clause['customer.email'].$regex.test(o.customerEmail);
                }
                return o.customerEmail.toLowerCase() === clause['customer.email'].toLowerCase();
              }
              return false;
            })) ||
          false;

        // Kiểm tra status
        const matchStatus =
          filter.status &&
          filter.status.$in &&
          filter.status.$in.includes(o.status);

        // Kiểm tra items.productId
        let matchProduct = false;
        const prodTarget = filter['items.productId'];
        if (prodTarget) {
          if (prodTarget.$in && Array.isArray(prodTarget.$in)) {
            matchProduct = o.items.some((it) =>
              prodTarget.$in.some((val) => val.toString() === it.productId.toString()),
            );
          } else {
            matchProduct = o.items.some(
              (it) => it.productId.toString() === prodTarget.toString(),
            );
          }
        }

        // Kiểm tra orderId nếu có
        let matchOrderId = true;
        if (filter.orderId) {
          matchOrderId = o.orderId === filter.orderId;
        } else if (filter.$and && Array.isArray(filter.$and)) {
          const ordClause = filter.$and.find((c) => c.$or && c.$or.some((sc) => sc.orderId || sc._id));
          if (ordClause) {
            matchOrderId = ordClause.$or.some((sc) => {
              const scOrderId = sc.orderId?.toString();
              const scId = sc._id?.toString();
              return (
                (scOrderId && (scOrderId === o.orderId || (sc.orderId && sc.orderId.$regex && sc.orderId.$regex.test(o.orderId)))) ||
                (scId && scId === o._id?.toString())
              );
            });
          }
        }

        return matchUser && matchStatus && matchProduct && matchOrderId;
      });

      return {
        lean: async () => (match ? JSON.parse(JSON.stringify(match)) : null),
      };
    },
    exists: async (filter) => {
      const res = mockOrderModel.findOne(filter);
      const data = await res.lean();
      return !!data;
    },
    _orders: orders,
    _addOrder: (o) => orders.push(o),
  };

  function MockReviewDocument(data) {
    Object.assign(this, data);
    this._id = data._id || new ObjectId();
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.save = async () => {
      const existingIdx = reviews.findIndex((r) => r._id.toString() === this._id.toString());
      if (existingIdx >= 0) {
        reviews[existingIdx] = this;
      } else {
        reviews.push(this);
      }
      return this;
    };
  }

  const mockReviewModel = function (data) {
    return new MockReviewDocument(data);
  };

  mockReviewModel.findOne = (filter) => {
    let r = null;
    const targetUserId =
      filter.userId ||
      (filter.$or && filter.$or.find((c) => c.userId)?.userId);
    if (filter.productId && targetUserId) {
      r = reviews.find(
        (x) =>
          x.productId.toString() === filter.productId.toString() &&
          x.userId.toString() === targetUserId.toString() &&
          (!filter.orderId || !x.orderId || x.orderId === filter.orderId),
      );
    }
    const val = r ? JSON.parse(JSON.stringify(r)) : null;
    const prom = Promise.resolve(val);
    prom.lean = async () => val;
    return prom;
  };

  mockReviewModel.findById = async (id) => {
    const r = reviews.find((x) => x._id.toString() === id.toString());
    return r || null;
  };

  mockReviewModel.findByIdAndDelete = async (id) => {
    reviews = reviews.filter((x) => x._id.toString() !== id.toString());
    return { acknowledged: true };
  };

  mockReviewModel.find = (filter) => {
    let result = reviews.filter((r) => {
      if (filter.productId && r.productId.toString() !== filter.productId.toString()) {
        return false;
      }
      if (filter.status && r.status !== filter.status) {
        return false;
      }
      if (filter.rating && r.rating !== filter.rating) {
        return false;
      }
      return true;
    });

    const chain = {
      sort: (sortObj) => {
        if (sortObj.rating) {
          result.sort((a, b) => (sortObj.rating === -1 ? b.rating - a.rating : a.rating - b.rating));
        } else if (sortObj.createdAt) {
          result.sort((a, b) =>
            sortObj.createdAt === -1
              ? new Date(b.createdAt) - new Date(a.createdAt)
              : new Date(a.createdAt) - new Date(b.createdAt),
          );
        }
        return chain;
      },
      skip: (n) => {
        result = result.slice(n);
        return chain;
      },
      limit: (n) => {
        result = result.slice(0, n);
        return chain;
      },
      lean: async () => JSON.parse(JSON.stringify(result)),
    };
    return chain;
  };

  mockReviewModel.countDocuments = async (filter) => {
    return reviews.filter((r) => {
      if (filter.productId && r.productId.toString() !== filter.productId.toString()) {
        return false;
      }
      if (filter.status && r.status !== filter.status) {
        return false;
      }
      if (filter.rating && r.rating !== filter.rating) {
        return false;
      }
      return true;
    }).length;
  };

  mockReviewModel.aggregate = async (pipeline) => {
    const matchStage = pipeline.find((p) => p.$match);
    let filtered = reviews;
    if (matchStage && matchStage.$match) {
      filtered = reviews.filter((r) => {
        if (
          matchStage.$match.productId &&
          r.productId.toString() !== matchStage.$match.productId.toString()
        ) {
          return false;
        }
        if (matchStage.$match.status && r.status !== matchStage.$match.status) {
          return false;
        }
        return true;
      });
    }

    const groupStage = pipeline.find((p) => p.$group);
    if (groupStage) {
      const groups = {};
      for (const r of filtered) {
        const key = r.rating;
        groups[key] = (groups[key] || 0) + 1;
      }
      return Object.keys(groups).map((k) => ({
        _id: Number(k),
        count: groups[k],
      }));
    }
    return [];
  };

  mockReviewModel._getReviews = () => reviews;
  mockReviewModel._addReview = (r) => reviews.push(r);

  return {
    productModel: mockProductModel,
    orderModel: mockOrderModel,
    reviewModel: mockReviewModel,
    p1Id,
    p2Id,
    u1Id,
    u2Id,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE: PRODUCT REVIEWS SERVICE
// ─────────────────────────────────────────────────────────────────────────────

test('1. Tạo review thất bại nếu sản phẩm không tồn tại trong hệ thống', async () => {
  const { reviewModel, productModel, orderModel, u1Id } = createMockModels();
  const service = new ReviewsService(reviewModel, productModel, orderModel);

  await assert.rejects(
    async () => {
      await service.createReview(u1Id.toString(), { name: 'User 1' }, {
        productId: 'san-pham-khong-ton-tai-xyz',
        rating: 5,
        comment: 'Sản phẩm rất đẹp',
      });
    },
    /Không tìm thấy sản phẩm/,
  );
});

test('2. Chặn người dùng đánh giá khi chưa mua hàng hoặc đơn hàng chưa DELIVERED', async () => {
  const { reviewModel, productModel, orderModel, p2Id, u1Id, u2Id } = createMockModels();
  const service = new ReviewsService(reviewModel, productModel, orderModel);

  // User 2 chưa từng mua sản phẩm 1
  await assert.rejects(
    async () => {
      await service.createReview(u2Id.toString(), { name: 'User 2' }, {
        productId: 'dam-2-day-xoe-cham-bi-sang-trong-di-tiec-zoey-dress-v2409162',
        rating: 5,
        comment: 'Chưa mua nhưng muốn đánh giá thử',
      });
    },
    /Bạn chỉ có thể đánh giá sản phẩm sau khi đã mua và nhận hàng thành công/,
  );

  // User 1 đã mua sản phẩm 2 nhưng trạng thái đơn hàng là PROCESSING (chưa DELIVERED)
  await assert.rejects(
    async () => {
      await service.createReview(u1Id.toString(), { name: 'User 1' }, {
        productId: p2Id.toString(),
        rating: 5,
        comment: 'Đang xử lý đơn chưa nhận hàng',
      });
    },
    /Bạn chỉ có thể đánh giá sản phẩm sau khi đã mua và nhận hàng thành công/,
  );
});

test('3. Tạo đánh giá thành công khi đơn hàng đã DELIVERED, tự động xác thực isVerifiedPurchase', async () => {
  const { reviewModel, productModel, orderModel, p1Id, u1Id } = createMockModels();
  const service = new ReviewsService(reviewModel, productModel, orderModel);

  const review = await service.createReview(
    u1Id.toString(),
    { fullName: 'Trần Thị Mai', email: 'user1@cheri.vn', avatar: 'avatar1.png' },
    {
      productId: 'dam-2-day-xoe-cham-bi-sang-trong-di-tiec-zoey-dress-v2409162',
      rating: 5,
      comment: 'Vải mềm mại tôn dáng, đóng gói cẩn thận sang trọng!',
    },
  );

  assert.equal(review.productId.toString(), p1Id.toString());
  assert.equal(review.userId.toString(), u1Id.toString());
  assert.equal(review.rating, 5);
  assert.equal(review.comment, 'Vải mềm mại tôn dáng, đóng gói cẩn thận sang trọng!');
  assert.equal(review.userName, 'Trần Thị Mai');
  assert.equal(review.isVerifiedPurchase, true);
  assert.equal(review.status, ReviewStatus.APPROVED);
});

test('4. Chặn đánh giá trùng lặp: một khách hàng chỉ được đánh giá 1 lần cho 1 sản phẩm', async () => {
  const { reviewModel, productModel, orderModel, u1Id } = createMockModels();
  const service = new ReviewsService(reviewModel, productModel, orderModel);

  // Lần 1: Thành công
  await service.createReview(
    u1Id.toString(),
    { name: 'User 1', email: 'user1@cheri.vn' },
    {
      productId: 'dam-2-day-xoe-cham-bi-sang-trong-di-tiec-zoey-dress-v2409162',
      rating: 5,
      comment: 'Đánh giá lần 1',
    },
  );

  // Lần 2: Thất bại với ConflictException
  await assert.rejects(
    async () => {
      await service.createReview(
        u1Id.toString(),
        { name: 'User 1', email: 'user1@cheri.vn' },
        {
          productId: 'dam-2-day-xoe-cham-bi-sang-trong-di-tiec-zoey-dress-v2409162',
          rating: 4,
          comment: 'Đánh giá lần 2 trùng lặp',
        },
      );
    },
    /Bạn đã gửi đánh giá cho sản phẩm này rồi/,
  );
});

test('5. Lấy danh sách review theo sản phẩm: chỉ hiển thị review APPROVED và hỗ trợ phân trang', async () => {
  const { reviewModel, productModel, orderModel, p1Id, u1Id, u2Id } = createMockModels();
  const service = new ReviewsService(reviewModel, productModel, orderModel);

  // Thêm 2 review APPROVED và 1 review REJECTED
  reviewModel._addReview({
    _id: new ObjectId(),
    productId: p1Id,
    userId: u1Id,
    rating: 5,
    comment: 'Tuyệt vời',
    status: ReviewStatus.APPROVED,
    createdAt: new Date('2026-10-01'),
  });
  reviewModel._addReview({
    _id: new ObjectId(),
    productId: p1Id,
    userId: u2Id,
    rating: 4,
    comment: 'Rất ưng ý',
    status: ReviewStatus.APPROVED,
    createdAt: new Date('2026-10-02'),
  });
  reviewModel._addReview({
    _id: new ObjectId(),
    productId: p1Id,
    userId: new ObjectId(),
    rating: 1,
    comment: 'Spam xúc phạm',
    status: ReviewStatus.REJECTED, // Đã bị từ chối
    createdAt: new Date('2026-10-03'),
  });

  const res = await service.getReviewsByProduct('dam-2-day-xoe-cham-bi-sang-trong-di-tiec-zoey-dress-v2409162', {
    page: 1,
    limit: 10,
    sortBy: 'newest',
  });

  // Chỉ trả về 2 review APPROVED
  assert.equal(res.reviews.length, 2);
  assert.equal(res.pagination.total, 2);
  assert.equal(res.reviews[0].comment, 'Rất ưng ý'); // Mới hơn
  assert.equal(res.reviews[1].comment, 'Tuyệt vời');
});

test('6. Lọc review theo số sao và thống kê điểm trung bình, phân bố sao', async () => {
  const { reviewModel, productModel, orderModel, p1Id } = createMockModels();
  const service = new ReviewsService(reviewModel, productModel, orderModel);

  reviewModel._addReview({
    _id: new ObjectId(),
    productId: p1Id,
    rating: 5,
    comment: '5 sao',
    status: ReviewStatus.APPROVED,
  });
  reviewModel._addReview({
    _id: new ObjectId(),
    productId: p1Id,
    rating: 5,
    comment: '5 sao tiếp',
    status: ReviewStatus.APPROVED,
  });
  reviewModel._addReview({
    _id: new ObjectId(),
    productId: p1Id,
    rating: 4,
    comment: '4 sao',
    status: ReviewStatus.APPROVED,
  });

  // Lọc chỉ xem 4 sao
  const filteredRes = await service.getReviewsByProduct(p1Id.toString(), { rating: 4 });
  assert.equal(filteredRes.reviews.length, 1);
  assert.equal(filteredRes.reviews[0].rating, 4);

  // Thống kê sao
  const stats = await service.getProductReviewStats(p1Id.toString());
  assert.equal(stats.reviewCount, 3);
  // Điểm TB: (5 + 5 + 4) / 3 = 4.666... -> 4.7
  assert.equal(stats.averageRating, 4.7);
  assert.equal(stats.distribution[5].count, 2);
  assert.equal(stats.distribution[4].count, 1);
  assert.equal(stats.distribution[3].count, 0);
  assert.equal(stats.distribution[5].percentage, 67); // 2/3 ≈ 67%
});

test('7. Kiểm tra quyền đánh giá với checkEligibility', async () => {
  const { reviewModel, productModel, orderModel, p1Id, p2Id, u1Id, u2Id } = createMockModels();
  const service = new ReviewsService(reviewModel, productModel, orderModel);

  // User 1 đủ điều kiện với sản phẩm 1 (đơn hàng DELIVERED)
  const elig1 = await service.checkEligibility(u1Id.toString(), 'user1@cheri.vn', p1Id.toString());
  assert.equal(elig1.canReview, true);
  assert.equal(elig1.hasReviewed, false);

  // User 2 chưa mua sản phẩm 1
  const elig2 = await service.checkEligibility(u2Id.toString(), 'user2@cheri.vn', p1Id.toString());
  assert.equal(elig2.canReview, false);
  assert.equal(elig2.hasReviewed, false);
  assert.match(elig2.reason, /Bạn chỉ có thể đánh giá sau khi đã mua và nhận sản phẩm thành công/);

  // Sau khi User 1 đánh giá
  await service.createReview(
    u1Id.toString(),
    { name: 'User 1', email: 'user1@cheri.vn' },
    { productId: p1Id.toString(), rating: 5, comment: 'Đã mua' },
  );

  const elig1After = await service.checkEligibility(u1Id.toString(), 'user1@cheri.vn', p1Id.toString());
  assert.equal(elig1After.canReview, false);
  assert.equal(elig1After.hasReviewed, true);
  assert.match(elig1After.reason, /Bạn đã đánh giá sản phẩm này/);
});

test('8. Chỉnh sửa và xóa đánh giá: kiểm tra phân quyền người dùng và Quản trị viên', async () => {
  const { reviewModel, productModel, orderModel, p1Id, u1Id, u2Id } = createMockModels();
  const service = new ReviewsService(reviewModel, productModel, orderModel);

  const review = await service.createReview(
    u1Id.toString(),
    { name: 'User 1', email: 'user1@cheri.vn' },
    { productId: p1Id.toString(), rating: 4, comment: 'Bình luận ban đầu' },
  );

  // User 2 không có quyền sửa review của User 1
  await assert.rejects(
    async () => {
      await service.updateReview(review._id.toString(), u2Id.toString(), {
        comment: 'User 2 sửa lén',
      });
    },
    /Bạn không có quyền chỉnh sửa đánh giá này/,
  );

  // User 1 sửa thành công
  const updated = await service.updateReview(review._id.toString(), u1Id.toString(), {
    rating: 5,
    comment: 'Bình luận đã cập nhật lên 5 sao',
  });
  assert.equal(updated.rating, 5);
  assert.equal(updated.comment, 'Bình luận đã cập nhật lên 5 sao');

  // User 2 không có quyền xóa review của User 1
  await assert.rejects(
    async () => {
      await service.deleteReview(review._id.toString(), { _id: u2Id, roles: ['user'] });
    },
    /Bạn không có quyền xóa đánh giá này/,
  );

  // Admin có quyền xóa bất kỳ review nào
  const deleteRes = await service.deleteReview(review._id.toString(), {
    _id: u2Id,
    roles: ['admin'],
  });
  assert.equal(deleteRes.success, true);

  // Xác nhận review đã bị xóa
  const check = await reviewModel.findById(review._id.toString());
  assert.equal(check, null);
});

test('9. Admin duyệt và từ chối review với updateReviewStatusByAdmin', async () => {
  const { reviewModel, productModel, orderModel, p1Id, u1Id } = createMockModels();
  const service = new ReviewsService(reviewModel, productModel, orderModel);

  const review = await service.createReview(
    u1Id.toString(),
    { name: 'User 1', email: 'user1@cheri.vn' },
    { productId: p1Id.toString(), rating: 5, comment: 'Đánh giá cần duyệt' },
  );

  // Admin chuyển trạng thái sang REJECTED
  const rejected = await service.updateReviewStatusByAdmin(
    review._id.toString(),
    ReviewStatus.REJECTED,
  );
  assert.equal(rejected.status, ReviewStatus.REJECTED);

  // Review bị từ chối sẽ không còn xuất hiện ở danh sách công khai
  const publicList = await service.getReviewsByProduct(p1Id.toString(), {});
  assert.equal(publicList.reviews.length, 0);
});

test('10. Kiểm tra điều kiện đánh giá theo trạng thái yêu cầu trả hàng / hoàn tiền', async () => {
  const { reviewModel, productModel, orderModel, p1Id, p2Id, u1Id } = createMockModels();
  const service = new ReviewsService(reviewModel, productModel, orderModel);

  // 1. Đơn hàng DELIVERED, không có yêu cầu trả hàng -> được đánh giá
  const eligNoReturn = await service.checkEligibility(u1Id.toString(), 'user1@cheri.vn', p1Id.toString());
  assert.equal(eligNoReturn.canReview, true);

  // 2. Đơn hàng DELIVERED, có yêu cầu trả hàng đang PENDING -> bị chặn
  const orderPendingReturn = {
    _id: new ObjectId(),
    orderId: 'order-ret-pending',
    userId: u1Id,
    _user: u1Id,
    customerEmail: 'user1@cheri.vn',
    status: 'DELIVERED',
    items: [{ productId: p2Id, productSnapshot: { title: 'Áo Corset Cổ Yếm' } }],
    returnRequests: [{ requestId: 'ret-1', status: 'PENDING' }],
  };
  orderModel._addOrder(orderPendingReturn);

  const eligPending = await service.checkEligibility(u1Id.toString(), 'user1@cheri.vn', p2Id.toString(), 'order-ret-pending');
  assert.equal(eligPending.canReview, false);
  assert.match(eligPending.reason, /yêu cầu trả hàng \/ hoàn tiền/);

  // Thử gọi createReview trực tiếp cũng phải bị chặn bằng BadRequestException
  await assert.rejects(
    async () => {
      await service.createReview(
        u1Id.toString(),
        { name: 'User 1', email: 'user1@cheri.vn' },
        { productId: p2Id.toString(), orderId: 'order-ret-pending', rating: 5, comment: 'Thử review' },
      );
    },
    (err) => {
      assert.match(err.message, /yêu cầu trả hàng \/ hoàn tiền/);
      return true;
    },
  );

  // 3. Đơn hàng DELIVERED, yêu cầu trả hàng đã hủy 'CANC' -> được đánh giá
  orderPendingReturn.returnRequests = [{ requestId: 'ret-1', status: 'CANC' }];
  const eligCancelledCANC = await service.checkEligibility(u1Id.toString(), 'user1@cheri.vn', p2Id.toString(), 'order-ret-pending');
  assert.equal(eligCancelledCANC.canReview, true);

  // 4. Đơn hàng DELIVERED, yêu cầu trả hàng đã hủy 'CANCELLED' -> được đánh giá
  orderPendingReturn.returnRequests = [{ requestId: 'ret-1', status: 'CANCELLED' }];
  const eligCancelledFull = await service.checkEligibility(u1Id.toString(), 'user1@cheri.vn', p2Id.toString(), 'order-ret-pending');
  assert.equal(eligCancelledFull.canReview, true);

  // 5. Đơn hàng DELIVERED, yêu cầu trả hàng bị từ chối 'REJECTED' -> được đánh giá
  orderPendingReturn.returnRequests = [{ requestId: 'ret-1', status: 'REJECTED' }];
  const eligRejected = await service.checkEligibility(u1Id.toString(), 'user1@cheri.vn', p2Id.toString(), 'order-ret-pending');
  assert.equal(eligRejected.canReview, true);

  // 6. Đơn hàng có nhiều yêu cầu, tất cả đã hủy -> được đánh giá
  orderPendingReturn.returnRequests = [
    { requestId: 'ret-1', status: 'CANC' },
    { requestId: 'ret-2', status: 'CANCELLED' },
    { requestId: 'ret-3', status: 'REJECTED' },
  ];
  const eligAllInactive = await service.checkEligibility(u1Id.toString(), 'user1@cheri.vn', p2Id.toString(), 'order-ret-pending');
  assert.equal(eligAllInactive.canReview, true);

  // 7. Đơn hàng có nhiều yêu cầu, nhưng còn 1 yêu cầu PENDING -> bị chặn
  orderPendingReturn.returnRequests.push({ requestId: 'ret-4', status: 'PENDING' });
  const eligOneStillActive = await service.checkEligibility(u1Id.toString(), 'user1@cheri.vn', p2Id.toString(), 'order-ret-pending');
  assert.equal(eligOneStillActive.canReview, false);

  // 8. Khi đưa về đã hủy, createReview thành công
  orderPendingReturn.returnRequests = [{ requestId: 'ret-1', status: 'CANC' }];
  const created = await service.createReview(
    u1Id.toString(),
    { name: 'User 1', email: 'user1@cheri.vn' },
    { productId: p2Id.toString(), orderId: 'order-ret-pending', rating: 5, comment: 'Sản phẩm rất đẹp sau khi hủy trả hàng' },
  );
  assert.ok(created);
  assert.equal(created.rating, 5);

  // 9. Không thể gửi đánh giá trùng
  const eligAfterReview = await service.checkEligibility(u1Id.toString(), 'user1@cheri.vn', p2Id.toString(), 'order-ret-pending');
  assert.equal(eligAfterReview.canReview, false);
  assert.equal(eligAfterReview.hasReviewed, true);
});

