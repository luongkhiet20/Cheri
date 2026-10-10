import sys, os
sys.stdout.reconfigure(encoding="utf-8")

svc_path = r'c:\Users\ACER\Downloads\Cheri\server\src\orders\orders.service.ts'
with open(svc_path, 'r', encoding='utf-8') as f:
    content = f.read()

OLD_SIG = "  async getDashboardDetailedStats(period: '7d' | '30d' | 'this_month' | 'last_month' = '7d'): Promise<any> {"
if OLD_SIG in content:
    print("sig already updated OK")
else:
    print("sig NOT found, applying...")

OLD_STATUS_CHECK = "    const ordersByStatus = {"
idx = content.find("// 5.")
print("status section at:", idx, content[idx:idx+80] if idx >= 0 else "NOT FOUND")
