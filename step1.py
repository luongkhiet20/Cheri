# Step 1: Update backend dashboard.controller.ts
ctrl_path = r'c:\Users\ACER\Downloads\Cheri\server\src\orders\dashboard.controller.ts'
with open(ctrl_path, 'r', encoding='utf-8') as f:
    content = f.read()

old = "  async getStats(@Query('timeRange') timeRange?: string) {\n    const period = timeRange === '30d' || timeRange === 'month' ? 'month' : 'week';\n    const stats = await this.ordersService.getDashboardDetailedStats(period);"
new = "  async getStats(@Query('timeRange') timeRange?: string) {\n    const period: '7d' | '30d' | 'this_month' | 'last_month' =\n      timeRange === '30d' ? '30d' :\n      timeRange === 'this_month' ? 'this_month' :\n      timeRange === 'last_month' ? 'last_month' : '7d';\n    const stats = await this.ordersService.getDashboardDetailedStats(period);"

if old in content:
    content = content.replace(old, new)
    with open(ctrl_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('OK: dashboard.controller.ts updated')
else:
    print('WARN: pattern not found in dashboard.controller.ts, content snippet:')
    idx = content.find('async getStats')
    print(repr(content[idx:idx+300]))
