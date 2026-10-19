require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { validate } = require('class-validator');
const { plainToInstance } = require('class-transformer');

// Setup ts-node compiler
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: 'CommonJS',
  moduleResolution: 'Node',
  experimentalDecorators: true,
  target: 'ES2022',
});
require('ts-node/register/transpile-only');

const { CreateReviewDto } = require('./dto/create-review.dto.ts');
const { UpdateReviewDto } = require('./dto/update-review.dto.ts');
const { QueryReviewDto } = require('./dto/query-review.dto.ts');

test('DTO 1. Validate rating phải nằm trong khoảng 1 đến 5 sao', async () => {
  // Rating = 0 (dưới 1) -> Lỗi
  const dto0 = plainToInstance(CreateReviewDto, {
    productId: 'prod-001',
    rating: 0,
    comment: 'Sản phẩm tốt',
  });
  const errors0 = await validate(dto0);
  assert.equal(errors0.some((e) => e.property === 'rating'), true);

  // Rating = 6 (trên 5) -> Lỗi
  const dto6 = plainToInstance(CreateReviewDto, {
    productId: 'prod-001',
    rating: 6,
    comment: 'Sản phẩm tốt',
  });
  const errors6 = await validate(dto6);
  assert.equal(errors6.some((e) => e.property === 'rating'), true);

  // Rating = -1 (âm) -> Lỗi
  const dtoNeg = plainToInstance(CreateReviewDto, {
    productId: 'prod-001',
    rating: -1,
    comment: 'Sản phẩm tốt',
  });
  const errorsNeg = await validate(dtoNeg);
  assert.equal(errorsNeg.some((e) => e.property === 'rating'), true);

  // Rating = 5 (hợp lệ) -> Không lỗi rating
  const dto5 = plainToInstance(CreateReviewDto, {
    productId: 'prod-001',
    rating: 5,
    comment: 'Sản phẩm tuyệt vời',
  });
  const errors5 = await validate(dto5);
  assert.equal(errors5.some((e) => e.property === 'rating'), false);
});

test('DTO 2. Validate nội dung bình luận (comment) không được rỗng hoặc vượt quá 2000 ký tự', async () => {
  // Comment rỗng
  const dtoEmpty = plainToInstance(CreateReviewDto, {
    productId: 'prod-001',
    rating: 5,
    comment: '',
  });
  const errorsEmpty = await validate(dtoEmpty);
  assert.equal(errorsEmpty.some((e) => e.property === 'comment'), true);

  // Comment quá ngắn (< 3 ký tự)
  const dtoShort = plainToInstance(CreateReviewDto, {
    productId: 'prod-001',
    rating: 5,
    comment: 'ok',
  });
  const errorsShort = await validate(dtoShort);
  assert.equal(errorsShort.some((e) => e.property === 'comment'), true);

  // Comment vượt quá 2000 ký tự
  const dtoLong = plainToInstance(CreateReviewDto, {
    productId: 'prod-001',
    rating: 5,
    comment: 'a'.repeat(2001),
  });
  const errorsLong = await validate(dtoLong);
  assert.equal(errorsLong.some((e) => e.property === 'comment'), true);

  // Comment hợp lệ (100 ký tự)
  const dtoValid = plainToInstance(CreateReviewDto, {
    productId: 'prod-001',
    rating: 5,
    comment: 'Chất liệu vải rất êm và đường may tinh xảo, tôi rất hài lòng!',
  });
  const errorsValid = await validate(dtoValid);
  assert.equal(errorsValid.length, 0);
});

test('DTO 3. UpdateReviewDto validate độc lập rating và comment khi chỉnh sửa', async () => {
  // Sửa rating không hợp lệ
  const dtoBadRating = plainToInstance(UpdateReviewDto, {
    rating: 7,
  });
  const errorsBad = await validate(dtoBadRating);
  assert.equal(errorsBad.some((e) => e.property === 'rating'), true);

  // Sửa comment hợp lệ
  const dtoGoodComment = plainToInstance(UpdateReviewDto, {
    comment: 'Cập nhật lại nhận xét sau 1 tuần mặc',
  });
  const errorsGood = await validate(dtoGoodComment);
  assert.equal(errorsGood.length, 0);
});

test('DTO 4. QueryReviewDto validate tham số sortBy và rating', async () => {
  // Sort by không hợp lệ
  const dtoBadSort = plainToInstance(QueryReviewDto, {
    sortBy: 'invalid-sort',
  });
  const errorsSort = await validate(dtoBadSort);
  assert.equal(errorsSort.some((e) => e.property === 'sortBy'), true);

  // Sort by hợp lệ: newest, highest
  const dtoGoodSort = plainToInstance(QueryReviewDto, {
    sortBy: 'highest',
    rating: 5,
    page: 1,
    limit: 20,
  });
  const errorsGood = await validate(dtoGoodSort);
  assert.equal(errorsGood.length, 0);
});
