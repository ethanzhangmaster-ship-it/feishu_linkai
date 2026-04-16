#!/usr/bin/env python3
import argparse
import json
import math
import os
import re
import time
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path
from urllib.error import HTTPError, URLError
from zoneinfo import ZoneInfo

CONFIG_PATH = Path(__file__).with_name("app-config.json")
BLACKLISTED_APPS = {
    "Mergeland - Merge Dragons and Build dragon home",
    "Merge Legend",
    "Merge Legend Amazon",
    "Test App",
    "Placeholder",
}
CURRENT_BLOCKS = {
    "block_roi_all_80": {"sheet": "ROI-发行-市场部门", "store": None, "network": None, "kind": "roi"},
    "block_roi_ios_fb_80": {"sheet": "ROI-IOS-FB", "store": "ios", "network": "Facebook", "kind": "roi"},
    "block_roi_gp_fb_80": {"sheet": "ROI-GP-FB", "store": "android", "network": "Facebook", "kind": "roi"},
    "block_basic_all_80": {"sheet": "基础数据-发行-市场部门", "store": None, "network": None, "kind": "basic"},
    "block_basic_gp_fb_80": {"sheet": "基础数据-GP-FB", "store": "android", "network": "Facebook", "kind": "basic"},
    "block_basic_ios_fb_80": {"sheet": "基础数据-IOS-FB", "store": "ios", "network": "Facebook", "kind": "basic"},
}
ROI_DAYS = [0, 1, 2, 3, 4, 5, 6, 7, 13, 14, 20, 21, 29, 30, 39, 49, 59, 69, 79, 89, 99]
ROI_FIELD_MAPPINGS = [
    ("d0Revenue", "roiD0"),
    ("d1Revenue", "roiD1"),
    ("d2Revenue", "roiD2"),
    ("d3Revenue", "roiD3"),
    ("d4Revenue", "roiD4"),
    ("d5Revenue", "roiD5"),
    ("d6Revenue", "roiD6"),
    ("d13Revenue", "roiD13"),
    ("d20Revenue", "roiD20"),
    ("d29Revenue", "roiD29"),
    ("d39Revenue", "roiD39"),
    ("d49Revenue", "roiD49"),
    ("d59Revenue", "roiD59"),
    ("d69Revenue", "roiD69"),
    ("d79Revenue", "roiD79"),
    ("d89Revenue", "roiD89"),
    ("d99Revenue", "roiD99"),
]
WEEKDAY_LABELS = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"]
MONTHLY_ROI_HEADERS = [
    "日期", "消耗($)", "7日回收金额", "14回收金额", "21日回收金额", "首日ROI", "2日ROI", "3日ROI", "4日ROI",
    "5日ROI", "6日ROI", "7日ROI", "14日ROI", "21日ROI", "30日ROI", "40日ROI", "50日ROI", "60日ROI", "70日ROI",
    "80日ROI", "90日ROI", "100日ROI", "", "2日倍率", "3日倍率\n（2？）", "4日倍率", "5日倍率", "6日倍率",
    "7日倍率\n（6？）", "14日倍率\n（10？）", "21日倍率", "30日倍率\n（15？）", "3/2", "7/2", "14/7\n（1.8-2）",
    "14/21", "7/30", "14/30", "21/30",
]
MONTHLY_BASIC_HEADERS = [
    "日期", "消耗($)", "新增用户", "CPI", "DAU", "首日ROI", "新增 arpu", "新增首日用户付费数", "新增首日付费用户成本",
    "新增付费率", "新增付费arppu", "新增首日付费金额", "新增广告收入", "新增首日收入", "总收入", "1日留存",
    "活跃回收", "0月回收", "1月回收", "2月回收", "3月回收", "4月回收", "5月回收",
]


def safe_float(value):
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).replace(",", "").strip()
    if not text:
        return 0.0
    if text.endswith("%"):
        try:
            return float(text[:-1]) / 100.0
        except ValueError:
            return 0.0
    try:
        return float(text)
    except ValueError:
        return 0.0


def js_round(value):
    numeric = float(value)
    return int(math.floor(numeric + 0.5)) if numeric >= 0 else int(math.ceil(numeric - 0.5))


def format_currency(value):
    numeric = safe_float(value)
    text = f"{numeric:,.2f}".rstrip("0").rstrip(".")
    return f"${text}"


def format_percent(value):
    return f"{safe_float(value) * 100:.2f}%"


def calc_ratio(num, den):
    denominator = safe_float(den)
    if denominator == 0:
        return ""
    return f"{safe_float(num) / denominator:.2f}"


def get_col_str(index):
    result = ""
    index += 1
    while index:
        index, remainder = divmod(index - 1, 26)
        result = chr(65 + remainder) + result
    return result


def normalize_store_name(raw_store):
    if not raw_store:
        return "unknown"
    text = str(raw_store).lower()
    if "app_store" in text:
        return "ios"
    if "play_store" in text:
        return "android"
    if "itunes" in text or "ios" in text or "apple" in text:
        return "ios"
    if "google" in text or "android" in text:
        return "android"
    return text


def normalize_network_name(raw_name):
    if not raw_name:
        return "Organic"
    text = str(raw_name).lower().strip()
    if text == "organic":
        return "Organic"
    if "google" in text:
        return "Google Ads"
    if "facebook" in text or "meta" in text or "instagram" in text or "messenger" in text:
        return "Facebook"
    if "apple" in text or "search ads" in text:
        return "Apple"
    if "applovin" in text:
        return "Applovin"
    if "unity" in text:
        return "Unity Ads"
    return str(raw_name)


def format_date_with_weekday(date_str):
    parsed = datetime.strptime(str(date_str)[:10], "%Y-%m-%d").date()
    return f"{parsed:%Y-%m-%d}({WEEKDAY_LABELS[parsed.weekday()]})"


def extract_month_key(date_str):
    if not date_str:
        return ""
    match = re.match(r"^(\d{4})-(\d{2})", str(date_str))
    if match:
        return f"{match.group(1)}-{match.group(2)}"
    match = re.match(r"^(\d{4})/(\d{1,2})", str(date_str))
    if match:
        return f"{match.group(1)}-{match.group(2).zfill(2)}"
    return ""


def extract_day_key(date_str):
    if not date_str:
        return ""
    match = re.match(r"^(\d{4})-(\d{2})-(\d{2})", str(date_str))
    if match:
        return f"{match.group(1)}-{match.group(2)}-{match.group(3)}"
    match = re.match(r"^(\d{4})/(\d{1,2})/(\d{1,2})", str(date_str))
    if match:
        return f"{match.group(1)}-{match.group(2).zfill(2)}-{match.group(3).zfill(2)}"
    return ""


def format_month_summary_label(month_key):
    match = re.match(r"^(\d{4})-(\d{2})$", month_key)
    if not match:
        return f"{month_key}汇总"
    return f"{match.group(1)}年{int(match.group(2))}月汇总"


def parse_summary_month_key(label):
    if not isinstance(label, str):
        return ""
    match = re.match(r"^(\d{4})年(\d{1,2})月汇总$", label.strip())
    if not match:
        return ""
    return f"{match.group(1)}-{match.group(2).zfill(2)}"


def format_day_label(date_str):
    day_key = extract_day_key(date_str)
    if not day_key:
        return date_str
    parsed = datetime.strptime(day_key, "%Y-%m-%d").date()
    return f"{parsed.year}/{parsed.month}/{parsed.day} {WEEKDAY_LABELS[parsed.weekday()]}"


def daterange_chunks(start_date_str, end_date_str, chunk_days=5):
    current = datetime.strptime(start_date_str, "%Y-%m-%d").date()
    end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
    while current <= end_date:
        current_end = min(current + timedelta(days=chunk_days - 1), end_date)
        yield current.isoformat(), current_end.isoformat()
        current = current_end + timedelta(days=1)


class ManualFeishuSync:
    def __init__(self, spreadsheet_token, app_token, app_name=None, start_date="2025-12-01", end_date=None):
        config = {}
        if CONFIG_PATH.exists():
            config = json.loads(CONFIG_PATH.read_text())

        adjust_api = config.get("adjust_api", {})
        feishu_config = config.get("feishu_config", {})

        self.adjust_token = os.getenv("ADJUST_TOKEN") or adjust_api.get("user_token")
        self.app_id = os.getenv("FEISHU_APP_ID") or feishu_config.get("app_id")
        self.app_secret = os.getenv("FEISHU_APP_SECRET") or feishu_config.get("app_secret")

        if not self.adjust_token:
            raise ValueError("Missing Adjust token. Set ADJUST_TOKEN or keep it in app-config.json.")
        if not self.app_id or not self.app_secret:
            raise ValueError("Missing Feishu app credentials. Set FEISHU_APP_ID/FEISHU_APP_SECRET or keep them in app-config.json.")

        self.spreadsheet_token = spreadsheet_token
        self.target_app_token = app_token
        self.target_app_name = app_name
        self.start_date = start_date
        self.end_date = end_date or (datetime.now(ZoneInfo("Asia/Shanghai")).date() - timedelta(days=1)).isoformat()
        self.tenant_token = None

    def open_json(self, request, timeout=180):
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.load(response)

    def adjust_request(self, url):
        request = urllib.request.Request(
            url,
            headers={"Authorization": f"Bearer {self.adjust_token}", "Accept": "application/json"},
        )
        for attempt in range(3):
            try:
                return self.open_json(request)
            except HTTPError as error:
                body = error.read().decode("utf-8", "ignore")
                if error.code == 429 and attempt < 2:
                    wait_seconds = attempt + 1
                    print(f"Adjust rate limited, retrying in {wait_seconds}s", flush=True)
                    time.sleep(wait_seconds)
                    continue
                raise RuntimeError(f"Adjust API failed: {error.code} {body}") from error
            except URLError as error:
                if attempt < 2:
                    wait_seconds = attempt + 1
                    print(f"Adjust network error {error}, retrying in {wait_seconds}s", flush=True)
                    time.sleep(wait_seconds)
                    continue
                raise

    def feishu_request(self, method, path, data=None):
        headers = {"Authorization": f"Bearer {self.tenant_token}"}
        payload = None
        if data is not None:
            payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
            headers["Content-Type"] = "application/json"
        request = urllib.request.Request(
            "https://open.feishu.cn" + path,
            data=payload,
            headers=headers,
            method=method,
        )
        for attempt in range(3):
            try:
                response = self.open_json(request)
                if response.get("code") == 0:
                    return response
                message = response.get("msg", "unknown error")
                if "too many request" in message.lower() and attempt < 2:
                    wait_seconds = attempt + 1
                    print(f"Feishu rate limited, retrying in {wait_seconds}s", flush=True)
                    time.sleep(wait_seconds)
                    continue
                raise RuntimeError(f"Feishu API failed: {response}")
            except HTTPError as error:
                body = error.read().decode("utf-8", "ignore")
                if error.code == 429 and attempt < 2:
                    wait_seconds = attempt + 1
                    print(f"Feishu HTTP 429, retrying in {wait_seconds}s", flush=True)
                    time.sleep(wait_seconds)
                    continue
                raise RuntimeError(f"Feishu HTTP failed: {error.code} {body}") from error

    def get_tenant_token(self):
        request = urllib.request.Request(
            "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
            data=json.dumps({"app_id": self.app_id, "app_secret": self.app_secret}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        response = self.open_json(request)
        if response.get("code") != 0:
            raise RuntimeError(f"Failed to get tenant token: {response}")
        self.tenant_token = response["tenant_access_token"]

    def fetch_adjust_rows(self, metrics, label):
        all_rows = []
        dimensions = "app,app_token,store_type,day,network"
        chunks = list(daterange_chunks(self.start_date, self.end_date, 5))
        print(f"Fetching {label}: {len(chunks)} chunks", flush=True)
        for index, (start, end) in enumerate(chunks, start=1):
            params = urllib.parse.urlencode(
                {
                    "date_period": f"{start}:{end}",
                    "dimensions": dimensions,
                    "metrics": metrics,
                    "ad_spend_mode": "network",
                }
            )
            data = self.adjust_request(f"https://automate.adjust.com/reports-service/report?{params}")
            chunk_rows = data.get("rows", [])
            all_rows.extend(chunk_rows)
            print(f"  {label} {index}/{len(chunks)} {start}..{end}: {len(chunk_rows)} rows", flush=True)
        return all_rows

    def is_target_app(self, row):
        app_name = row.get("app")
        app_token = row.get("app_token")
        if app_name in BLACKLISTED_APPS:
            return False
        if app_token == self.target_app_token:
            return True
        return bool(self.target_app_name and app_name == self.target_app_name)

    def create_agg(self, app_name, app_token, day, network):
        aggregate = {
            "app": app_name,
            "appToken": app_token,
            "day": day,
            "network": network,
            "adgroup": "-",
            "campaign": "Unknown",
            "store_type": "all",
            "country": "Global",
            "installs": 0.0,
            "cost": 0.0,
            "ad_revenue": 0.0,
            "revenue": 0.0,
            "all_revenue": 0.0,
            "all_revenue_total_d0": 0.0,
            "ad_revenue_total_d0": 0.0,
            "first_paying_users_d0": 0.0,
            "daus": 0.0,
            "sessions": 0.0,
            "iap_revenue_total_d0": 0.0,
            "all_revenue_total_m0": 0.0,
            "all_revenue_total_m1": 0.0,
            "all_revenue_total_m2": 0.0,
            "all_revenue_total_m3": 0.0,
            "all_revenue_total_m4": 0.0,
            "all_revenue_total_m5": 0.0,
            "all_revenue_total_m6": 0.0,
        }
        for day_number in ROI_DAYS:
            aggregate[f"rev_d{day_number}"] = 0.0
        for day_number in [1, 2, 3, 4, 5, 6, 7, 14, 20]:
            aggregate[f"ret_d{day_number}"] = 0.0
        return aggregate

    def aggregate_rows(self, raw_rows, block_id, store_filter=None, network_filter=None):
        aggregated = {}
        for row in raw_rows:
            if not self.is_target_app(row):
                continue
            normalized_store = normalize_store_name(row.get("store_type"))
            normalized_network = normalize_network_name(row.get("network"))
            if store_filter and normalized_store != store_filter.lower():
                continue
            if network_filter and normalized_network.lower() != network_filter.lower():
                continue
            app_name = row.get("app") or "Unknown"
            day = row.get("day") or row.get("date") or ""
            key = f"{app_name}|{day}"
            if key not in aggregated:
                aggregated[key] = self.create_agg(app_name, row.get("app_token") or "Unknown", day, normalized_network)
            agg = aggregated[key]
            cost = safe_float(row.get("cost"))
            installs = safe_float(row.get("installs"))
            agg["installs"] += installs
            agg["cost"] += cost
            agg["ad_revenue"] += safe_float(row.get("ad_revenue"))
            agg["revenue"] += safe_float(row.get("revenue")) * 0.8
            agg["first_paying_users_d0"] += safe_float(row.get("first_paying_users_d0"))
            agg["daus"] += safe_float(row.get("daus"))
            agg["sessions"] += safe_float(row.get("sessions"))
            for month in range(7):
                agg[f"all_revenue_total_m{month}"] += safe_float(row.get(f"all_revenue_total_m{month}")) * 0.8

            def calc_total_rev(day_number):
                iap_revenue = safe_float(row.get(f"revenue_total_d{day_number}"))
                if not iap_revenue:
                    iap_revenue = safe_float(row.get(f"roas_d{day_number}")) * cost
                adjusted_iap = iap_revenue * 0.8
                ad_revenue = safe_float(row.get(f"ad_revenue_total_d{day_number}"))
                return adjusted_iap + ad_revenue, adjusted_iap, ad_revenue

            for day_number in ROI_DAYS:
                total_revenue, adjusted_iap, ad_revenue = calc_total_rev(day_number)
                agg[f"rev_d{day_number}"] += total_revenue
                if day_number == 0:
                    agg["all_revenue_total_d0"] += total_revenue
                    agg["iap_revenue_total_d0"] += adjusted_iap
                    agg["ad_revenue_total_d0"] += ad_revenue
            for day_number in [1, 2, 3, 4, 5, 6, 7, 14, 20]:
                agg[f"ret_d{day_number}"] += safe_float(row.get(f"retention_rate_d{day_number}")) * installs

        final_rows = []
        for index, agg in enumerate(aggregated.values()):
            installs = agg["installs"]
            cost = agg["cost"]
            ad_revenue = agg["ad_revenue"]
            iap_revenue = agg["revenue"]
            total_revenue = agg["all_revenue"] or (ad_revenue + iap_revenue)
            result = {
                "id": f"{block_id}-{index}",
                "appName": agg["app"],
                "appToken": agg["appToken"],
                "storeType": agg["store_type"],
                "network": agg["network"],
                "country": agg["country"],
                "version": "All",
                "dateStr": format_date_with_weekday(agg["day"]),
                "cost": round(cost, 2),
                "totalRevenue": round(total_revenue, 2),
                "adRevenue": round(ad_revenue, 2),
                "iapRevenue": round(iap_revenue, 2),
                "installs": math.floor(installs),
                "cpa": round(cost / installs, 2) if installs > 0 else 0,
                "roi": total_revenue / cost if cost > 0 else 0,
                "arpu": round(agg["all_revenue_total_d0"] / installs, 2) if installs > 0 else 0,
                "userPayCost": round(cost / agg["first_paying_users_d0"], 2) if agg["first_paying_users_d0"] > 0 else 0,
                "paidInstalls": math.floor(agg["first_paying_users_d0"]),
                "paidArppu": round(agg["iap_revenue_total_d0"] / agg["first_paying_users_d0"], 2) if agg["first_paying_users_d0"] > 0 else 0,
                "payRate": agg["first_paying_users_d0"] / installs if installs > 0 else 0,
                "retention1": agg["ret_d1"] / installs if installs > 0 else 0,
                "daus": math.floor(agg["daus"]),
                "revD0": agg["all_revenue_total_d0"],
                "revD6": agg["rev_d6"],
                "revD13": agg["rev_d13"],
                "revD20": agg["rev_d20"],
                "revM0": agg["all_revenue_total_m0"],
                "revM1": agg["all_revenue_total_m1"],
                "revM2": agg["all_revenue_total_m2"],
                "revM3": agg["all_revenue_total_m3"],
                "revM4": agg["all_revenue_total_m4"],
                "revM5": agg["all_revenue_total_m5"],
                "iapRevD0": agg["iap_revenue_total_d0"],
                "adRevD0": agg["ad_revenue_total_d0"],
                "blockId": block_id,
                "roasM0": agg["all_revenue_total_m0"] / cost if cost > 0 else 0,
                "roasM1": agg["all_revenue_total_m1"] / cost if cost > 0 else 0,
                "roasM2": agg["all_revenue_total_m2"] / cost if cost > 0 else 0,
                "roasM3": agg["all_revenue_total_m3"] / cost if cost > 0 else 0,
                "roasM4": agg["all_revenue_total_m4"] / cost if cost > 0 else 0,
                "roasM5": agg["all_revenue_total_m5"] / cost if cost > 0 else 0,
            }
            for day_number in ROI_DAYS:
                result[f"roiD{day_number}"] = agg[f"rev_d{day_number}"] / cost if cost > 0 else 0
            final_rows.append(result)

        final_rows.sort(key=lambda row: row["dateStr"], reverse=True)
        return final_rows

    def create_monthly_bucket(self, month_key):
        bucket = {
            "monthKey": month_key,
            "cost": 0.0,
            "installs": 0.0,
            "dausTotal": 0.0,
            "uniqueDays": set(),
            "paidInstalls": 0.0,
            "iapRevD0": 0.0,
            "adRevD0": 0.0,
            "revD0": 0.0,
            "revD6": 0.0,
            "revD13": 0.0,
            "revD20": 0.0,
            "totalRevenue": 0.0,
            "retention1Weighted": 0.0,
            "revM0": 0.0,
            "revM1": 0.0,
            "revM2": 0.0,
            "revM3": 0.0,
            "revM4": 0.0,
            "revM5": 0.0,
        }
        for bucket_key, _ in ROI_FIELD_MAPPINGS:
            bucket[bucket_key] = 0.0
        return bucket

    def aggregate_monthly_data(self, rows):
        monthly = {}
        for row in rows:
            month_key = extract_month_key(row["dateStr"])
            if not month_key:
                continue
            bucket = monthly.setdefault(month_key, self.create_monthly_bucket(month_key))
            cost = safe_float(row["cost"])
            installs = safe_float(row["installs"])
            bucket["cost"] += cost
            bucket["installs"] += installs
            bucket["dausTotal"] += safe_float(row["daus"])
            bucket["paidInstalls"] += safe_float(row["paidInstalls"])
            bucket["iapRevD0"] += safe_float(row["iapRevD0"])
            bucket["adRevD0"] += safe_float(row["adRevD0"])
            bucket["revD0"] += safe_float(row["revD0"])
            bucket["revD6"] += safe_float(row["revD6"])
            bucket["revD13"] += safe_float(row["revD13"])
            bucket["revD20"] += safe_float(row["revD20"])
            bucket["totalRevenue"] += safe_float(row["totalRevenue"])
            bucket["retention1Weighted"] += safe_float(row["retention1"]) * installs
            bucket["revM0"] += safe_float(row["revM0"])
            bucket["revM1"] += safe_float(row["revM1"])
            bucket["revM2"] += safe_float(row["revM2"])
            bucket["revM3"] += safe_float(row["revM3"])
            bucket["revM4"] += safe_float(row["revM4"])
            bucket["revM5"] += safe_float(row["revM5"])
            for bucket_key, row_key in ROI_FIELD_MAPPINGS:
                bucket[bucket_key] += safe_float(row[row_key]) * cost
            day_key = extract_day_key(row["dateStr"])
            if day_key:
                bucket["uniqueDays"].add(day_key)
        return [monthly[key] for key in sorted(monthly.keys())]

    def get_monthly_roi(self, bucket, key):
        return bucket[key] / bucket["cost"] if bucket["cost"] > 0 else 0.0

    def build_monthly_roi_row(self, bucket):
        roi_values = {day: self.get_monthly_roi(bucket, name) for name, day in [
            ("d0Revenue", "d0"), ("d1Revenue", "d1"), ("d2Revenue", "d2"), ("d3Revenue", "d3"),
            ("d4Revenue", "d4"), ("d5Revenue", "d5"), ("d6Revenue", "d6"), ("d13Revenue", "d13"),
            ("d20Revenue", "d20"), ("d29Revenue", "d29"), ("d39Revenue", "d39"), ("d49Revenue", "d49"),
            ("d59Revenue", "d59"), ("d69Revenue", "d69"), ("d79Revenue", "d79"), ("d89Revenue", "d89"),
            ("d99Revenue", "d99"),
        ]}
        return [
            format_month_summary_label(bucket["monthKey"]),
            format_currency(bucket["cost"]),
            format_currency(bucket["revD6"]),
            format_currency(bucket["revD13"]),
            format_currency(bucket["revD20"]),
            format_percent(roi_values["d0"]),
            format_percent(roi_values["d1"]),
            format_percent(roi_values["d2"]),
            format_percent(roi_values["d3"]),
            format_percent(roi_values["d4"]),
            format_percent(roi_values["d5"]),
            format_percent(roi_values["d6"]),
            format_percent(roi_values["d13"]),
            format_percent(roi_values["d20"]),
            format_percent(roi_values["d29"]),
            format_percent(roi_values["d39"]),
            format_percent(roi_values["d49"]),
            format_percent(roi_values["d59"]),
            format_percent(roi_values["d69"]),
            format_percent(roi_values["d79"]),
            format_percent(roi_values["d89"]),
            format_percent(roi_values["d99"]),
            "",
            calc_ratio(roi_values["d1"], roi_values["d0"]),
            calc_ratio(roi_values["d2"], roi_values["d0"]),
            calc_ratio(roi_values["d3"], roi_values["d0"]),
            calc_ratio(roi_values["d4"], roi_values["d0"]),
            calc_ratio(roi_values["d5"], roi_values["d0"]),
            calc_ratio(roi_values["d6"], roi_values["d0"]),
            calc_ratio(roi_values["d13"], roi_values["d0"]),
            calc_ratio(roi_values["d20"], roi_values["d0"]),
            calc_ratio(roi_values["d29"], roi_values["d0"]),
            calc_ratio(roi_values["d2"], roi_values["d1"]),
            calc_ratio(roi_values["d6"], roi_values["d1"]),
            calc_ratio(roi_values["d13"], roi_values["d6"]),
            calc_ratio(roi_values["d13"], roi_values["d20"]),
            calc_ratio(roi_values["d6"], roi_values["d29"]),
            calc_ratio(roi_values["d13"], roi_values["d29"]),
            calc_ratio(roi_values["d20"], roi_values["d29"]),
        ]

    def build_monthly_basic_row(self, bucket):
        dau_average = bucket["dausTotal"] / len(bucket["uniqueDays"]) if bucket["uniqueDays"] else 0.0
        pay_rate = bucket["paidInstalls"] / bucket["installs"] if bucket["installs"] > 0 else 0.0
        active_recovery = bucket["totalRevenue"] / bucket["cost"] if bucket["cost"] > 0 else 0.0
        retention1 = bucket["retention1Weighted"] / bucket["installs"] if bucket["installs"] > 0 else 0.0
        return [
            format_month_summary_label(bucket["monthKey"]),
            format_currency(bucket["cost"]),
            js_round(bucket["installs"]),
            format_currency(bucket["cost"] / bucket["installs"] if bucket["installs"] > 0 else 0),
            js_round(dau_average),
            format_percent(self.get_monthly_roi(bucket, "d0Revenue")),
            format_currency(bucket["revD0"] / bucket["installs"] if bucket["installs"] > 0 else 0),
            js_round(bucket["paidInstalls"]),
            format_currency(bucket["cost"] / bucket["paidInstalls"] if bucket["paidInstalls"] > 0 else 0),
            format_percent(pay_rate),
            format_currency(bucket["iapRevD0"] / bucket["paidInstalls"] if bucket["paidInstalls"] > 0 else 0),
            format_currency(bucket["iapRevD0"]),
            format_currency(bucket["adRevD0"]),
            format_currency(bucket["revD0"]),
            format_currency(bucket["totalRevenue"]),
            format_percent(retention1),
            format_percent(active_recovery),
            format_percent(bucket["revM0"] / bucket["cost"] if bucket["cost"] > 0 else 0),
            format_percent(bucket["revM1"] / bucket["cost"] if bucket["cost"] > 0 else 0),
            format_percent(bucket["revM2"] / bucket["cost"] if bucket["cost"] > 0 else 0),
            format_percent(bucket["revM3"] / bucket["cost"] if bucket["cost"] > 0 else 0),
            format_percent(bucket["revM4"] / bucket["cost"] if bucket["cost"] > 0 else 0),
            format_percent(bucket["revM5"] / bucket["cost"] if bucket["cost"] > 0 else 0),
        ]

    def build_daily_roi_row(self, row):
        return [
            format_day_label(row["dateStr"]),
            format_currency(row["cost"]),
            format_currency(row["revD6"]),
            format_currency(row["revD13"]),
            format_currency(row["revD20"]),
            format_percent(row["roiD0"]),
            format_percent(row["roiD1"]),
            format_percent(row["roiD2"]),
            format_percent(row["roiD3"]),
            format_percent(row["roiD4"]),
            format_percent(row["roiD5"]),
            format_percent(row["roiD6"]),
            format_percent(row["roiD13"]),
            format_percent(row["roiD20"]),
            format_percent(row["roiD29"]),
            format_percent(row["roiD39"]),
            format_percent(row["roiD49"]),
            format_percent(row["roiD59"]),
            format_percent(row["roiD69"]),
            format_percent(row["roiD79"]),
            format_percent(row["roiD89"]),
            format_percent(row["roiD99"]),
            "",
            calc_ratio(row["roiD1"], row["roiD0"]),
            calc_ratio(row["roiD2"], row["roiD0"]),
            calc_ratio(row["roiD3"], row["roiD0"]),
            calc_ratio(row["roiD4"], row["roiD0"]),
            calc_ratio(row["roiD5"], row["roiD0"]),
            calc_ratio(row["roiD6"], row["roiD0"]),
            calc_ratio(row["roiD13"], row["roiD0"]),
            calc_ratio(row["roiD20"], row["roiD0"]),
            calc_ratio(row["roiD29"], row["roiD0"]),
            calc_ratio(row["roiD2"], row["roiD1"]),
            calc_ratio(row["roiD6"], row["roiD1"]),
            calc_ratio(row["roiD13"], row["roiD6"]),
            calc_ratio(row["roiD13"], row["roiD20"]),
            calc_ratio(row["roiD6"], row["roiD29"]),
            calc_ratio(row["roiD13"], row["roiD29"]),
            calc_ratio(row["roiD20"], row["roiD29"]),
        ]

    def build_daily_basic_row(self, row):
        return [
            format_day_label(row["dateStr"]),
            format_currency(row["cost"]),
            js_round(row["installs"]),
            format_currency(row["cpa"]),
            js_round(row["daus"]),
            format_percent(row["roiD0"]),
            format_currency(row["arpu"]),
            js_round(row["paidInstalls"]),
            format_currency(row["userPayCost"]),
            format_percent(row["payRate"]),
            format_currency(row["paidArppu"]),
            format_currency(row["iapRevD0"]),
            format_currency(row["adRevD0"]),
            format_currency(row["revD0"]),
            format_currency(row["totalRevenue"]),
            format_percent(row["retention1"]),
            format_percent(row["totalRevenue"] / row["cost"] if row["cost"] > 0 else 0),
            format_percent(row["roasM0"]),
            format_percent(row["roasM1"]),
            format_percent(row["roasM2"]),
            format_percent(row["roasM3"]),
            format_percent(row["roasM4"]),
            format_percent(row["roasM5"]),
        ]

    def build_rows(self, rows, kind):
        monthly_buckets = self.aggregate_monthly_data(rows)
        bucket_map = {bucket["monthKey"]: bucket for bucket in monthly_buckets}
        rows_by_month = {}
        for row in rows:
            month_key = extract_month_key(row["dateStr"])
            if not month_key:
                continue
            rows_by_month.setdefault(month_key, []).append(row)
        ordered_months = sorted(set(bucket_map.keys()) | set(rows_by_month.keys()))
        output_rows = []
        for month_key in ordered_months:
            bucket = bucket_map.get(month_key)
            if bucket:
                output_rows.append(self.build_monthly_roi_row(bucket) if kind == "roi" else self.build_monthly_basic_row(bucket))
            for row in sorted(rows_by_month.get(month_key, []), key=lambda item: extract_day_key(item["dateStr"])):
                output_rows.append(self.build_daily_roi_row(row) if kind == "roi" else self.build_daily_basic_row(row))
        header = MONTHLY_ROI_HEADERS if kind == "roi" else MONTHLY_BASIC_HEADERS
        return header, output_rows

    def list_sheets(self):
        response = self.feishu_request("GET", f"/open-apis/sheets/v3/spreadsheets/{self.spreadsheet_token}/sheets/query")
        return {sheet["title"]: sheet["sheet_id"] for sheet in response["data"]["sheets"]}

    def create_sheet(self, title):
        response = self.feishu_request(
            "POST",
            f"/open-apis/sheets/v2/spreadsheets/{self.spreadsheet_token}/sheets_batch_update",
            {"requests": [{"addSheet": {"properties": {"title": title}}}]},
        )
        properties = response["data"]["replies"][0]["addSheet"]["properties"]
        return properties.get("sheet_id") or properties.get("sheetId")

    def read_sheet_values(self, sheet_id):
        response = self.feishu_request(
            "GET",
            f"/open-apis/sheets/v2/spreadsheets/{self.spreadsheet_token}/values/{sheet_id}!A:AZ",
        )
        return response.get("data", {}).get("valueRange", {}).get("values", []) or []

    def batch_update_values(self, sheet_id, values):
        end_col = get_col_str(len(values[0]) - 1)
        self.feishu_request(
            "POST",
            f"/open-apis/sheets/v2/spreadsheets/{self.spreadsheet_token}/values_batch_update",
            {"valueRanges": [{"range": f"{sheet_id}!A1:{end_col}{len(values)}", "values": values}]},
        )

    def style_summary_rows(self, sheet_id, header_length, values):
        ranges = []
        end_col = get_col_str(header_length - 1)
        for row_number, row in enumerate(values, start=1):
            if row and isinstance(row[0], str) and "汇总" in row[0]:
                ranges.append(f"{sheet_id}!A{row_number}:{end_col}{row_number}")
        if not ranges:
            return
        self.feishu_request(
            "PUT",
            f"/open-apis/sheets/v2/spreadsheets/{self.spreadsheet_token}/styles_batch_update",
            {"data": [{"ranges": ranges, "style": {"backColor": "#FFF2CC"}}]},
        )

    def set_row_visibility(self, sheet_id, start_row, end_row, visible):
        if end_row < start_row:
            return
        self.feishu_request(
            "PUT",
            f"/open-apis/sheets/v2/spreadsheets/{self.spreadsheet_token}/dimension_range",
            {
                "dimension": {
                    "sheetId": sheet_id,
                    "majorDimension": "ROWS",
                    "startIndex": start_row - 1,
                    "endIndex": end_row,
                },
                "dimensionProperties": {"visible": visible},
            },
        )

    def collapse_old_months(self, sheet_id, values):
        sections = []
        current = None

        def flush():
            if current and current["dailyCount"] > 0:
                sections.append(dict(current))

        for row_number, row in enumerate(values, start=1):
            cell = row[0].strip() if row and isinstance(row[0], str) else ""
            summary_month = parse_summary_month_key(cell)
            if summary_month:
                flush()
                current = {"monthKey": summary_month, "dailyStart": 0, "dailyEnd": 0, "dailyCount": 0}
                continue
            if not current:
                continue
            day_key = extract_day_key(cell)
            if not day_key or extract_month_key(day_key) != current["monthKey"]:
                continue
            if current["dailyStart"] == 0:
                current["dailyStart"] = row_number
            current["dailyEnd"] = row_number
            current["dailyCount"] += 1

        flush()
        if len(values) >= 2:
            self.set_row_visibility(sheet_id, 2, len(values), True)
        if not sections:
            return
        latest_month = sorted(section["monthKey"] for section in sections)[-1]
        for section in sections:
            if section["monthKey"] == latest_month:
                continue
            self.set_row_visibility(sheet_id, section["dailyStart"], section["dailyEnd"], False)

    def ensure_sheet(self, title, sheets):
        sheet_id = sheets.get(title)
        if sheet_id:
            return sheet_id
        print(f"Creating sheet: {title}", flush=True)
        sheet_id = self.create_sheet(title)
        sheets[title] = sheet_id
        return sheet_id

    def sync_sheet(self, title, sheet_id, header, rows):
        values = [header] + rows
        existing_values = self.read_sheet_values(sheet_id)
        max_rows = max(len(existing_values), len(values))
        padded = []
        for index in range(max_rows):
            if index < len(values):
                row = list(values[index])
                if len(row) < len(header):
                    row.extend([""] * (len(header) - len(row)))
            else:
                row = [""] * len(header)
            padded.append(row)
        print(f"Writing {title} ({sheet_id}) with {len(rows)} rows", flush=True)
        self.batch_update_values(sheet_id, padded)
        for attempt in range(3):
            try:
                if attempt > 0:
                    print(f"Retrying styles for {title} ({attempt + 1}/3)", flush=True)
                time.sleep(1)
                self.style_summary_rows(sheet_id, len(header), values)
                break
            except RuntimeError as error:
                if "90202" not in str(error) or attempt == 2:
                    raise
        self.collapse_old_months(sheet_id, values)
        for preview_row in values[:5]:
            print(f"  {preview_row[0]} | {preview_row[1] if len(preview_row) > 1 else ''}", flush=True)

    def run(self):
        print(
            f"Manual sync start: spreadsheet={self.spreadsheet_token} app={self.target_app_token} "
            f"range={self.start_date}..{self.end_date}",
            flush=True,
        )
        self.get_tenant_token()
        sheets = self.list_sheets()

        roi_metrics = (
            "cost,installs,all_revenue,ad_revenue,revenue,first_paying_users_d0,daus,sessions,"
            + ",".join(f"roas_d{day}" for day in ROI_DAYS)
            + ","
            + ",".join(f"ad_revenue_total_d{day}" for day in ROI_DAYS)
            + ","
            + ",".join(f"revenue_total_d{day}" for day in ROI_DAYS)
            + ",retention_rate_d1,retention_rate_d2,retention_rate_d3,retention_rate_d4,"
            + "retention_rate_d5,retention_rate_d6,retention_rate_d7,retention_rate_d14,retention_rate_d20"
        )
        basic_metrics = (
            "cost,installs,all_revenue,ad_revenue,revenue,ecpi_all,roas_d0,all_revenue_total_d0,"
            "revenue_total_d0,ad_revenue_total_d0,first_paying_users_d0,retention_rate_d1,daus,sessions,"
            "all_revenue_total_m0,all_revenue_total_m1,all_revenue_total_m2,all_revenue_total_m3,"
            "all_revenue_total_m4,all_revenue_total_m5,all_revenue_total_m6"
        )

        raw_roi_rows = self.fetch_adjust_rows(roi_metrics, "ROI")
        raw_basic_rows = self.fetch_adjust_rows(basic_metrics, "Basic")

        for block_id, meta in CURRENT_BLOCKS.items():
            raw_rows = raw_roi_rows if meta["kind"] == "roi" else raw_basic_rows
            processed_rows = self.aggregate_rows(raw_rows, block_id, meta["store"], meta["network"])
            header, rows = self.build_rows(processed_rows, meta["kind"])
            sheet_id = self.ensure_sheet(meta["sheet"], sheets)
            self.sync_sheet(meta["sheet"], sheet_id, header, rows)
            time.sleep(1)

        print("Manual sync completed.", flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--spreadsheet", required=True, help="Feishu spreadsheet token")
    parser.add_argument("--app-token", required=True, help="Adjust app token")
    parser.add_argument("--app-name", help="Adjust app name")
    parser.add_argument("--start-date", default="2025-12-01")
    parser.add_argument("--end-date")
    args = parser.parse_args()

    syncer = ManualFeishuSync(
        spreadsheet_token=args.spreadsheet,
        app_token=args.app_token,
        app_name=args.app_name,
        start_date=args.start_date,
        end_date=args.end_date,
    )
    syncer.run()


if __name__ == "__main__":
    main()
