import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, shareReplay, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface AdministrativeUnit {
  code: number;
  name: string;
}

export interface ProvinceResponse {
  code: number;
  name: string;
  districts?: AdministrativeUnit[];
}

export interface DistrictResponse {
  code: number;
  name: string;
  wards?: AdministrativeUnit[];
}

// Danh sách dự phòng 63 Tỉnh/Thành phố chuẩn quốc gia nếu cả 2 API đều không phản hồi
const FALLBACK_PROVINCES: AdministrativeUnit[] = [
  { code: 1, name: 'Thành phố Hà Nội' },
  { code: 79, name: 'Thành phố Hồ Chí Minh' },
  { code: 48, name: 'Thành phố Đà Nẵng' },
  { code: 31, name: 'Thành phố Hải Phòng' },
  { code: 92, name: 'Thành phố Cần Thơ' },
  { code: 77, name: 'Tỉnh Bà Rịa - Vũng Tàu' },
  { code: 89, name: 'Tỉnh An Giang' },
  { code: 95, name: 'Tỉnh Bạc Liêu' },
  { code: 24, name: 'Tỉnh Bắc Giang' },
  { code: 6, name: 'Tỉnh Bắc Kạn' },
  { code: 27, name: 'Tỉnh Bắc Ninh' },
  { code: 83, name: 'Tỉnh Bến Tre' },
  { code: 52, name: 'Tỉnh Bình Định' },
  { code: 74, name: 'Tỉnh Bình Dương' },
  { code: 70, name: 'Tỉnh Bình Phước' },
  { code: 60, name: 'Tỉnh Bình Thuận' },
  { code: 96, name: 'Tỉnh Cà Mau' },
  { code: 4, name: 'Tỉnh Cao Bằng' },
  { code: 66, name: 'Tỉnh Đắk Lắk' },
  { code: 67, name: 'Tỉnh Đắk Nông' },
  { code: 11, name: 'Tỉnh Điện Biên' },
  { code: 75, name: 'Tỉnh Đồng Nai' },
  { code: 87, name: 'Tỉnh Đồng Tháp' },
  { code: 64, name: 'Tỉnh Gia Lai' },
  { code: 2, name: 'Tỉnh Hà Giang' },
  { code: 35, name: 'Tỉnh Hà Nam' },
  { code: 42, name: 'Tỉnh Hà Tĩnh' },
  { code: 30, name: 'Tỉnh Hải Dương' },
  { code: 93, name: 'Tỉnh Hậu Giang' },
  { code: 17, name: 'Tỉnh Hòa Bình' },
  { code: 33, name: 'Tỉnh Hưng Yên' },
  { code: 56, name: 'Tỉnh Khánh Hòa' },
  { code: 91, name: 'Tỉnh Kiên Giang' },
  { code: 62, name: 'Tỉnh Kon Tum' },
  { code: 12, name: 'Tỉnh Lai Châu' },
  { code: 68, name: 'Tỉnh Lâm Đồng' },
  { code: 20, name: 'Tỉnh Lạng Sơn' },
  { code: 10, name: 'Tỉnh Lào Cai' },
  { code: 80, name: 'Tỉnh Long An' },
  { code: 36, name: 'Tỉnh Nam Định' },
  { code: 40, name: 'Tỉnh Nghệ An' },
  { code: 37, name: 'Tỉnh Ninh Bình' },
  { code: 58, name: 'Tỉnh Ninh Thuận' },
  { code: 25, name: 'Tỉnh Phú Thọ' },
  { code: 54, name: 'Tỉnh Phú Yên' },
  { code: 44, name: 'Tỉnh Quảng Bình' },
  { code: 49, name: 'Tỉnh Quảng Nam' },
  { code: 51, name: 'Tỉnh Quảng Ngãi' },
  { code: 22, name: 'Tỉnh Quảng Ninh' },
  { code: 45, name: 'Tỉnh Quảng Trị' },
  { code: 94, name: 'Tỉnh Sóc Trăng' },
  { code: 14, name: 'Tỉnh Sơn La' },
  { code: 72, name: 'Tỉnh Tây Ninh' },
  { code: 34, name: 'Tỉnh Thái Bình' },
  { code: 19, name: 'Tỉnh Thái Nguyên' },
  { code: 38, name: 'Tỉnh Thanh Hóa' },
  { code: 46, name: 'Tỉnh Thừa Thiên Huế' },
  { code: 82, name: 'Tỉnh Tiền Giang' },
  { code: 84, name: 'Tỉnh Trà Vinh' },
  { code: 8, name: 'Tỉnh Tuyên Quang' },
  { code: 86, name: 'Tỉnh Vĩnh Long' },
  { code: 26, name: 'Tỉnh Vĩnh Phúc' },
  { code: 15, name: 'Tỉnh Yên Bái' },
];

@Injectable({
  providedIn: 'root'
})
export class VietnamAddressService {
  private readonly internalApiUrl = (environment.apiUrl || 'http://localhost:4000') + '/api/orders/address';
  private readonly publicApiV1Url = 'https://provinces.open-api.vn/api/v1';

  private provincesCache$?: Observable<AdministrativeUnit[]>;
  private districtsCache = new Map<string, Observable<AdministrativeUnit[]>>();
  private wardsCache = new Map<string, Observable<AdministrativeUnit[]>>();

  constructor(private http: HttpClient) {}

  /**
   * Lấy danh sách Tỉnh / Thành phố
   * Chiến lược 3 lớp:
   * 1. Backend Cheri proxy (/api/orders/address/provinces) -> Tránh hoàn toàn lỗi CORS
   * 2. Direct API v1 (https://provinces.open-api.vn/api/v1/p/)
   * 3. Fallback danh mục chuẩn 63 tỉnh/thành -> Luôn hiển thị được dữ liệu
   */
  getProvinces(): Observable<AdministrativeUnit[]> {
    if (!this.provincesCache$) {
      this.provincesCache$ = this.http.get<AdministrativeUnit[]>(`${this.internalApiUrl}/provinces`).pipe(
        map(res => (Array.isArray(res) && res.length > 0) ? res : FALLBACK_PROVINCES),
        catchError(() => {
          // Thử lớp 2: Direct public API v1
          return this.http.get<AdministrativeUnit[]>(`${this.publicApiV1Url}/p/`).pipe(
            map(res => (Array.isArray(res) && res.length > 0) ? res : FALLBACK_PROVINCES),
            catchError(() => of(FALLBACK_PROVINCES))
          );
        }),
        shareReplay(1)
      );
    }
    return this.provincesCache$;
  }

  /**
   * Lấy danh sách Quận / Huyện theo mã Tỉnh / Thành phố
   */
  getDistricts(provinceCode: number | string): Observable<AdministrativeUnit[]> {
    const key = String(provinceCode);
    if (!key) {
      return of([]);
    }

    if (!this.districtsCache.has(key)) {
      const request$ = this.http.get<any[]>(`${this.internalApiUrl}/districts/${key}`).pipe(
        map(res => (Array.isArray(res) && res.length > 0) ? res : null),
        catchError(() => of(null)),
        map(internalDistricts => {
          if (internalDistricts) {
            return internalDistricts;
          }
          throw new Error('Call public');
        }),
        catchError(() => {
          // Fallback sang Direct public API v1
          return this.http.get<ProvinceResponse>(`${this.publicApiV1Url}/p/${key}?depth=2`).pipe(
            map(res => (res && res.districts) ? res.districts : []),
            catchError(() => of([]))
          );
        }),
        shareReplay(1)
      );
      this.districtsCache.set(key, request$);
    }

    return this.districtsCache.get(key)!;
  }

  /**
   * Lấy danh sách Phường / Xã theo mã Quận / Huyện
   */
  getWards(districtCode: number | string): Observable<AdministrativeUnit[]> {
    const key = String(districtCode);
    if (!key) {
      return of([]);
    }

    if (!this.wardsCache.has(key)) {
      const request$ = this.http.get<any[]>(`${this.internalApiUrl}/wards/${key}`).pipe(
        map(res => (Array.isArray(res) && res.length > 0) ? res : null),
        catchError(() => of(null)),
        map(internalWards => {
          if (internalWards) {
            return internalWards;
          }
          throw new Error('Call public');
        }),
        catchError(() => {
          // Fallback sang Direct public API v1
          return this.http.get<DistrictResponse>(`${this.publicApiV1Url}/d/${key}?depth=2`).pipe(
            map(res => (res && res.wards) ? res.wards : []),
            catchError(() => of([]))
          );
        }),
        shareReplay(1)
      );
      this.wardsCache.set(key, request$);
    }

    return this.wardsCache.get(key)!;
  }
}
