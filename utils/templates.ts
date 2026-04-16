
export const PYTHON_SCRIPT_TEMPLATE = `import requests
import pandas as pd
import json
import time
from datetime import datetime, timedelta
import numpy as np
import os

# ================= Configuration Area =================
API_TOKEN = 'YOUR_USER_TOKEN_HERE' 
BASE_URL = 'https://automate.adjust.com/reports-service/report'

def fetch_data():
    headers = {'Authorization': f'Bearer {API_TOKEN}', 'Accept': 'application/json'}
    params = {
        'date_period': 'last_7_days', 
        'dimensions': 'date,app,network,country',
        'metrics': 'cost,installs,all_revenue,ad_revenue',
        'ad_spend_mode': 'network',
    }
    response = requests.get(BASE_URL, headers=headers, params=params)
    return response.json().get('rows', []) if response.status_code == 200 else []

def main():
    rows = fetch_data()
    df = pd.DataFrame(rows)
    df.to_csv("adjust_report.csv", index=False)
    print("Saved to adjust_report.csv")

if __name__ == "__main__":
    main()
`;

export const FEISHU_SYNC_SCRIPT_TEMPLATE = `import requests
import pandas as pd
import json
import os
from datetime import datetime

# ================= 配置区 (也可通过环境变量读取) =================
ADJUST_TOKEN = os.getenv('ADJUST_TOKEN', 'YOUR_ADJUST_TOKEN')
FEISHU_APP_ID = os.getenv('FEISHU_APP_ID', 'YOUR_APP_ID')
FEISHU_APP_SECRET = os.getenv('FEISHU_APP_SECRET', 'YOUR_APP_SECRET')
# 飞书表格的 Token (URL中 spreadsheet/ 后面那一串)
SPREADSHEET_TOKEN = os.getenv('SPREADSHEET_TOKEN', 'YOUR_SPREADSHEET_TOKEN')
# 工作表的 ID (通常是 "Sheet1" 或通过接口获取)
SHEET_ID = os.getenv('SHEET_ID', '0b67ef') 

def get_tenant_access_token():
    url = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal"
    payload = {"app_id": FEISHU_APP_ID, "app_secret": FEISHU_APP_SECRET}
    r = requests.post(url, json=payload)
    return r.json().get("tenant_access_token")

def fetch_adjust_data():
    print("📡 正在从 Adjust 抓取数据...")
    url = 'https://automate.adjust.com/reports-service/report'
    headers = {'Authorization': f'Bearer {ADJUST_TOKEN}', 'Accept': 'application/json'}
    params = {
        'date_period': 'yesterday', # 每天自动同步昨天的数据
        'dimensions': 'date,app,network,country,store_type',
        'metrics': 'cost,installs,all_revenue,ad_revenue,revenue',
        'ad_spend_mode': 'network'
    }
    res = requests.get(url, headers=headers, params=params)
    return res.json().get('rows', [])

def sync_to_feishu(rows):
    if not rows:
        print("⚠️ 没有抓取到数据，跳过同步。")
        return
        
    token = get_tenant_access_token()
    # 将数据转换为飞书 API 要求的矩阵格式 [ [v1, v2], [v3, v4] ]
    # 包含表头
    header = ["日期", "应用", "渠道", "国家", "商店", "消耗", "安装", "总收入", "广告收入", "内购收入"]
    values = [header]
    
    for r in rows:
        values.append([
            r.get('date', ''), r.get('app', ''), r.get('network', ''), 
            r.get('country', ''), r.get('store_type', ''),
            float(r.get('cost', 0)), int(r.get('installs', 0)),
            float(r.get('all_revenue', 0)), float(r.get('ad_revenue', 0)), float(r.get('revenue', 0))
        ])

    # 写入飞书表格 (覆盖模式写入 A1 范围)
    url = f"https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/{SPREADSHEET_TOKEN}/values_batch_update"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    payload = {
        "valueRanges": [
            {
                "range": f"{SHEET_ID}!A1:J{len(values)}",
                "values": values
            }
        ]
    }
    
    response = requests.post(url, json=payload, headers=headers)
    if response.status_code == 200:
        print(f"✅ 成功同步 {len(rows)} 行数据到飞书表格！")
    else:
        print(f"❌ 飞书同步失败: {response.text}")

if __name__ == "__main__":
    data = fetch_adjust_data()
    sync_to_feishu(data)
`;

export const GITHUB_FEISHU_WORKFLOW_YML = `name: Feishu Auto Sync

on:
  schedule:
    # 每天北京时间下午 2:00 运行 (UTC 6:00)
    - cron: '0 6 * * *'
  workflow_dispatch:

concurrency:
  group: feishu-auto-sync
  cancel-in-progress: false

jobs:
  sync:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    permissions:
      contents: read
    env:
      TZ: Asia/Shanghai
      ADJUST_TOKEN: \${{ secrets.ADJUST_TOKEN }}
      FEISHU_APP_ID: \${{ secrets.FEISHU_APP_ID }}
      FEISHU_APP_SECRET: \${{ secrets.FEISHU_APP_SECRET }}
      P04_SPREADSHEET_TOKEN: \${{ vars.P04_SPREADSHEET_TOKEN }}
      P02_SPREADSHEET_TOKEN: \${{ vars.P02_SPREADSHEET_TOKEN }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Validate workflow configuration
        run: |
          test -n "$ADJUST_TOKEN" || { echo "Missing secret: ADJUST_TOKEN"; exit 1; }
          test -n "$FEISHU_APP_ID" || { echo "Missing secret: FEISHU_APP_ID"; exit 1; }
          test -n "$FEISHU_APP_SECRET" || { echo "Missing secret: FEISHU_APP_SECRET"; exit 1; }
          test -n "$P04_SPREADSHEET_TOKEN" || { echo "Missing repo variable: P04_SPREADSHEET_TOKEN"; exit 1; }
          test -n "$P02_SPREADSHEET_TOKEN" || { echo "Missing repo variable: P02_SPREADSHEET_TOKEN"; exit 1; }

      - name: Sync P04 Witch
        run: |
          python3 -u manual_feishu_sync.py \\
            --spreadsheet "$P04_SPREADSHEET_TOKEN" \\
            --app-token "f1s2nylfod1c" \\
            --app-name "P04 Witch" \\
            --start-date "2025-12-01"

      - name: Sync P02 Mermaid
        run: |
          python3 -u manual_feishu_sync.py \\
            --spreadsheet "$P02_SPREADSHEET_TOKEN" \\
            --app-token "24xyuoynpe74" \\
            --app-name "P02 Mermaid" \\
            --start-date "2025-12-01"
`;

export const BUSINESS_INTELLIGENCE_SCRIPT_TEMPLATE = `... (保持不变)`;
export const REQUIREMENTS_TXT = `requests\npandas\nopenpyxl`;
export const GITHUB_WORKFLOW_YML = ``;
