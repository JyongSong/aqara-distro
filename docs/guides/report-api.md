# Aqara 发注系统 · 数据接口说明（只读）

用于拉取发注系统的原始数据（门店、订单、订单商品明细、商品），供脚本或 AI 做分析。接口只读，不会修改任何数据。

## 1. 基本信息

| 项目 | 内容 |
|---|---|
| Base URL | `https://aqara-distro.vercel.app/api/report` |
| 方法 | 仅 `GET` |
| 认证 | 请求头 `Authorization: Bearer <API_KEY>`（API Key 另行单独发送） |
| 返回格式 | 默认 JSON；加 `?format=csv` 返回 CSV（UTF-8 带 BOM，Excel 可直接打开） |

> API Key 可以读取全部门店的联系方式和价格，请勿写进代码仓库、文档或群聊。使用 AI 分析时，建议先把数据下载成文件再上传，不要把 Key 交给 AI。

## 2. 接口一览

| 接口 | 每一行代表 | 当前数据量（参考） |
|---|---|---|
| `GET /stores` | 一个账号（소매점 或 총판） | 60（58 家소매점 + 2 家총판） |
| `GET /orders` | 一张订单 | 163 |
| `GET /order-items` | 订单里的一个商品行 | 218 |
| `GET /products` | 一个商品 | 41 |

## 3. 通用参数

| 参数 | 说明 | 默认 |
|---|---|---|
| `format` | `json` 或 `csv` | `json` |
| `page` | 页码，从 1 开始 | `1` |
| `page_size` | 每页行数，1–1000 | `1000` |
| `from` / `to` | 日期范围 `YYYY-MM-DD`，按**订单创建时间**筛选，按韩国时间（KST）整天计算，两端都包含。仅对 `/orders` 和 `/order-items` 生效 | 不限 |

JSON 返回结构：

```json
{
  "resource": "orders",
  "total": 163,
  "page": 1,
  "page_size": 1000,
  "data": [ { "...": "..." } ]
}
```

- `total` 是符合条件的总行数。`total` 大于 `page_size` 时需要翻页，直到 `data` 为空。
- CSV 没有外层结构，总行数在响应头 `X-Total-Count` 里。
- 参数错误返回 `400`，Key 错误返回 `401`，接口名错误返回 `404`。

## 4. 数据约定

- **时间**：所有 `*_at` 字段是 UTC 的 ISO 8601 格式（如 `2026-09-01T02:13:45.123+00:00`），换算韩国时间需 +9 小时。
- **金额**：单位是韩元（KRW），整数。
- **空值**：JSON 里是 `null`，CSV 里是空单元格。
- **关联**：`orders.id` = `order-items.order_id`；`stores.id` = `orders.retailer_id` / `orders.distributor_id`；`products.id` = `order-items.product_id`。
- **两层价格**：`retailer_*` 是총판卖给소매점的价格；`hq_*` 是本社卖给총판的价格（本社销售额口径用 `hq_*`）。

## 5. 字段说明

### 5.1 `/stores` 门店

| 字段 | 说明 |
|---|---|
| `id` | 账号 ID |
| `role` | `retailer`（소매점）/ `distributor`（총판） |
| `company_name` | 店名 / 公司名 |
| `contact_name`、`phone`、`email` | 联系人、电话、登录邮箱 |
| `post_code`、`address` | 邮编、地址 |
| `distributor_id`、`distributor_name` | 所属총판（총판自身为空） |
| `status` | `active` 正常 / `restricted` 限制 / `suspended` 停用 |
| `created_at`、`updated_at` | 注册时间、资料更新时间 |
| `last_sign_in_at` | 最后一次登录时间；为空表示从未登录 |

分析活跃度可以结合 `last_sign_in_at` 和该店在 `/orders` 里的下单时间、频次。系统只保存"最后一次"登录时间，没有历史登录记录。

### 5.2 `/orders` 订单

| 字段 | 说明 |
|---|---|
| `id`、`order_number` | 订单 ID、订单号 |
| `status` | 订单状态，见下表 |
| `order_type` | `quote` 询价单 / `direct` 直接发注 |
| `fulfillment_type` | `hq` 本社发货 / `distributor` 총판自行发货 |
| `retailer_id`、`retailer_name` | 下单门店 |
| `distributor_id`、`distributor_name` | 所属총판 |
| `shipping_address`、`desired_date`、`note` | 收货地址、期望到货日、备注 |
| `retailer_total` | 소매점应付总额（총판 → 소매점） |
| `hq_total` | 本社供货总额（本社 → 총판） |
| `tracking_number` | 运单号（한진택배） |
| `box_ids` | 箱子 ID（JSON，仅部分品类有） |
| `quote_expires_at` | 报价有效期 |
| `submitted_at`、`approved_at`、`shipped_at`、`delivered_at` | 提交、批准、出库、签收时间 |
| `created_at`、`updated_at` | 创建、最后更新时间 |

订单状态：

| `status` | 韩文 | 含义 |
|---|---|---|
| `DRAFT` | 견적 작성 중 | 草稿，尚未提交 |
| `SUBMITTED` | 견적 요청 / 발주 요청 | 已提交，待총판处理 |
| `QUOTE_SENT` | 견적 발송 | 총판已报价 |
| `ORDER_PLACED` | 발주 확정 | 소매점确认发注 |
| `APPROVED` | 승인완료 | 총판已批准 |
| `REJECTED` | 반려 | 已驳回 |
| `HQ_RECEIVED` | 본사접수 | 本社已接单 |
| `PREPARING` | 출고준비 | 备货中 |
| `SHIPPED` | 출고완료 | 已出库 |
| `DELIVERED` | 수령완료 | 已签收 |
| `COMPLETED` | 완료 | 已完成 |

接口会返回**所有状态**的订单，包括 `DRAFT` 和 `REJECTED`。统计实际销售时通常只取 `SHIPPED`、`DELIVERED`、`COMPLETED`，并以 `shipped_at` 作为销售日期。

### 5.3 `/order-items` 订单商品明细

每行已带上订单、门店、商品的常用信息，单独使用这一个接口就能做商品维度的分析。

| 字段 | 说明 |
|---|---|
| `id`、`order_id`、`order_number` | 明细行 ID、所属订单 |
| `order_status`、`order_type`、`fulfillment_type` | 同 `/orders` |
| `retailer_id`、`retailer_name`、`distributor_id`、`distributor_name` | 门店、총판 |
| `product_id`、`product_code`、`erp_code`、`product_name`、`category` | 商品 |
| `option_code`、`option_name` | 商品选项（无选项时为空） |
| `quantity` | 数量 |
| `retailer_unit_price`、`retailer_amount` | 소매점单价、金额（部分订单为空） |
| `hq_unit_price`、`hq_amount` | 本社供货单价、金额（未定价时为空） |
| `order_created_at`、`order_submitted_at`、`order_approved_at`、`order_shipped_at`、`order_delivered_at` | 所属订单的各时间点 |

### 5.4 `/products` 商品

| 字段 | 说明 |
|---|---|
| `id`、`product_code`、`erp_code` | 商品 ID、商品编码、ERP 编码 |
| `name`、`category` | 名称、分类 |
| `options` | 选项列表（JSON：`[{"code": "...", "name": "..."}]`） |
| `moq`、`order_unit` | 最小起订量、订货单位 |
| `consumer_price` | 消费者价 |
| `distributor_price` | 총판参考价（目前均为空） |
| `product_url`、`image_url` | 商品页、图片链接 |
| `is_active` | 是否上架 |
| `created_at` | 创建时间 |

## 6. 调用示例

### curl

```bash
export AQARA_REPORT_KEY='收到的 API Key'

# 全部门店（JSON）
curl -H "Authorization: Bearer $AQARA_REPORT_KEY" \
  "https://aqara-distro.vercel.app/api/report/stores"

# 2026 年 9 月的订单商品明细，保存为 CSV
curl -H "Authorization: Bearer $AQARA_REPORT_KEY" \
  "https://aqara-distro.vercel.app/api/report/order-items?from=2026-09-01&to=2026-09-30&format=csv" \
  -o order-items.csv
```

### Python（自动翻页，拉取全部数据）

```python
import os
import requests
import pandas as pd

BASE = "https://aqara-distro.vercel.app/api/report"
HEADERS = {"Authorization": f"Bearer {os.environ['AQARA_REPORT_KEY']}"}


def fetch_all(resource: str, **params) -> pd.DataFrame:
    rows, page = [], 1
    while True:
        res = requests.get(f"{BASE}/{resource}", headers=HEADERS,
                           params={**params, "page": page}, timeout=30)
        res.raise_for_status()
        body = res.json()
        rows.extend(body["data"])
        if not body["data"] or len(rows) >= body["total"]:
            return pd.DataFrame(rows)
        page += 1


stores = fetch_all("stores")
orders = fetch_all("orders")
items = fetch_all("order-items")
products = fetch_all("products")

# 例：各门店已出库订单数和本社销售额
shipped = orders[orders["status"].isin(["SHIPPED", "DELIVERED", "COMPLETED"])]
by_store = (shipped.groupby("retailer_name")
            .agg(orders=("id", "count"), hq_sales=("hq_total", "sum"))
            .sort_values("hq_sales", ascending=False))
print(by_store.head(10))

# 例：各商品已出库数量
shipped_items = items[items["order_status"].isin(["SHIPPED", "DELIVERED", "COMPLETED"])]
print(shipped_items.groupby(["product_code", "product_name"])["quantity"].sum()
      .sort_values(ascending=False).head(10))
```
