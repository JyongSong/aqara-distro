import sql from 'mssql'
import { getErpPool } from './erp'

export type DispatchRow = {
  customer_name: string | null
  phone: string | null
  address: string | null
  order_numbers: string | null
  memo: string | null
}

/**
 * 기사배정 대상 주문 조회
 * - 납기일자 (DT_DUEDATE) 매칭
 * - 해당 주문(NO_SO)에 용역 품목(출장비 00010 OR 도어락 설치비 00012%) 포함
 * - 전화번호 기준 그룹핑 (한 사람 = 한 행)
 */
export async function fetchDispatchRows(dueDate: string): Promise<DispatchRow[]> {
  const pool = await getErpPool()
  const result = await pool.request()
    .input('dueDate', sql.VarChar(8), dueDate)
    .query(`
      WITH eligible AS (
        SELECT DISTINCT NO_SO, CD_COMPANY
        FROM NEOE.SA_SOL
        WHERE CD_COMPANY = '1000'
          AND NO_HST     = 0
          AND DT_DUEDATE = @dueDate
          AND (CD_ITEM = '00010' OR CD_ITEM LIKE '00012%')
      ),
      lines AS (
        SELECT
          SOL.NO_SO, SOL.SEQ_SO, SOL.CD_COMPANY,
          SOL.CD_ITEM,
          LTRIM(RTRIM(ISNULL(I.NM_ITEM, SOL.CD_ITEM))) AS NM_ITEM,
          CAST(SOL.QT_SO AS INT) AS QT,
          SOL.NO_ORDER_ON,
          COALESCE(
            NULLIF(LTRIM(RTRIM(CZ.NO_HP1)),  ''),
            NULLIF(LTRIM(RTRIM(CZ.NO_HP2)),  ''),
            NULLIF(LTRIM(RTRIM(CZ.NO_TEL1)), ''),
            NULLIF(LTRIM(RTRIM(CZ.NO_TEL2)), '')
          ) AS phone,
          COALESCE(
            NULLIF(LTRIM(RTRIM(CZ.NM_RECEIVE)), ''),
            NULLIF(LTRIM(RTRIM(CZ.NM_CUST)),    '')
          ) AS nm,
          CZ.DC_ADDR1 AS addr
        FROM eligible e
        JOIN NEOE.SA_SOL SOL
          ON SOL.NO_SO = e.NO_SO AND SOL.CD_COMPANY = e.CD_COMPANY
         AND SOL.NO_HST = 0
        LEFT JOIN NEOE.CZ_SA_ORDER CZ
          ON CZ.NO_ORDER  = SOL.NO_SO
         AND CZ.SEQ_ORDER = SOL.SEQ_SO
         AND CZ.CD_COMPANY = SOL.CD_COMPANY
        LEFT JOIN NEOE.MA_PITEM I
          ON I.CD_ITEM = SOL.CD_ITEM AND I.CD_COMPANY = '1000'
      )
      SELECT
        MAX(nm)   AS customer_name,
        l1.phone  AS phone,
        MAX(addr) AS address,
        STUFF((
          SELECT DISTINCT N', ' + l2.NO_ORDER_ON
          FROM lines l2
          WHERE l2.phone = l1.phone AND l2.NO_ORDER_ON IS NOT NULL
          FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'), 1, 2, '') AS order_numbers,
        STUFF((
          SELECT N' / ' + l2.NM_ITEM + N' x' + CAST(l2.QT AS NVARCHAR(10))
          FROM lines l2
          WHERE l2.phone = l1.phone
          FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'), 1, 3, '') AS memo
      FROM lines l1
      WHERE l1.phone IS NOT NULL
      GROUP BY l1.phone
      ORDER BY customer_name
    `)

  return result.recordset as DispatchRow[]
}

/** YYYYMMDD → YYYY/MM/DD */
export function formatDueDate(yyyymmdd: string): string {
  return `${yyyymmdd.slice(0, 4)}/${yyyymmdd.slice(4, 6)}/${yyyymmdd.slice(6, 8)}`
}

/** 모든 행에 동일하게 들어가는 고정값 (모범 예시 기반) */
export const DISPATCH_CONST = {
  거래처:       '124-28-81512',
  지점명:       '화성/신영통열쇠',
  창고:         '본사',
  담당자:       '송지용',
  수리유형:     '설치',
  설치완료여부: '접수',
} as const
