# Aqara 발주 시스템 · 데이터 API 안내 (읽기 전용)

발주 시스템의 원본 데이터(매장, 주문, 주문 상품 내역, 상품)를 가져와 스크립트나 AI로 분석할 수 있도록 제공하는 API입니다. 읽기 전용이며 어떤 데이터도 변경하지 않습니다.

## 1. 기본 정보

| 항목 | 내용 |
|---|---|
| Base URL | `https://aqara-distro.vercel.app/api/report` |
| 메서드 | `GET` 만 지원 |
| 인증 | 요청 헤더 `Authorization: Bearer <API_KEY>` (API Key 는 별도로 전달) |
| 응답 형식 | 기본 JSON, `?format=csv` 를 붙이면 CSV (UTF-8 BOM 포함, Excel 에서 바로 열림) |

> API Key 로 전체 매장의 연락처와 단가를 조회할 수 있습니다. 코드 저장소, 문서, 단체 채팅방에 올리지 마세요. AI 로 분석할 때는 데이터를 파일로 내려받아 업로드하는 방식을 권장하며, Key 자체를 AI 에 넘기지 마세요.

## 2. API 목록

| API | 한 행의 의미 | 현재 데이터 건수 (참고) |
|---|---|---|
| `GET /stores` | 계정 1개 (소매점 또는 총판) | 60 (소매점 58 + 총판 2) |
| `GET /orders` | 주문 1건 | 163 |
| `GET /order-items` | 주문에 포함된 상품 1행 | 218 |
| `GET /products` | 상품 1개 | 41 |

## 3. 공통 파라미터

| 파라미터 | 설명 | 기본값 |
|---|---|---|
| `format` | `json` 또는 `csv` | `json` |
| `page` | 페이지 번호, 1부터 시작 | `1` |
| `page_size` | 페이지당 행 수, 1–1000 | `1000` |
| `from` / `to` | 기간 `YYYY-MM-DD`. **주문 생성일** 기준으로 필터링하며, 한국 시간(KST) 하루 단위로 계산하고 시작일·종료일을 모두 포함합니다. `/orders` 와 `/order-items` 에만 적용됩니다 | 제한 없음 |

JSON 응답 구조:

```json
{
  "resource": "orders",
  "total": 163,
  "page": 1,
  "page_size": 1000,
  "data": [ { "...": "..." } ]
}
```

- `total` 은 조건에 맞는 전체 행 수입니다. `total` 이 `page_size` 보다 크면 `data` 가 빌 때까지 다음 페이지를 요청해야 합니다.
- CSV 는 바깥 구조가 없으며, 전체 행 수는 응답 헤더 `X-Total-Count` 에 들어 있습니다.
- 파라미터 오류는 `400`, Key 오류는 `401`, API 이름 오류는 `404` 를 반환합니다.

## 4. 데이터 규칙

- **시간**: 모든 `*_at` 필드는 UTC 기준 ISO 8601 형식입니다 (예: `2026-09-01T02:13:45.123+00:00`). 한국 시간으로 보려면 9시간을 더하세요.
- **금액**: 단위는 원(KRW), 정수입니다.
- **빈 값**: JSON 에서는 `null`, CSV 에서는 빈 셀입니다.
- **연결 키**: `orders.id` = `order-items.order_id`, `stores.id` = `orders.retailer_id` / `orders.distributor_id`, `products.id` = `order-items.product_id`.
- **두 단계 단가**: `retailer_*` 는 총판이 소매점에 판매하는 가격, `hq_*` 는 본사가 총판에 공급하는 가격입니다 (본사 매출 기준은 `hq_*` 사용).

## 5. 필드 설명

### 5.1 `/stores` 매장

| 필드 | 설명 |
|---|---|
| `id` | 계정 ID |
| `role` | `retailer` (소매점) / `distributor` (총판) |
| `company_name` | 상호명 |
| `contact_name`, `phone`, `email` | 담당자, 전화번호, 로그인 이메일 |
| `post_code`, `address` | 우편번호, 주소 |
| `distributor_id`, `distributor_name` | 소속 총판 (총판 본인은 비어 있음) |
| `status` | `active` 정상 / `restricted` 제한 / `suspended` 정지 |
| `created_at`, `updated_at` | 가입 시각, 정보 수정 시각 |
| `last_sign_in_at` | 마지막 로그인 시각. 비어 있으면 한 번도 로그인하지 않은 계정 |

활성도 분석은 `last_sign_in_at` 과 해당 매장의 `/orders` 주문 시각·빈도를 함께 보면 됩니다. 시스템은 "마지막" 로그인 시각만 저장하며, 과거 로그인 이력은 없습니다.

### 5.2 `/orders` 주문

| 필드 | 설명 |
|---|---|
| `id`, `order_number` | 주문 ID, 주문번호 |
| `status` | 주문 상태 (아래 표 참고) |
| `order_type` | `quote` 견적 주문 / `direct` 직접 발주 |
| `fulfillment_type` | `hq` 본사 출고 / `distributor` 총판 자체 출고 |
| `retailer_id`, `retailer_name` | 주문한 소매점 |
| `distributor_id`, `distributor_name` | 소속 총판 |
| `shipping_address`, `desired_date`, `note` | 배송지, 희망 납기일, 비고 |
| `retailer_total` | 소매점 결제 총액 (총판 → 소매점) |
| `hq_total` | 본사 공급 총액 (본사 → 총판) |
| `tracking_number` | 송장번호 (한진택배) |
| `box_ids` | 박스 ID (JSON, 일부 품목만 해당) |
| `quote_expires_at` | 견적 유효기한 |
| `submitted_at`, `approved_at`, `shipped_at`, `delivered_at` | 제출, 승인, 출고, 수령 시각 |
| `created_at`, `updated_at` | 생성 시각, 최종 수정 시각 |

주문 상태:

| `status` | 표시명 | 의미 |
|---|---|---|
| `DRAFT` | 견적 작성 중 | 작성 중, 아직 제출 전 |
| `SUBMITTED` | 견적 요청 / 발주 요청 | 제출됨, 총판 처리 대기 |
| `QUOTE_SENT` | 견적 발송 | 총판이 견적 발송 |
| `ORDER_PLACED` | 발주 확정 | 소매점이 발주 확정 |
| `APPROVED` | 승인완료 | 총판 승인 완료 |
| `REJECTED` | 반려 | 반려됨 |
| `HQ_RECEIVED` | 본사접수 | 본사 접수 |
| `PREPARING` | 출고준비 | 출고 준비 중 |
| `SHIPPED` | 출고완료 | 출고 완료 |
| `DELIVERED` | 수령완료 | 수령 완료 |
| `COMPLETED` | 완료 | 완료 |

API 는 `DRAFT`, `REJECTED` 를 포함한 **모든 상태**의 주문을 반환합니다. 실제 매출을 집계할 때는 보통 `SHIPPED`, `DELIVERED`, `COMPLETED` 만 사용하고 `shipped_at` 을 매출 일자로 봅니다.

### 5.3 `/order-items` 주문 상품 내역

각 행에 주문·매장·상품의 주요 정보가 함께 들어 있어, 이 API 하나만으로 상품 기준 분석이 가능합니다.

| 필드 | 설명 |
|---|---|
| `id`, `order_id`, `order_number` | 내역 행 ID, 소속 주문 |
| `order_status`, `order_type`, `fulfillment_type` | `/orders` 와 동일 |
| `retailer_id`, `retailer_name`, `distributor_id`, `distributor_name` | 소매점, 총판 |
| `product_id`, `product_code`, `erp_code`, `product_name`, `category` | 상품 |
| `option_code`, `option_name` | 상품 옵션 (옵션이 없으면 비어 있음) |
| `quantity` | 수량 |
| `retailer_unit_price`, `retailer_amount` | 소매점 단가, 금액 (일부 주문은 비어 있음) |
| `hq_unit_price`, `hq_amount` | 본사 공급 단가, 금액 (단가 미확정 시 비어 있음) |
| `order_created_at`, `order_submitted_at`, `order_approved_at`, `order_shipped_at`, `order_delivered_at` | 소속 주문의 각 시각 |

### 5.4 `/products` 상품

| 필드 | 설명 |
|---|---|
| `id`, `product_code`, `erp_code` | 상품 ID, 상품 코드, ERP 코드 |
| `name`, `category` | 상품명, 카테고리 |
| `options` | 옵션 목록 (JSON: `[{"code": "...", "name": "..."}]`) |
| `moq`, `order_unit` | 최소 주문 수량, 주문 단위 |
| `consumer_price` | 소비자가 |
| `distributor_price` | 총판 참고가 (현재 모두 비어 있음) |
| `product_url`, `image_url` | 상품 페이지, 이미지 링크 |
| `is_active` | 판매 중 여부 |
| `created_at` | 생성 시각 |

## 6. 호출 예시

### curl

```bash
export AQARA_REPORT_KEY='전달받은 API Key'

# 전체 매장 (JSON)
curl -H "Authorization: Bearer $AQARA_REPORT_KEY" \
  "https://aqara-distro.vercel.app/api/report/stores"

# 2026년 9월 주문 상품 내역을 CSV 로 저장
curl -H "Authorization: Bearer $AQARA_REPORT_KEY" \
  "https://aqara-distro.vercel.app/api/report/order-items?from=2026-09-01&to=2026-09-30&format=csv" \
  -o order-items.csv
```

### Python (자동 페이지 넘김으로 전체 데이터 조회)

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

# 예: 매장별 출고 완료 주문 수와 본사 매출
shipped = orders[orders["status"].isin(["SHIPPED", "DELIVERED", "COMPLETED"])]
by_store = (shipped.groupby("retailer_name")
            .agg(orders=("id", "count"), hq_sales=("hq_total", "sum"))
            .sort_values("hq_sales", ascending=False))
print(by_store.head(10))

# 예: 상품별 출고 완료 수량
shipped_items = items[items["order_status"].isin(["SHIPPED", "DELIVERED", "COMPLETED"])]
print(shipped_items.groupby(["product_code", "product_name"])["quantity"].sum()
      .sort_values(ascending=False).head(10))
```
