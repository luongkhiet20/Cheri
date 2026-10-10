# Step 2: Update orders.service.ts - getDashboardDetailedStats method
import re

svc_path = r'c:\Users\ACER\Downloads\Cheri\server\src\orders\orders.service.ts'
with open(svc_path, 'r', encoding='utf-8') as f:
    content = f.read()

OLD_SIG = "  async getDashboardDetailedStats(period: 'week' | 'month' = 'week'): Promise<any> {"

NEW_SIG = "  async getDashboardDetailedStats(period: '7d' | '30d' | 'this_month' | 'last_month' = '7d'): Promise<any> {"

# New period calculation block replacing old calculation
OLD_PERIOD_BLOCK = """    const now = new Date();
    const days = period === 'week' ? 7 : 30;

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);"""

NEW_PERIOD_BLOCK = """    const now = new Date();

    // ── Compute period boundaries ─────────────────────────────────────────
    let periodStart: Date;
    let periodEnd: Date;
    let prevStart: Date;
    let prevEnd: Date;
    let days: number;

    if (period === 'this_month') {
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      const elapsed = now.getDate(); // days elapsed this month (1-based)
      prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      prevEnd = new Date(now.getFullYear(), now.getMonth() - 1, elapsed, 23, 59, 59, 999);
      days = periodEnd.getDate();
    } else if (period === 'last_month') {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      periodStart = new Date(lm.getFullYear(), lm.getMonth(), 1, 0, 0, 0, 0);
      periodEnd = new Date(lm.getFullYear(), lm.getMonth() + 1, 0, 23, 59, 59, 999);
      const prevMonth = new Date(lm.getFullYear(), lm.getMonth() - 1, 1);
      prevStart = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1, 0, 0, 0, 0);
      prevEnd = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0, 23, 59, 59, 999);
      days = periodEnd.getDate();
    } else if (period === '30d') {
      days = 30;
      periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      periodStart = new Date(periodEnd.getTime() - (days - 1) * 86400000);
      periodStart.setHours(0, 0, 0, 0);
      prevEnd = new Date(periodStart.getTime() - 1);
      prevStart = new Date(prevEnd.getTime() - (days - 1) * 86400000);
      prevStart.setHours(0, 0, 0, 0);
    } else {
      // '7d' default
      days = 7;
      periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      periodStart = new Date(periodEnd.getTime() - (days - 1) * 86400000);
      periodStart.setHours(0, 0, 0, 0);
      prevEnd = new Date(periodStart.getTime() - 1);
      prevStart = new Date(prevEnd.getTime() - (days - 1) * 86400000);
      prevStart.setHours(0, 0, 0, 0);
    }

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);"""

# Replace ordersByStatus to filter by period
OLD_STATUS = """    // 5. Đơn hàng theo trạng thái
    const ordersByStatus = {
      pending: allOrders.filter(o => o.status === OrderStatus.PENDING || (o as any).status === 'NEW').length,
      confirmed: allOrders.filter(o => o.status === OrderStatus.CONFIRMED).length,
      processing: allOrders.filter(o => o.status === OrderStatus.PROCESSING).length,
      shipping: allOrders.filter(o => o.status === OrderStatus.SHIPPING).length,
      delivered: allOrders.filter(o => o.status === OrderStatus.DELIVERED || (o as any).status === 'COMPLETED').length,
      cancelled: allOrders.filter(o => o.status === OrderStatus.CANCELLED || (o as any).status === 'CANCELED').length,
      returned: allOrders.filter(o => o.status === OrderStatus.RETURNED || (o as any).type === 'RETURN').length,
    };"""

NEW_STATUS = """    // 5. Đơn hàng trong kỳ (periodOrders) + theo trạng thái
    const pStart = periodStart.getTime();
    const pEnd = periodEnd.getTime();
    const periodOrders = allOrders.filter(o => {
      const t = getOrderTime(o);
      return t >= pStart && t <= pEnd;
    });

    const prevPeriodOrders = allOrders.filter(o => {
      const t = getOrderTime(o);
      return t >= prevStart.getTime() && t <= prevEnd.getTime();
    });

    const periodRevenue = periodOrders
      .filter(isPaid)
      .reduce((sum, o) => sum + (o.totalAmount || (o as any).amount || 0), 0);

    const prevPeriodRevenue = prevPeriodOrders
      .filter(isPaid)
      .reduce((sum, o) => sum + (o.totalAmount || (o as any).amount || 0), 0);

    const periodOrdersCount = periodOrders.length;
    const prevPeriodOrdersCount = prevPeriodOrders.length;

    const filterByStatus = (orders: any[], ...statuses: string[]) =>
      orders.filter(o => statuses.includes(o.status) || statuses.includes((o as any).type)).length;

    const ordersByStatus = {
      pending:    filterByStatus(periodOrders, OrderStatus.PENDING, 'NEW'),
      confirmed:  filterByStatus(periodOrders, OrderStatus.CONFIRMED),
      processing: filterByStatus(periodOrders, OrderStatus.PROCESSING),
      shipping:   filterByStatus(periodOrders, OrderStatus.SHIPPING),
      delivered:  filterByStatus(periodOrders, OrderStatus.DELIVERED, 'COMPLETED'),
      cancelled:  filterByStatus(periodOrders, OrderStatus.CANCELLED, 'CANCELED'),
      returned:   filterByStatus(periodOrders, OrderStatus.RETURNED, 'RETURN'),
    };"""

# Replace return object to include new fields
OLD_RETURN_TOTAL = "      totalRevenue,"
NEW_RETURN_TOTAL = "      totalRevenue: periodRevenue,\n      prevPeriodRevenue,\n      periodOrdersCount,\n      prevPeriodOrdersCount,"

OLD_RETURN_ORDERSCOUNT = "      ordersCount,"
NEW_RETURN_ORDERSCOUNT = "      ordersCount: periodOrdersCount,"

# Now apply all replacements
found = True
for old, new in [
    (OLD_SIG, NEW_SIG),
    (OLD_PERIOD_BLOCK, NEW_PERIOD_BLOCK),
    (OLD_STATUS, NEW_STATUS),
    (OLD_RETURN_TOTAL, NEW_RETURN_TOTAL),
    (OLD_RETURN_ORDERSCOUNT, NEW_RETURN_ORDERSCOUNT),
]:
    if old in content:
        content = content.replace(old, new, 1)
        print(f'  replaced: {old[:60].strip()!r}')
    else:
        print(f'  WARN NOT FOUND: {old[:60].strip()!r}')
        found = False

if found:
    with open(svc_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('OK: orders.service.ts updated')
else:
    print('PARTIAL UPDATE - check warnings above')
    with open(svc_path, 'w', encoding='utf-8') as f:
        f.write(content)
